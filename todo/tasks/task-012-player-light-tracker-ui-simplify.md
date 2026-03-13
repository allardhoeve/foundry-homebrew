# Task 012: Simplify Player Light Tracker UI

Independent of other tasks.

## Goal

Strip the Light Tracker UI down to its essentials: the torch animation is the centerpiece, and everything else either supports it or gets removed. Compact mode becomes a single-line status glance.

## Background

Design review revealed too many elements competing with the torch animation in full mode, and compact mode losing the animation while keeping all the scaffolding. The UI should communicate light state through atmosphere, not chrome.

See `docs/player-light-tracker-design.md` for the full design philosophy.

## Context

- `src/player-light-tracker.js` — ApplicationV2 subclass; renders both full and compact mode HTML
- `styles/player-light-tracker.css` — all Light Tracker styles, including `.plt-douse-btn`, `.plt-light-name`, `.plt-douse-confirm`
- `docs/player-light-tracker-design.md` — design philosophy document for this tracker

## Changes

### Modified: `src/player-light-tracker.js`

**Both modes (full & compact):**
- [ ] Remove the "Douse my flame" button rendering
- [ ] Remove the light source name text (e.g., "Oil, flask")

**Compact mode only:**
- [ ] Remove the "Light Tracker" title (redundant with window header)
- [ ] Remove the "AMRIEL" character name label
- [ ] Replace the portrait row with a single active-character portrait next to the status text (horizontal layout)
- [ ] On hover/click of the portrait, expand to show all character portraits for switching

### Modified: `styles/player-light-tracker.css`

- [ ] Remove `.plt-douse-btn`, `.plt-light-name`, `.plt-douse-confirm` styles
- [ ] Add compact horizontal layout styles (portrait + status text in one line)
- [ ] Add portrait hover/expand interaction for character selector

## Verification

1. Open Foundry with the module enabled
2. Open the Light Tracker in full mode — verify torch animation dominates, no douse button or light source name visible
3. Switch to compact mode — verify it shows only: small active portrait + status text, in a horizontal line
4. Hover/click the compact portrait — verify character selector appears with all tracked characters
5. Select a different character — verify it switches correctly
6. Verify no regressions in light tracking, timer behavior, or animation states

## Acceptance criteria

- [ ] "Douse my flame" button is removed from both modes
- [ ] Light source name text is removed from both modes
- [ ] Compact mode has no title or character name label
- [ ] Compact mode displays active portrait + status text in a single horizontal line
- [ ] Compact portrait hover/click reveals character selector for switching
- [ ] Torch animation remains the dominant visual in full mode
- [ ] All light tracking mechanics are unchanged
- [ ] No behavioral regressions

## Scope boundaries

- **In scope**: UI element removal, compact mode redesign, CSS cleanup
- **Out of scope**: Animation changes, light tracking logic, timer mechanics, DM view changes
- **Do not** modify roll mechanics, light duration calculations, or the torch animation itself
