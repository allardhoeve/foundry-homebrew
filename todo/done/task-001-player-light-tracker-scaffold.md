# Task 001: Player Light Tracker — Scaffold

Independent. Foundation for tasks 002–005.

## Goal

Create a minimal working ApplicationV2 macro that displays the player's active light source status using vague thematic descriptions instead of exact timers.

## Background

The Shadowdark system has a GM-only light tracker (`game.shadowdark.lightSourceTracker`). We want a player-facing version that shows only their own light source with immersive, non-numeric feedback. See `docs/shadowdark-light-tracker-api.md` for full API reference.

## Context

- `docs/shadowdark-light-tracker-api.md` — full API reference for the Shadowdark light system
- `macros/random-encounter-check.js` — existing ApplicationV2 macro pattern to follow
- `macros/macros.json` — macro registry; new macro must be added here
- `third_party/foundryvtt-shadowdark/system/src/apps/LightSourceTrackerSD.mjs` — GM tracker source
- `third_party/foundryvtt-shadowdark/system/src/documents/ActorSD.mjs` — `getActiveLightSources()`, `turnLightOff()`
- `third_party/foundryvtt-shadowdark/system/src/documents/ItemSD.mjs` — `isActiveLight()`, `item.system.light.*`
- `AGENTS.md` — must use ApplicationV2, Foundry v13 build 351

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Actor selection | `game.user.character` (primary assigned character) |
| Time display | Vague thematic text, not exact minutes |
| Light states | 4 states: darkness, bright (100–50%), good (50–25%), fading (25–0%) |
| Window style | ApplicationV2 with CSS-stripped chrome (no title bar) for immersive feel |
| Font | `"JSL Blackletter"` — installed by Shadowdark system |
| Multiple lights | Show first (shortest remaining duration) only |
| Framework | Option A: styled ApplicationV2 |

## Changes

### New: `macros/player-light-tracker.js`

ApplicationV2 macro with:

- **Singleton pattern**: store instance on `game.modules.get("foundry-homebrew")` or similar; macro toggles open/close
- **`_renderHTML()`**: builds DOM with:
  - Status text element (themed message)
  - Animation placeholder `<div class="light-animation">`
  - "Douse my flame" button (visible only when light is active)
- **CSS**: inline styles that hide window title bar and frame, dark background, `JSL Blackletter` font, white text
- **Light state logic**:
  ```javascript
  function getLightState(item) {
      const remaining = item.system.light.remainingSecs;
      const total = item.system.light.longevityMins * 60;
      const fraction = remaining / total;
      if (fraction > 0.5) return { key: "bright", text: "Your light shines brightly" };
      if (fraction > 0.25) return { key: "good", text: "Your light shines well" };
      return { key: "fading", text: "Your light starts to fade" };
  }
  ```
- **No-light state**: "The darkness engulfs you"
- **Hooks** (registered on render, cleaned up on close):
  - `updateItem` — re-render when light data changes on player's actor
  - `createItem` / `deleteItem` — re-render when lights added/removed
- **Douse button**: confirmation via `foundry.applications.api.DialogV2.confirm()`, then calls `actor.yourLightWentOut(itemId)` + toggles item `system.light.active` to false (or emits socket if non-GM)

### Modified: `macros/macros.json`

Add entry for the new macro with a new unique ID.

## Tests

No automated tests — this is a Foundry VTT macro that runs in-browser.

## Verification

1. Install module in Foundry VTT
2. Log in as a player with an assigned character
3. Run macro — window appears with "The darkness engulfs you"
4. GM activates a torch on the player's character
5. Window updates to show "Your light shines brightly"
6. Advance time until light is at ~40% — should show "Your light shines well"
7. Advance further to ~20% — should show "Your light starts to fade"
8. Click "Douse my flame" — confirmation dialog appears, light goes out, returns to darkness message
9. Let light expire naturally — returns to darkness message

## Pitfalls

- `game.user.character` can be `null` if no character is assigned — must handle gracefully
- The Shadowdark tracker updates `remainingSecs` every 30s by default, so state transitions may lag. This is acceptable (thematic vagueness).
- The `toggleLightSource` socket pattern expects the GM tracker to be running. If it's disabled, douse won't work. Show a notification in that case.
- Hook cleanup on close is critical — leaking hooks will cause errors and memory issues.
- Items of type `"Effect"` (light spells) use `remainingDuration` instead of manual `remainingSecs` decrement — but `remainingSecs` is still populated by the GM tracker, so we can treat them uniformly.

## Acceptance criteria

- [ ] Macro runs without errors for both GM and player users
- [ ] Shows "The darkness engulfs you" when no light is active
- [ ] Shows correct thematic state based on remaining fraction
- [ ] Reacts to light source changes within a few seconds
- [ ] "Douse my flame" works and extinguishes the light
- [ ] Window can be toggled open/closed via macro
- [ ] No Foundry window chrome visible (title bar hidden)
- [ ] Hook listeners are cleaned up when window closes
- [ ] `build.mjs` compiles the new macro into the compendium pack

## Scope boundaries

- **In scope**: scaffold, light state display, douse button, hook wiring, build integration
- **Out of scope**: animations (task 003), GM debug view (task 004), multiple character support (task 005), advanced UI/graphics
- **Do not** modify the Shadowdark system files in `third_party/`
