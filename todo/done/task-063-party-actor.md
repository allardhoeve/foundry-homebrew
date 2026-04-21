# Task 063: Party Actor — a dashboard token for group play

Independent of other tasks.

## Goal

Add a "Party" Actor type to the homebrew module that serves as a GM dashboard for tracking party status during hex crawls and dungeon crawls. The Party actor can be placed as a token on a scene so the group moves as one unit instead of individual tokens.

## Background

Requested in Muttley/foundryvtt-shadowdark#1206. Building as a homebrew module first to iterate on the design before potentially upstreaming to the Shadowdark system.

The Party actor is a **read-only view** over its member Player actors. It does not own items or have its own HP/AC. It aggregates and displays information from the referenced players.

Key use cases:
1. **Move as a party** — one token on the scene instead of individual tokens, for when "time passes" and the group moves together without initiative.
2. **Hex crawl dashboard** — click the party token to see at a glance who needs healing, who's out of rations, who's affected by conditions.

### Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Where does this live? | Homebrew module, not the Shadowdark system |
| Does the Party actor own items? | No — it's a view over member actors |
| How are members managed? | Manual: drag Player actors onto the sheet to add, click X to remove |
| What data does the sheet show per member? | HP (current/max), rations count, light source count, active effects/conditions |
| Does it need its own HP/AC/slots? | No |
| Sheet base class? | `ActorSheetV2` — it's part of the V2 Application framework (extends `DocumentSheetV2` extends `ApplicationV2`), gives us document binding, permissions, and drag-drop routing for free |
| Visual style? | Follow the homebrew module's dark theme (see `docs/ui-design-guide.md`) |

## Context

- `module/module.json` — module manifest; needs `documentTypes.Actor.Party` added
- `module/src/module-ready.js` — existing init/ready hook pattern; Party registration goes in a new file loaded before this
- `module/src/asset-browser.js` — example of ApplicationV2 pattern used in this module (innerHTML-based rendering)
- `module/src/player-light-tracker.js` — example of reading Shadowdark light source data from actors; uses `actor.getActiveLightSources()` — reuse this approach
- `styles/` — CSS files per feature, dark theme, no inline CSS
- `docs/ui-design-guide.md` — dark background, parchment text, blackletter titles, amber buttons
- `tests/features/` — BDD feature files with Playwright
- `third_party/foundryvtt-14.360/` — Foundry source for API reference (ActorSheetV2, TypeDataModel, field types)

## Changes

### New: `module/src/party-actor.js`

Contains the data model, sheet, and init hook registration.

**PartyDataModel** — extends `TypeDataModel`. Schema stores member references (array of actor UUIDs) and GM notes (HTML). Registered on `CONFIG.Actor.dataModels.Party` in the init hook.

**PartySheet** — extends `ActorSheetV2`.

Sheet content:
- Header with party portrait and editable name
- Member cards: one per member showing name, portrait, HP (current/max), rations count, light source count, active effect icons
- Empty state with drag-and-drop hint when no members are present
- GM notes section

Behavioral requirements:
- Clicking a member name opens their character sheet
- Dropping a Player actor onto the sheet adds them as a member; duplicate actors are silently ignored
- Clicking X on a member card removes them from the party
- The sheet must re-render when member actor data changes (HP, effects, items) — not just when the Party actor itself is updated
- Members whose UUIDs no longer resolve are silently skipped

Use `ActorSheetV2`'s built-in drag-drop routing (`_onDropActor`) rather than manual DOM event wiring.

For light source data, use `actor.getActiveLightSources()` consistent with `player-light-tracker.js`.

### New: `styles/party-actor.css`

Styles following the homebrew dark theme and `docs/ui-design-guide.md` conventions:
- Member cards with subtle borders
- HP coloring: normal, damaged (warm), dead (red)
- Effect icons displayed inline
- Empty state styling

### Modified: `module/module.json`

- Add `documentTypes.Actor.Party`
- Add `party-actor.js` to `esmodules` (before `module-ready.js`)
- Add `party-actor.css` to `styles`

## Tests

### BDD

Add `tests/features/party-actor.feature`:

- Smoke: Party actor can be created from the sidebar and opened
- Members can be added by drag-and-drop
- Duplicate drag-and-drop does not create duplicate members
- Member data (HP, effects) is displayed correctly
- Members can be removed via X button
- Empty state shows hint text

### Unit

Unit tests for member data aggregation logic if rations/light source counting has edge cases worth covering (e.g., stashed items excluded, zero quantities, missing items).

## Verification

```bash
# Existing tests still pass
npx playwright test tests/features/smoke.feature

# Party-specific tests
npx playwright test tests/features/party-actor.feature

# Manual: create Party actor, drag players onto it, verify data display, place token on scene
```

## Pitfalls

- **Rations detection is name-based** — the Shadowdark data model has no item subtype for rations, so detection relies on the item name. Will silently show 0 for renamed or translated items. No better approach exists currently.
- **Token defaults** — the Party actor should have sensible prototype token defaults (no vision, no movement attributes). It's a group marker, not a character.
- **Module dependency** — the Party actor type only exists when the module is enabled. Disabling the module makes existing Party actors inaccessible (Foundry shows a warning for unknown types). This is standard module behavior.
- **Reactivity scope** — listening for member data changes means hooking into actor updates and effect changes. Be deliberate about which hooks to register and unregister to avoid stale listeners or performance issues.

## Acceptance criteria

- [ ] Party actor type can be created from the Actors sidebar
- [ ] Party sheet opens with the dark homebrew theme
- [ ] Player actors can be dragged onto the sheet to add as members
- [ ] Dragging the same actor again does not create a duplicate
- [ ] Members can be removed via X button
- [ ] Per-member display shows: name, portrait, HP (current/max), rations count, light source count, active effect icons
- [ ] Clicking a member name opens their character sheet
- [ ] Sheet updates when a member's HP, effects, or inventory changes
- [ ] Party actor token can be placed on a scene (works on both hex and square grids)
- [ ] Empty state shows drag-and-drop hint
- [ ] GM notes field is functional
- [ ] All existing tests still pass
- [ ] New BDD tests pass

## Scope boundaries

- **In scope**: Party actor type, sheet, member management, read-only dashboard display, scene token
- **Out of scope**: automatic member detection (e.g., "all active players"), item transfer between party and members, vehicle support, player-specific simplified view, initiative/combat integration
- **Do not** modify the Shadowdark system code — this is a standalone module
