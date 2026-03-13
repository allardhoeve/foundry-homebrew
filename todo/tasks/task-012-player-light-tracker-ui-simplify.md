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

## Design decisions

- **Compact layout**: Option C — 24px portrait on left edge, status text centered in remaining space (title-card feel)
- **Character selector**: Overlay popup, triggered by hover AND click (supports tablet). Appears above the portrait, no layout shift.
- **Title bar hiding**: Pure CSS (`display: none` on `.window-title`), no ApplicationV2 API for this. Collapse still works because `.window-header` stays in DOM.
- **Douse removal**: Full removal — button, click handler, confirmation dialog, and all CSS. The logic is simple to re-add if ever needed.
- **Mockup**: `docs/mockups/compact-light-tracker-options.html`

## Changes

### Modified: `src/player-light-tracker.js`

**Both modes (full & compact):**
- [ ] Remove the "Douse my flame" button rendering and click handler
- [ ] Remove the douse confirmation dialog logic
- [ ] Remove the light source name text (e.g., "Oil, flask")

**Compact mode only:**
- [ ] Remove the "AMRIEL" character name label
- [ ] Render only active-character portrait (24px, circular) on the left
- [ ] Render status text centered in the remaining space
- [ ] Add hover+click popup overlay with all character portraits for switching
- [ ] Close popup on selection or clicking outside

### Modified: `styles/player-light-tracker.css`

- [ ] Remove `.plt-douse-btn`, `.plt-light-name`, `.plt-douse-confirm` styles
- [ ] Hide `.window-title` via CSS (visible only when collapsed)
- [ ] Add compact horizontal layout: portrait left, status text centered (Option C)
- [ ] Add popup overlay styles for character selector (absolute positioned above portrait)
- [ ] Add hover+click trigger for popup (`:hover` + `.popup-open` class toggle)

## Verification

1. Open Foundry with the module enabled
2. Open the Light Tracker in full mode — verify torch animation dominates, no douse button or light source name visible
3. Switch to compact mode — verify it shows only: small active portrait + status text, in a horizontal line
4. Hover/click the compact portrait — verify character selector appears with all tracked characters
5. Select a different character — verify it switches correctly
6. Verify no regressions in light tracking, timer behavior, or animation states

## Acceptance criteria

- [ ] "Douse my flame" button, handler, and confirmation dialog fully removed
- [ ] Light source name text is removed from both modes
- [ ] Window title hidden via CSS (visible only when collapsed)
- [ ] Compact mode has no character name label
- [ ] Compact mode: 24px portrait left, status text centered (Option C layout)
- [ ] Compact portrait hover+click opens overlay popup with all character portraits
- [ ] Popup closes on selection or outside click
- [ ] Torch animation remains the dominant visual in full mode
- [ ] No behavioral regressions

## Scope boundaries

- **In scope**: UI element removal, compact mode redesign, CSS cleanup
- **Out of scope**: Animation changes, light tracking logic, timer mechanics, DM view changes
- **Do not** modify roll mechanics, light duration calculations, or the torch animation itself
