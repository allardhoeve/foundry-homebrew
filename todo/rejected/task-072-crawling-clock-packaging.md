# Task 072: Crawling Clock — packaging and release

Step 3 of 3. Depends on task 071. Design and rationale live in
`todo/tasks/task-067-crawling-clock-mvp.md`.

## Goal

Ship it: a launcher macro in the module's macro pack, and one version bump. Everything up
to here has been opened from the console or a hand-made world macro.

## Background

Deliberately last. A macro already dragged onto someone's hotbar keeps its own copy of the
command and does not follow the compendium, so editing the packed macro during development
costs a rebuild-and-wonder cycle every time. The version bump is once, at the end, because
bumping implies a tag and release and tags are never deleted or moved.

## Context

- `module/macros/player-light-tracker-macro.js` — the launcher pattern: a single line
  calling `toggleInterface()` on the app exposed via `module.api`.
- `module/macros/macros.json` — macro registry: `id`, `name`, `file`, `icon`. Ids are
  stable 16-character strings; icons are Foundry-relative URLs under
  `modules/foundry-homebrew/assets/images/`.
- `build.mjs` — compiles `macros.json` and the macro sources into the LevelDB pack at
  `module/packs/macros/`. Run via `npm run build`.
- `module/module.json` — `version`.

## Changes

### New: `module/macros/crawling-clock-macro.js`

```js
game.modules.get("foundry-homebrew").api.crawlingClock.toggleInterface();
```

### Modified: `module/macros/macros.json`

One entry: a fresh 16-character id not already in the file, name "The Crawling Clock",
`file` pointing at the new macro, and an icon from `assets/images/`.

### Modified: `module/module.json`

Bump `version`. This is the only version bump in the whole feature.

## Tests

None. See task 067.

## Verification

```bash
npm run build
```

1. `module/packs/macros/` rebuilds without errors.
2. In the dev world, the module's macro compendium shows "The Crawling Clock" with its
   icon.
3. Drag it to the hotbar and run it: the widget opens. Run it again: it closes.
4. Do the same as a **player**: the macro is visible to them, opens the widget, and the
   GM-only controls are not shown.
5. Delete any hand-made development macro so it does not shadow the packed one.
6. Confirm the existing macros in the pack still work (Random Encounter Check, The Lost
   Citadel: Random Encounter, Player Light Tracker, Light Adjuster).

Append a **Results (date):** line here after running.

## Pitfalls

- A macro already on a hotbar keeps its old command. If behaviour looks stale, that is
  almost always why.
- Reuse of an existing id in `macros.json` will collide with another macro. Pick a fresh
  one and check it against the file.
- Icon paths in `macros.json` are Foundry-relative URLs, not repo-relative paths.
- Never delete or move a git tag; increment the version instead.

## Acceptance criteria

- [ ] `npm run build` succeeds and the pack contains the new macro
- [ ] The macro opens and closes the widget for both GM and players
- [ ] Existing macros in the pack are unaffected
- [ ] `module.json` version bumped exactly once
- [ ] Development-only world macros cleaned up

## Scope boundaries

- **In scope**: the macro source, the `macros.json` entry, the version bump.
- **Out of scope**: the release itself (tag, GitHub release) if that is a separate manual
  step; any behaviour change to the widget.
