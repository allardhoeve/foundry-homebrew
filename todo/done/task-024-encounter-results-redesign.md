# Task 024: Redesign encounter results panel

Depends on task-023 (dynamic encounter tables).

## Goal

Replace the flat encounter list with a focused results panel that presents the rolled encounter prominently, shows sub-roll context as tags, and offers a picker dialog to override the selection.

## Background

The original results panel showed all 8 encounters in a flat list with the selected one highlighted. This was busy, gave no guidance, and the enriched Foundry text (`@UUID`, `[[/r]]`) didn't fit in dropdown options. The redesign was prototyped as a mockup in `tests/visual-storybook/encounter-results-mockup.html`.

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| How to show the result? | Hero card with enriched encounter text via `TextEditor.enrichHTML()` |
| How to show sub-rolls? | Tag pills: Distance, Activity, Reaction, Treasure |
| Treasure tag when absent? | Show muted/disabled tag (`sme-tag--disabled` with strikethrough) — absence speaks through visual state, not missing elements |
| Minotaur treasure? | Always show Treasure tag (the axe) — never disabled |
| How to change encounter? | "Change" button opens a separate picker dialog with all 8 enriched encounters |
| How to show penalty in picker? | Banner at top ("Minotaur modifier: −4") + bold red "out of range" badges on affected rows |
| Picker row layout? | Flexbox with `__row-text` span + badge sibling; left accent border; inset amber glow on hover |

## Context

- `module/src/scarlet-minotaur-encounter.js` — main app, `_renderResults()` already partially updated (async, enrichHTML)
- `module/styles/scarlet-minotaur.css` — partially updated with hero card + tag styles
- `tests/visual-storybook/encounter-results-mockup.html` — final polished mockup with all three screens
- `docs/ui-design-guide.md` — design principles (restraint, single color signals, simplicity)

## Changes

### Modified: `module/src/scarlet-minotaur-encounter.js`

- `_renderResults()` — render hero card with enriched text, tag pills (always 4 slots: distance, activity, reaction, treasure), Change + Done buttons
- Treasure tag: show as normal when `data.treasure === true` or `data.selectedIndex === 1` (Minotaur); show with `sme-tag--disabled` class otherwise
- `_openEncounterPicker()` — open a `DialogV2` listing all encounters with enriched text, penalty banner, out-of-range badges. Clicking a row updates `_pendingRoll.selectedIndex` and re-renders the main window.
- Remove `_stripEnrichedText()` static method (no longer needed — dropdown is gone)

### Modified: `module/styles/scarlet-minotaur.css`

- Hero card: `.sme-hero`, `.sme-hero--minotaur`, `.sme-hero__encounter`, `.sme-hero__tags`
- Tag pills: `.sme-tag`, `.sme-tag--disabled` (muted + strikethrough)
- Action row: `.sme-results__actions` (flex, both buttons `flex: 1`)
- Picker dialog: `.sme-picker-dialog`, `.sme-picker-dialog__row`, `__row-text`, `--selected`, `--minotaur`
- Penalty banner: `.penalty-banner`
- Out-of-range badge: `.sme-out-of-range-badge`
- Picker row hover: inset amber glow from left border, no layout shift

### Modified: `tests/features/encounter-roller.feature`

- Update results panel scenarios for new structure (hero + tags + picker dialog instead of flat list)
- Remove unreachable-rows scenario (replaced by badge approach in picker)
- Add scenario for Change button opening picker dialog

### Modified: `tests/steps/encounter-roller.steps.js`

- Replace row-click steps with picker dialog steps
- Update eye test snapshot to capture hero text, tags, and picker state

## Tests

Extend `tests/features/encounter-roller.feature`:

- Results panel shows hero encounter text (not empty)
- Results panel shows 4 tag pills
- Change button opens picker dialog
- Picker dialog lists 8 encounters
- Selecting a picker row updates the hero and closes the dialog
- Done button returns to roller and updates penalty

Extend `tests/unit/encounter-math.test.js`:

- No changes expected — math logic is unchanged

## Verification

```bash
npm run test:unit
npm run test:generate
npx playwright test --config tests/playwright.config.js
```

Manual: open the encounter roller in Foundry, force an encounter, verify enriched text renders, click Change, pick a different encounter, verify hero updates.

## Acceptance criteria

- [ ] Hero card shows enriched encounter text (clickable links, rollable dice)
- [ ] Four tag pills always visible: Distance, Activity, Reaction, Treasure
- [ ] Treasure tag is muted/disabled when no treasure; always active for Minotaur
- [ ] Change button opens picker dialog with all 8 enriched encounters
- [ ] Picker dialog shows penalty banner when penalty > 0
- [ ] Out-of-range encounters show bold red badge in picker
- [ ] Selecting a picker row updates hero card and closes dialog
- [ ] Done button confirms selection and updates penalty setting
- [ ] All existing BDD and unit tests pass
- [ ] No inline CSS in JavaScript

## Scope boundaries

- **In scope**: results panel layout, picker dialog, tag pills, penalty display in picker
- **Out of scope**: roller screen changes, chat output, mode picker changes
- **Do not** modify encounter-math.js logic
