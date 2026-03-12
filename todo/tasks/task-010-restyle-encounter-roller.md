# Task 010: Restyle Scarlet Minotaur encounter roller to Shadowdark aesthetic

Independent of other tasks.

## Goal

Replace all inline CSS in the Scarlet Minotaur encounter roller with class-based styling in a dedicated CSS file, matching the dark Shadowdark aesthetic established by the Light Tracker. The dialog should feel like a sibling of the Light Tracker: pure black background, thematic typography, cohesive button hierarchy.

## Background

The encounter roller (`scarlet-minotaur-encounter-check.js`) currently uses inline CSS for everything — the dialog, info boxes, and buttons. Meanwhile the Light Tracker has a clean separation: semantic class names in JS and all styles in `styles/player-light-tracker.css`. The encounter roller should follow the same pattern.

The Light Tracker's visual language — pure black background, hidden window title, Blackletter headers, muted tones — defines what a "Shadowdark dialog" looks like in this module. The encounter roller currently uses default Foundry window chrome with a slightly transparent background, which looks out of place next to the Light Tracker.

### Visual changes

1. **Window chrome**: Pure black background, dark border, hidden window title — same treatment as `#player-light-tracker`.
2. **Title inside the dialog**: Move the title ("The Lost Citadel: Random Encounter" or similar) from the window bar into the dialog body, styled with Blackletter font like `.plt-header-title`.
3. **Help text**: The green info box explaining the 1d12 convenience roll is GM help text. Replace it with a small help/info toggle button (e.g. `?` or `ℹ` in the header). Clicking it shows/hides the explanation. Hidden by default to keep the dialog clean.
4. **Penalty box**: Replace the red/green inline styling with a dark, muted panel that fits the Shadowdark palette. Crimson tones are fine for the penalty-active state, but subdued — not raw `#ff6666`.
5. **Button hierarchy**:
   - 1d12 "Normal Check" — primary button: gold/amber border or highlight, clearly the default action.
   - 1d6 "Characters Made Noise" — secondary: muted, clearly available but not the default.
   - "1 - Encounter now" — debug/tertiary: small, dim, de-emphasized. Could be a text link or a very subtle button.
6. **Overall palette**: Black background, muted gold and crimson accents, `#999`/`#888` for secondary text. No bright greens or raw reds.

### What does NOT change

- Chat message styling (inline CSS in chat messages stays — Foundry chat doesn't load module CSS in the same way).
- Roll logic, penalty mechanics, encounter table — no behavioral changes.
- The ASCII art Minotaur chat message — that's already thematic.

## Context

- `macros/scarlet-minotaur-encounter-check.js` — the encounter roller ApplicationV2; all inline CSS lives here
- `styles/player-light-tracker.css` — reference for the Shadowdark dialog visual language
- `module.json` — will need to register the new CSS file

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Shared CSS file or separate? | Separate `styles/scarlet-minotaur.css` — the dialogs have different structure, sharing would couple them unnecessarily. Common patterns (window chrome, title) can be duplicated or extracted later if a third dialog appears. |
| Help text implementation? | A toggle button in the window header or dialog body. JS adds/removes a class to show/hide the help panel. No framework, just a click handler in `_onRender`. |
| Chat message styling? | Out of scope — chat messages keep inline CSS since module stylesheets may not apply in chat contexts. |

## Changes

### New: `styles/scarlet-minotaur.css`

Class-based styles for the encounter roller dialog:
- `#scarlet-minotaur-encounter` — window chrome override (black bg, dark border, hidden title)
- `.sme-window` — main content container
- `.sme-title` — Blackletter dialog title
- `.sme-help-toggle` — small info button
- `.sme-help-panel` / `.sme-help-visible` — collapsible help text
- `.sme-penalty-panel` — penalty display, with `.sme-penalty-active` modifier
- `.sme-btn-primary`, `.sme-btn-secondary`, `.sme-btn-debug` — button hierarchy
- Use `sme-` prefix (Scarlet Minotaur Encounter) to avoid collisions

### Modified: `macros/scarlet-minotaur-encounter-check.js`

- Replace all inline `style="..."` in `_renderHTML()` with class names
- Add help toggle button and click handler in `_onRender()`
- Keep all roll logic, chat messages, and settings unchanged

### Modified: `module.json`

- Add `styles/scarlet-minotaur.css` to the styles array

## Verification

1. Open Foundry with the module enabled
2. Run the Scarlet Minotaur encounter macro
3. Verify the dialog has a pure black background with no default Foundry chrome showing through
4. Verify the title appears inside the dialog body in Blackletter font
5. Verify the help text is hidden by default; clicking the help button reveals it
6. Verify the penalty display uses muted dark styling, shifts to crimson when penalty > 0
7. Verify button hierarchy is visually clear: 1d12 prominent, 1d6 secondary, encounter-now de-emphasized
8. Roll each button — verify all rolls and chat messages work exactly as before
9. Change the penalty dropdown — verify it still works and re-renders
10. Open the Light Tracker side by side — verify both dialogs feel like they belong to the same module

## Pitfalls

- `module.json` styles array: the CSS file must be listed there or Foundry won't load it. The macro itself can't load CSS.
- The macro is a standalone file in `macros/`, not part of the module's JS — it relies on the module being active for CSS to be available.
- Don't accidentally remove the `data-roll` and `data-action` attributes that the click handlers depend on.
- The help panel toggle must survive re-renders (the penalty dropdown triggers `this.render()`). Either persist the toggle state as a property on the app instance, or accept that help closes on re-render (acceptable since re-render only happens on penalty change).

## Acceptance criteria

- [ ] No inline `style="..."` attributes remain in `_renderHTML()` (dialog content only; chat messages excluded)
- [ ] `styles/scarlet-minotaur.css` exists with `sme-` prefixed classes
- [ ] `module.json` registers the new CSS file
- [ ] Dialog has pure black background matching the Light Tracker aesthetic
- [ ] Title appears inside the dialog body, not in the window chrome
- [ ] Help text is hidden by default, toggled by a button
- [ ] Penalty display uses muted Shadowdark-appropriate colors
- [ ] Button hierarchy is visually clear (primary / secondary / debug)
- [ ] All roll mechanics and chat messages are unchanged
- [ ] No behavioral regressions

## Scope boundaries

- **In scope**: Dialog styling, help toggle, CSS extraction, `module.json` update
- **Out of scope**: Chat message restyling, roll logic changes, 1d6-vs-1d12 roll mode option, Light Tracker changes
- **Do not** modify roll mechanics, encounter table, or chat message formatting
