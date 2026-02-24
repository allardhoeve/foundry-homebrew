# Lost Citadel: Scarlet Minotaur Random Encounter — Design Notes

## Source Material

### The Scarlet Minotaur Rule

> Each time you roll on the Random Encounters table after the first, apply a cumulative -2 to
> the result (treat results below 1 as 1). Reset this count each time an encounter with the
> Scarlet Minotaur occurs.

### Table: The Lost Citadel Random Encounters (d8)

| d8 | Encounter |
|----|-----------|
| 1  | The Scarlet Minotaur (Area 18) stalks into sight, bellowing challenges and pawing the stone |
| 2  | 1d4 ettercaps and 1d8 beastmen clash in a bloody melee |
| 3  | A dry gust of wind extinguishes all torches and lamps |
| 4  | 1d6 ettercaps creep along, searching for gold and gems |
| 5  | The skeletons of 1d6 dead adventurers or warrior-mages stagger into sight |
| 6  | 2d4 beastmen argue in hushed whispers over who gets to eat the centipedes they just trapped in a bag |
| 7  | 1d4 darkmantles swoop out, bobbing and spinning in a territorial warning dance |
| 8  | A cave creeper rushes along the ceiling toward light |

## Why a Macro Instead of a Rollable Table

Foundry's RollTable does not support injecting a variable modifier into the roll formula at
draw time. The cumulative -2 Minotaur penalty cannot be stored and applied automatically by
the table itself. A macro gives full control over:

- Persisting the penalty counter across sessions
- Applying the penalty before the lookup
- Resetting the counter on a Minotaur result
- Posting different messages to GM vs. public chat

## Macro Structure

### Persistent State

`game.settings` with `scope: "world"` stores the current penalty. Registered inline at macro
run time (guarded against double-registration). Persists across refreshes and is shared
between GMs on the same world.

### UI (ApplicationV2)

Three roll buttons, plus a status line showing the current penalty and a manual reset button:

- **1d12 — Normal Check** — standard cadence
- **1d6 — Characters Made Noise** — danger cadence
- **1d1 - Always give a random encounter - for if you want an instant encounter with increasing penalty
- Penalty display: styled red when penalty > 0, neutral when 0
- Reset button: manual override for edge cases

The window is a singleton registered on `game.scarletMinotaurEncounterApp`.

### Check Roll Flow

1. Roll the chosen die.
2. If result > 1 → no encounter; post safe message **whispered to GM only**.
3. If result = 1 → roll on the encounter table.

### Encounter Table Roll

1. Roll 1d8.
2. Subtract current penalty, clamp to minimum 1.
3. Look up result in the hardcoded `ENCOUNTERS` array (0-indexed, result 1 = index 0).
4. Update penalty:
   - Scarlet Minotaur (adjusted result = 1) → reset penalty to 0
   - Any other result → penalty += 2
5. Post encounter to **public chat** (dramatic styling for Minotaur, standard for others).
6. Post debug breakdown **whispered to GM** (raw d8, penalty applied, adjusted result,
   old and new penalty values).
7. Re-render the window to reflect the updated penalty.

### Penalty Logic

Store the penalty to apply to the *next* table roll (not the current one):

| Roll # | Stored penalty before roll | Applied | Stored after (no Minotaur) |
|--------|---------------------------|---------|---------------------------|
| 1st    | 0                         | −0      | 2                         |
| 2nd    | 2                         | −2      | 4                         |
| 3rd    | 4                         | −4      | 6                         |
| Minotaur | any                     | −any    | 0 (reset)                 |

### Chat Message Routing

| Event            | Audience      | Style                                      |
|------------------|---------------|--------------------------------------------|
| No encounter     | GM (whisper)  | Muted, safe flavor text                    |
| Encounter (non-Minotaur) | Public | Red, encounter text, flavor quote        |
| Scarlet Minotaur | Public        | Dramatic dark styling, large bold text     |
| Debug info       | GM (whisper)  | Plain monospace breakdown of all roll values |
