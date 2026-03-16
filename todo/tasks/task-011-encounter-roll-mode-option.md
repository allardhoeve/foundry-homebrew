# Task 011: Add roll mode option to encounter roller (1d6-only vs 1d6+1d12)

Depends on task-010 (styling should be done first so we're adding to the restyled dialog).

## Goal

Add a world setting that controls whether the encounter roller shows just the classic 1d6 button or both the 1d6 and the 1d12 convenience button. On first open (no setting stored yet), present a style picker screen so the GM makes an explicit choice. The setting can be changed later via a cog button in the dialog header (like the B&W toggle in the Light Tracker).

## Background

The standard Shadowdark random encounter check is 1d6 every other round: encounter on a 1. The 1d12 convenience option exists because it's easy to forget which rounds to roll on — rolling every round with 1d12 is mathematically equivalent and removes that bookkeeping. But some GMs prefer the cleaner 1d6-only presentation. This should be a preference, not a code change.

## Context

- `macros/scarlet-minotaur-encounter-check.js` — the encounter roller; currently hardcodes both buttons
- The macro already uses `game.settings` for the Minotaur penalty, so the pattern is established
- The Light Tracker has a B&W toggle button in the window header — same UX pattern for the cog button here

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Where does the setting live? | `game.settings` under the same `lost-citadel-macros` namespace, key `rollMode`. Values: `"both"` or `"d6-only"`. No default — unset triggers the first-run picker. |
| First-run experience? | When `rollMode` is not yet set, `_renderHTML()` renders a style picker screen instead of the normal roller. Two clear choices with brief descriptions explaining the difference. Picking one stores the setting and re-renders the normal dialog. |
| How to change later? | A cog/gear button in the window header (same pattern as the Light Tracker's B&W and compact toggles). Clicking it re-opens the style picker screen. |
| What happens in d6-only mode? | The 1d12 button is hidden. The 1d6 button becomes the primary button. The "Encounter now" debug button stays. |

## Changes

### Modified: `macros/scarlet-minotaur-encounter-check.js`

- Register a new setting `rollMode` with choices `"both"` and `"d6-only"`, no default (or a sentinel like `"unset"`)
- In `_renderHTML()`:
  - If `rollMode` is unset, render the first-run style picker (two options with descriptions)
  - Otherwise, render the normal roller with buttons based on the mode
- In `_onRender()`:
  - Wire up style picker choice buttons (store setting, re-render)
  - Wire up the cog header button to switch to picker mode
- Add `_injectHeaderButtons()` or equivalent to add the cog button to the window header (only shown when not in picker mode)
- When in `d6-only` mode, the 1d6 button takes the primary button style

### Modified: `styles/scarlet-minotaur.css` (from task-010)

- Styles for the picker screen (`.sme-picker`, `.sme-picker-option`, etc.)
- Style for the cog header button (`.sme-header-btn`, matching `.plt-header-btn` pattern)

## Verification

1. Clear the `rollMode` setting via the browser JS console: `game.settings.set("lost-citadel-macros", "rollMode", "unset")` — then open the macro
2. Verify the style picker appears with two clear options and descriptions
3. Pick "1d6 only" — verify the dialog re-renders with just 1d6 + debug buttons
4. Close and reopen — verify it remembers the choice (no picker)
5. Click the cog button in the header — verify the picker reappears
6. Switch to "both" — verify 1d12 (primary) + 1d6 (secondary) + debug appear
7. Roll each button — verify all rolls work as before
8. Refresh the browser — verify the setting persists

## Pitfalls

- The first-run picker and the normal roller are two different "views" in the same `_renderHTML()`. Keep a simple flag (e.g. `this._showPicker`) to control which renders, so the cog button can force picker mode without clearing the setting.
- The cog button should not appear while the picker is shown (no recursion).
- Re-rendering after a choice should also re-inject the header buttons.

## Acceptance criteria

- [ ] First open with no stored setting shows the style picker
- [ ] Choosing a mode stores the setting and renders the normal roller
- [ ] Cog button in header re-opens the style picker
- [ ] In `"both"` mode, dialog shows 1d12 (primary) + 1d6 (secondary) + debug
- [ ] In `"d6-only"` mode, dialog shows 1d6 (primary) + debug, no 1d12
- [ ] All roll mechanics unchanged
- [ ] Setting persists across refreshes

## Scope boundaries

- **In scope**: Roll mode setting, first-run picker, cog button, conditional button rendering
- **Out of scope**: Restyling (that's task-010), new roll types, player-facing options
- **Do not** change the encounter table, penalty mechanics, or chat message formatting
