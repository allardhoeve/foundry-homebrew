# Task 021: Remove chat output from encounter roller

Independent. No dependencies.

## Goal

Remove all chat message posting from the encounter roller. The roller becomes a GM-only tool — it rolls dice and shows results in the app window. The GM decides how to communicate encounters to players.

## Background

The current encounter roller auto-posts to chat: safe whispers, encounter cards, Minotaur drama, and debug breakdowns. This takes agency away from the GM — the moment a message appears, the narrative moment is locked in. The GM can't build tension gradually, describe a distant sound, or choose to handle it verbally. Removing chat output gives the GM full control over encounter communication.

## Context

- `module/src/scarlet-minotaur-encounter.js` — contains `_runCheck`, `_rollEncounterTable`, `_postMinotaurEncounter`, `_postEncounter`, `_postDebugInfo`
- `module/src/encounter-math.js` — `ENCOUNTERS` array (will be removed by task-023, but still present now)
- `module/styles/scarlet-minotaur.css` — chat message CSS classes (lines 182-339)
- `tests/features/encounter-roller.feature` — BDD tests (no chat assertions currently)
- `tests/unit/encounter-math.test.js` — unit tests (no chat references)

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Keep the "no encounter" whisper? | No. The GM sees the roll result in the app. A whisper adds no value. |
| Keep the Minotaur ASCII art? | Remove from chat. Could reuse in the results panel later, but that's a separate task. |
| What does `_runCheck` do on non-1? | Re-renders the roller. The GM saw the die and knows nothing happened. |
| What does `_rollEncounterTable` do? | Stores roll data in state for the results panel (task-022) to display. For now, just updates penalty and re-renders. |
| Keep flavor text arrays? | Remove `encounterMessages` and `safeMessages`. They were chat decoration. |

## Changes

### Modified: `module/src/scarlet-minotaur-encounter.js`

**Remove entirely:**
- `_postMinotaurEncounter()`, `_postEncounter()`, `_postDebugInfo()` — the three chat methods
- `encounterMessages`, `safeMessages` — flavor text arrays
- `MINOTAUR_ASCII` — ASCII art constant
- `escapeHtml()` — only used by the ASCII art
- `ENCOUNTERS` import from encounter-math (no longer needed without chat posting)

**Modify `_runCheck`:**
- On non-1 result: just return (or re-render). No whisper.
- On 1: delegate to `_rollEncounterTable` as before.

**Modify `_rollEncounterTable`:**
- Still rolls 1d8, applies penalty via `resolveEncounter`, updates penalty state.
- Remove the chat posting calls. For now, just re-renders the roller with the updated penalty.
- The results panel (task-022) will later intercept this to show the encounter.

**Update file header comment:**
- Remove the "Chat routing" section — no longer applicable.

### Modified: `module/styles/scarlet-minotaur.css`

**Remove the entire "Chat Messages" section** (lines 182-339):
- `.sme-chat-safe` and children
- `.sme-chat-minotaur` and children
- `.sme-chat-encounter` and children
- `.sme-chat-debug`

### Modified: `tests/features/encounter-roller.feature`

Review existing scenarios — none currently assert chat behavior, so no changes expected. Verify and confirm.

## Tests

- Existing unit tests: should still pass (no chat references)
- Existing BDD tests: should still pass (no chat assertions)
- No new tests needed — this is a removal task

## Verification

```bash
node --test tests/unit/encounter-math.test.js
npx playwright test tests/features/encounter-roller.feature
```

Manual: open encounter roller, click roll buttons, verify no chat messages appear.

**Results (2026-03-25):** Unit tests 6/6 pass. BDD feature file reviewed — no chat assertions exist, no changes needed. Grep confirmed no `ChatMessage` or `sme-chat-` references remain in the module source.

## Acceptance criteria

- [x] No `ChatMessage.create` calls remain in `scarlet-minotaur-encounter.js`
- [x] No chat CSS classes remain in `scarlet-minotaur.css`
- [x] Flavor text arrays and ASCII art are removed
- [x] Rolling still works (penalty updates, roller re-renders)
- [x] All existing tests pass
- [x] No dead imports remain

## Scope boundaries

- **In scope**: Removing all chat output and associated code/CSS
- **Out of scope**: Building the results panel (task-022), dynamic table lookup (task-023)
- **Do not** change the picker, roller UI, penalty logic, or settings registration
