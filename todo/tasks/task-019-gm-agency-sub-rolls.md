# Task 019: Add sub-rolls to encounter results panel

Depends on task-019-gm-agency-results-panel.

## Goal

When an encounter is rolled, automatically roll distance, activity, reaction, and treasure alongside the d8. Display them as a compact summary line in the results panel so the GM has the full picture at a glance.

## Background

The random encounter rules (Shadowdark) call for additional rolls when creatures appear: how far away they are, what they're doing, their disposition, and whether they carry treasure. Rolling these automatically saves the GM from consulting tables mid-session.

Source tables (from rulebook):

**Distance** (1d6): 1=Close, 2-4=Near, 5-6=Far

**Activity** (2d6): 2-4=Hunting, 5-6=Eating, 7-8=Building/nesting, 9-10=Socializing/playing, 11=Guarding, 12=Sleeping

**Reaction** (2d6 + CHA mod): 0-6=Hostile, 7-8=Suspicious, 9=Neutral, 10-11=Curious, 12+=Friendly
- CHA mod not applied automatically (don't know who interacts first)
- Raw 2d6 roll shown so GM can gauge degree within a band

**Treasure**: 50% chance (1d2 or equivalent)

## Context

- `module/src/encounter-math.js` — pure logic module, will hold the new resolution functions
- `module/src/scarlet-minotaur-encounter.js` — results panel (from prior task) where sub-rolls will be displayed
- `module/styles/scarlet-minotaur.css` — styling for the summary line

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Show sub-rolls for non-creature encounters? | Yes, always show. GM ignores what doesn't apply |
| Roll embedded dice (1d4 ettercaps etc.)? | No, leave as notation. GM rolls those separately |
| Override UI for sub-rolls? | Informational for now. Future: clickable to cycle states |
| Where in the panel? | Compact summary line below encounter list, above action buttons |

## Changes

### Modified: `module/src/encounter-math.js`

Add three resolution functions and their tables:

```javascript
const DISTANCE_TABLE = [
    { range: [1, 1], label: "Close" },
    { range: [2, 4], label: "Near" },
    { range: [5, 6], label: "Far" }
];

const ACTIVITY_TABLE = [
    { range: [2, 4],   label: "Hunting" },
    { range: [5, 6],   label: "Eating" },
    { range: [7, 8],   label: "Building/nesting" },
    { range: [9, 10],  label: "Socializing/playing" },
    { range: [11, 11], label: "Guarding" },
    { range: [12, 12], label: "Sleeping" }
];

const REACTION_TABLE = [
    { range: [0, 6],   label: "Hostile" },
    { range: [7, 8],   label: "Suspicious" },
    { range: [9, 9],   label: "Neutral" },
    { range: [10, 11], label: "Curious" },
    { range: [12, 99], label: "Friendly" }
];

export function resolveDistance(d6Roll) {
    const entry = DISTANCE_TABLE.find(e => d6Roll >= e.range[0] && d6Roll <= e.range[1]);
    return { label: entry.label, roll: d6Roll };
}

export function resolveActivity(twoD6Roll) {
    const entry = ACTIVITY_TABLE.find(e => twoD6Roll >= e.range[0] && twoD6Roll <= e.range[1]);
    return { label: entry.label, roll: twoD6Roll };
}

export function resolveReaction(twoD6Roll) {
    const entry = REACTION_TABLE.find(e => twoD6Roll >= e.range[0] && twoD6Roll <= e.range[1]);
    return { label: entry.label, roll: twoD6Roll };
}
```

### Modified: `module/src/scarlet-minotaur-encounter.js`

**In `_rollEncounterTable`:** Roll three additional dice alongside the d8:
- `new Roll("1d6").evaluate()` → distance
- `new Roll("2d6").evaluate()` → activity
- `new Roll("2d6").evaluate()` → reaction
- `new Roll("1d2").evaluate()` → treasure (1 = yes, 2 = no)

Store results in `_pendingEncounter.subRolls`:
```javascript
{
    distance: { label: "Near", roll: 3 },
    activity: { label: "Hunting", roll: 4 },
    reaction: { label: "Hostile", roll: 5 },
    hasTreasure: true
}
```

**In `_renderResults`:** Add a summary line below the encounter list:

```html
<div class="sme-sub-rolls">
    Distance: <strong>Near</strong> (3) ·
    Activity: <strong>Hunting</strong> (4) ·
    Reaction: <strong>Hostile</strong> (5) ·
    <strong>Treasure</strong>
</div>
```

When `hasTreasure` is false, show "No treasure" in muted text.

### Modified: `module/styles/scarlet-minotaur.css`

```css
.sme-sub-rolls {
    font-size: 11px;
    color: #999;
    text-align: center;
    padding: 8px 10px;
    margin-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    line-height: 1.6;
}

.sme-sub-rolls strong {
    color: #e8dcc8;
}
```

## Tests

### Extend `tests/unit/encounter-math.test.js`:

- `resolveDistance(1)` → `{ label: "Close", roll: 1 }`
- `resolveDistance(3)` → `{ label: "Near", roll: 3 }`
- `resolveDistance(6)` → `{ label: "Far", roll: 6 }`
- `resolveActivity(2)` → `{ label: "Hunting", roll: 2 }`
- `resolveActivity(7)` → `{ label: "Building/nesting", roll: 7 }`
- `resolveActivity(12)` → `{ label: "Sleeping", roll: 12 }`
- `resolveReaction(2)` → `{ label: "Hostile", roll: 2 }`
- `resolveReaction(9)` → `{ label: "Neutral", roll: 9 }`
- `resolveReaction(12)` → `{ label: "Friendly", roll: 12 }`

## Verification

```bash
node --test tests/unit/encounter-math.test.js
```

Manual in Foundry: trigger encounter, verify sub-rolls summary line appears with reasonable values.

## Acceptance criteria

- [ ] Distance, activity, reaction, treasure rolled automatically when encounter triggers
- [ ] Summary line appears in results panel with labels and raw rolls
- [ ] "No treasure" shown in muted style when treasure roll fails
- [ ] Unit tests cover all table lookups including boundary values
- [ ] All existing tests still pass

## Scope boundaries

- **In scope**: Rolling and displaying sub-rolls, pure math functions, summary line styling
- **Out of scope**: Clickable overrides for sub-rolls (future enhancement), CHA mod application, suppressing sub-rolls for non-creature encounters
