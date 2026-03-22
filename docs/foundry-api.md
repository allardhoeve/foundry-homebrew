# Foundry VTT Initialization Lifecycle

## Browser events vs Foundry hooks

When Playwright navigates to `/game`, two independent timelines run:

1. **Browser timeline** — the page loads scripts, fires `DOMContentLoaded`, then `load`. Playwright's `page.goto()` resolves after `load`.
2. **Foundry timeline** — Foundry's `Game` class boots asynchronously *after* scripts load. It fires its own hooks in sequence, independent of browser events.

These timelines are **not synchronized**. A DOM element being visible does not mean Foundry has finished initializing.

## Foundry hook sequence

| Order | Hook | What's ready | What's not |
|-------|------|-------------|------------|
| 1 | `init` | `game.settings` registration, module API objects created | World data (`game.actors`, `game.users`) |
| 2 | `ready` | Everything: world data loaded, settings readable, APIs available | — |
| 3 | *(UI renders)* | `#sidebar` and other DOM elements appear | Timing relative to `ready` is not guaranteed |

Our module registers settings and creates API objects (`api.lightTracker`, `api.scarletMinotaurEncounter`, `api.lightAdjuster`) during `init`. World data becomes available at `ready`.

## The race condition

If test code runs `page.evaluate()` to access module APIs before `init` has fired, those APIs are `undefined`. The `#sidebar` appearing in the DOM is **not** a reliable signal that `init` or `ready` has fired — it's a visual artifact with no semantic connection to module initialization.

## Our readiness contract

`module/src/module-ready.js` listens for Foundry's `ready` hook and fires an explicit signal:

```js
Hooks.once("ready", () => {
    const module = game.modules.get("foundry-homebrew");
    module.ready = true;
    Hooks.callAll("foundry-homebrew.ready");
});
```

Using `ready` (not `init`) because:
- `ready` fires after all `init` hooks — guarantees all three module APIs exist
- `ready` fires after world data is loaded — `game.actors`, `game.settings` all available
- Single hook, no ordering concerns between modules

Tests wait for this signal in the login step using `waitForFunction`, which polls safely even when `game` doesn't exist yet:

```js
await page.waitForFunction(() => {
    const module = globalThis.game?.modules?.get("foundry-homebrew");
    return module?.ready === true;
}, { timeout: 30_000 });
```

`waitForFunction` is needed instead of `page.evaluate` because `game` may not exist when `page.goto()` resolves. The optional chaining prevents errors during polling; once `module.ready` is `true`, the function returns and the test proceeds.

## Module manifest caching

Foundry reads `module.json` once at world startup to determine which `esmodules` to load as `<script>` tags. Changes to existing file contents are picked up on each page navigation (the browser re-fetches them), but adding or removing entries in `esmodules` requires a **world restart** — the server won't emit `<script>` tags for files it doesn't know about.
