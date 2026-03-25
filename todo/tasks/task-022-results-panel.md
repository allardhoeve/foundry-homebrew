# Task 022: Results panel for encounter roller

Depends on task-021 (chat output removed).

## Goal

When an encounter is rolled, show a results panel in the app window. The panel displays the encounter, roll breakdown, and sub-roll context. The GM reads it, closes it, and runs the encounter however they choose.

## Background

With chat output removed (task-021), the results panel is the only way the GM sees what was rolled. It needs to show everything the GM needs to run the encounter: which encounter, the raw math, distance, activity, reaction, and treasure. The GM closes the panel when they're done — there's no "post" or "dismiss" distinction.

See `docs/ui-design-guide.md` for dark background, parchment text, blackletter titles, button tiers.

## Context

- `module/src/scarlet-minotaur-encounter.js` — main app, currently has two render modes (picker, roller)
- `module/src/encounter-math.js` — `resolveEncounter()`, `calculateAdjustedResult()`
- `module/styles/scarlet-minotaur.css` — app window styles
- `docs/scarlet-minotaur-encounter-design.md` — design philosophy

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| What triggers the panel? | `_rollEncounterTable` stores roll data and re-renders; render method detects the data and shows the panel |
| How does the GM leave? | A single "Done" button. Clears the stored data, updates penalty, re-renders to roller. |
| Does Minotaur get special treatment? | Yes — visual flourish in the panel when encounter 1 is the result. Details left to implementor. |
| Can the GM override the selection? | Yes — all 8 encounters listed and clickable. Rolled result pre-selected. |
| What about unreachable entries? | Visually muted based on penalty, but still clickable. |
| Does selecting Minotaur manually trigger the reset? | Yes — penalty resets to 0 if encounter 1 is selected when the GM clicks Done. |
| When does penalty update? | On Done, not when panel opens. |

## Changes

### Modified: `module/src/encounter-math.js`

**New exports — sub-roll resolution functions:**

Each takes a raw die result and returns `{ label: string, roll: number }`.

**`resolveDistance(d6Roll)`**
- 1d6 input. Maps to Close / Near / Far.

**`resolveActivity(twoD6Roll)`**
- 2d6 input. Maps to Hunting / Eating / Building/nesting / Socializing/playing / Guarding / Sleeping.

**`resolveReaction(twoD6Roll)`**
- 2d6 input. Maps to Hostile / Suspicious / Neutral / Curious / Friendly.
- Range extends below 2 and above 12 to accommodate future CHA modifier application.

**`resolveEncounter` signature change:**
- Gains an `encounters` parameter (array of strings) — the caller provides the list. Preparation for task-023 (dynamic table lookup). For now the app still passes `ENCOUNTERS`.

Source tables are in the Background section of `todo/tasks/task-019-gm-agency-sub-rolls.md`.

### Modified: `module/src/scarlet-minotaur-encounter.js`

**New state:**
- A field to hold pending roll data when the results panel is showing. Contains: raw d8, adjusted result, penalty at time of roll, selected index, check die info, and sub-roll results (distance, activity, reaction, treasure).

**New render mode — results panel:**

**Contract:**
- Shown when pending roll data exists
- Displays a blackletter title, roll breakdown line (raw d8, penalty, adjusted result), all 8 encounter entries as a clickable list, sub-roll summary, and a Done button
- Selected encounter highlighted, unreachable entries muted (use penalty to determine which are unreachable from the top)
- Minotaur selection gets distinct visual treatment — left to implementor's judgment

**Modified `_rollEncounterTable`:**
- Rolls d8 + sub-roll dice (1d6 distance, 2d6 activity, 2d6 reaction, 1d2 treasure)
- Resolves all rolls via encounter-math functions
- Stores everything in pending state, calls render

**New event handling for results panel:**
- Encounter row click: updates selected index, re-renders
- Done button: updates penalty (reset to 0 if Minotaur selected, else +2), clears pending state, re-renders to roller

### Modified: `module/styles/scarlet-minotaur.css`

Results panel styles. Follow the existing dark theme and naming conventions (`sme-` prefix, BEM). Key elements to style:
- Results info line (small, muted)
- Encounter list container and rows (clickable, with selected/unreachable states)
- Sub-roll summary line (compact, below encounter list)
- Done button

## Tests

### Extend `tests/unit/encounter-math.test.js`:

- `resolveDistance` — boundary values: 1 (Close), 2 (Near), 4 (Near), 5 (Far), 6 (Far)
- `resolveActivity` — boundary values: 2 (Hunting), 5 (Eating), 7 (Building/nesting), 9 (Socializing/playing), 11 (Guarding), 12 (Sleeping)
- `resolveReaction` — boundary values: 2 (Hostile), 7 (Suspicious), 9 (Neutral), 10 (Curious), 12 (Friendly)
- `resolveEncounter` with explicit encounters parameter

### Add BDD scenarios to `tests/features/encounter-roller.feature`:

**Assertion tests:**
- "Results panel appears when encounter is rolled" — trigger encounter, verify panel visible with encounter list and Done button
- "GM can override encounter selection" — trigger encounter, click a different row, verify selection changes
- "Done returns to roller" — trigger encounter, click Done, verify roller view restored
- "Done increments penalty" — trigger encounter, note penalty, click Done, verify penalty incremented
- "Minotaur selection resets penalty" — trigger encounter, select encounter 1, click Done, verify penalty is 0

**Eye tests:**
- "Results panel eye test" — capture panel DOM structure

## Verification

```bash
node --test tests/unit/encounter-math.test.js
npx playwright test tests/features/encounter-roller.feature
```

Manual in Foundry: trigger encounter via debug button, verify results panel shows encounter + sub-rolls + roll breakdown. Click Done, verify return to roller with updated penalty.

## Pitfalls

- `_onRender` now handles three modes (picker, roller, results). Keep branching clean.
- Penalty update must happen on Done, not on panel open — otherwise re-opening would double-count.
- Selected index is 1-based (matches encounter table), not 0-based.
- Sub-roll dice must all be rolled before storing state — use `Promise.all` or sequential awaits.

## Acceptance criteria

- [ ] Rolling an encounter shows the results panel instead of just re-rendering the roller
- [ ] All 8 encounters listed, rolled result pre-selected
- [ ] Unreachable entries visually muted but clickable
- [ ] GM can change selection by clicking a different row
- [ ] Sub-rolls (distance, activity, reaction, treasure) displayed in panel
- [ ] Minotaur selection gets distinct visual treatment
- [ ] Done returns to roller
- [ ] Penalty increments on Done (+2, or reset to 0 for Minotaur)
- [ ] Existing picker and roller modes still work
- [ ] Unit tests cover all sub-roll resolution functions at boundary values
- [ ] BDD tests cover panel appearance, selection, and Done behavior
- [ ] All existing tests still pass

## Scope boundaries

- **In scope**: Results panel UI, encounter override, sub-roll display, Done flow, penalty management, sub-roll math functions, tests
- **Out of scope**: Dynamic table lookup (task-023), clickable sub-roll overrides (future), CHA modifier application
- **Do not** change the picker or roller UIs beyond what's needed for the third render branch
