# Task 023: Replace hardcoded ENCOUNTERS with dynamic table lookup

## Goal

Remove the hardcoded `ENCOUNTERS` array from `encounter-math.js` and instead load the encounter table at runtime from the world's rollable tables (`game.tables`). This avoids redistributing Shadowdark creative content in the module source.

## Background

The Shadowdark RPG Third-Party License does not allow reprinting roll tables. The current `ENCOUNTERS` array in `encounter-math.js` is a transcription of "The Lost Citadel: Random Encounters" — a creative roll table from the official Shadowdark quickstart adventure. The table becomes available in `game.tables` when the GM imports the adventure's rollable tables into the world.

The sub-tables for reaction, distance, and activity (Phase 2 of task 019) are in the `shadowdark.rollable-tables` compendium pack and can also be accessed dynamically.

## Context

- `module/src/encounter-math.js` — exports `ENCOUNTERS` array (8 strings), `calculateAdjustedResult`, `resolveEncounter`
- `module/src/scarlet-minotaur-encounter.js` — imports `resolveEncounter` from encounter-math (`ENCOUNTERS` import already removed by task-021)
- `tests/unit/encounter-math.test.js` — unit tests reference `ENCOUNTERS[n]` for assertions
- World table name: `"The Lost Citadel: Random Encounters"` (1d8, 8 results)
- World table available via: `game.tables.getName("The Lost Citadel: Random Encounters")`
- Each table result has a `.description` field containing the encounter text (HTML with `@UUID` links and `[[/r]]` inline rolls)

## Design decisions

| Question | Decision |
|----------|----------|
| Where does the table lookup happen? | In the encounter roller app (`scarlet-minotaur-encounter.js`), not in `encounter-math.js` — the math module stays pure (no Foundry dependency) |
| What if the table isn't imported? | Show a clear warning to the GM and refuse to roll. Don't silently fail. |
| Do we use `table.roll()` or look up by index? | Look up by index — the encounter roller manages its own d8 roll and penalty math. We just need the text for a given result number. |
| What about the `@UUID` and `[[/r]]` enrichment? | The table `.description` fields contain Foundry-enriched content (actor links, inline rolls). These should be passed through `TextEditor.enrichHTML()` before display in the results panel or chat. |
| What happens to unit tests? | `encounter-math.js` loses the `ENCOUNTERS` export. Unit tests for `calculateAdjustedResult` and `resolveEncounter` will pass an encounters array as a parameter instead of relying on the hardcoded one. |

## Changes

### Modified: `module/src/encounter-math.js`

- Remove the `ENCOUNTERS` array export
- `resolveEncounter` gains an `encounters` parameter — the caller provides the text array. The math module stays pure with no Foundry dependency.
- `calculateAdjustedResult` is unchanged

### Modified: `module/src/scarlet-minotaur-encounter.js`

- `ENCOUNTERS` import was already removed by task-021 — no import change needed

**New method — encounter table loader:**

**Contract**:
- Looks up the world table by name: `"The Lost Citadel: Random Encounters"`
- Returns an ordered array of encounter text strings (index 0 = result 1, etc.)
- Returns `null` when the table is not present in the world
- Table results may not be stored in order — ensure the returned array respects range ordering

**Integration with rolling:**
- Load encounters before rolling; pass the array to `resolveEncounter`
- If table not found: warn the GM with a notification and do not roll
- Minotaur detection is position-based (`adjustedResult === 1`), not content-based — it remains unchanged

### Modified: `tests/unit/encounter-math.test.js`

- Remove the `ENCOUNTERS` import — supply a local fixture array instead
- Update `resolveEncounter` calls to pass the fixture as the encounters argument

## Verification

```bash
# Unit tests still pass
node --test tests/unit/encounter-math.test.js

# BDD tests still pass (these run in Foundry where the table exists)
npx playwright test tests/features/encounter-roller.feature
```

Manual: open the encounter roller in Foundry, roll an encounter, verify the text comes from the world table.

## Acceptance criteria

- [ ] `ENCOUNTERS` array no longer exists in module source code
- [ ] `resolveEncounter` accepts an encounters array parameter
- [ ] Encounter roller loads encounter text from `game.tables.getName("The Lost Citadel: Random Encounters")` at runtime
- [ ] GM sees a clear warning if the table is not imported
- [ ] Unit tests pass using a test fixture array (no Shadowdark content in test files)
- [ ] Existing BDD tests still pass
- [ ] No Shadowdark encounter text remains hardcoded anywhere in the module

## Scope boundaries

- **In scope**: Replacing the hardcoded encounters array with dynamic lookup
- **Out of scope**: Phase 2 sub-rolls (reaction, distance, activity) — those are a separate task
- **Out of scope**: Enriching `@UUID` links and `[[/r]]` inline rolls — that's a presentation concern for the results panel (task 019)
- **Do not** change the penalty math or check die logic
