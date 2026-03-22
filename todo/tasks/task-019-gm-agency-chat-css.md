# Task 019: Move encounter chat inline CSS to classes

Independent of other tasks. Foundation for task-019-gm-agency-results-panel.

## Goal

Move all inline CSS from encounter roller chat messages into CSS classes in the stylesheet. Pure cleanup — no behavior change.

## Background

The project rule (CLAUDE.md) says "Avoid using in-line CSS in the JavaScript." The encounter roller's four chat message methods (`_postMinotaurEncounter`, `_postEncounter`, `_postDebugInfo`, and the no-encounter whisper in `_runCheck`) all use heavy inline styles. This needs fixing before we add more chat-related functionality.

## Context

- `module/src/scarlet-minotaur-encounter.js` — lines 260-416 contain four chat message methods with inline styles
- `module/styles/scarlet-minotaur.css` — existing stylesheet, currently only covers the app window (not chat messages)
- `docs/ui-design-guide.md` — "No inline CSS in JavaScript" principle

## Changes

### Modified: `module/styles/scarlet-minotaur.css`

Add chat message classes at the end of the file:

- `.sme-chat-safe` — no-encounter whisper (centered, muted colors)
- `.sme-chat-safe__title` — "RANDOM ENCOUNTER CHECK" heading
- `.sme-chat-safe__die` — die info line
- `.sme-chat-safe__result` — large result number
- `.sme-chat-safe__verdict` — "No Encounter" text
- `.sme-chat-safe__flavor` — italic flavor quote
- `.sme-chat-minotaur` — Minotaur encounter wrapper (dark gradient, red border)
- `.sme-chat-minotaur__subtitle` — "The Lost Citadel" small caps
- `.sme-chat-minotaur__name` — "THE SCARLET MINOTAUR" glowing title
- `.sme-chat-minotaur__art` — ASCII art pre block
- `.sme-chat-minotaur__divider` — horizontal rule
- `.sme-chat-minotaur__desc` — flavor description
- `.sme-chat-minotaur__quote` — atmospheric quote
- `.sme-chat-encounter` — standard encounter wrapper (centered)
- `.sme-chat-encounter__title` — "RANDOM ENCOUNTER" heading
- `.sme-chat-encounter__alert` — crossed swords line
- `.sme-chat-encounter__text` — encounter description (left-aligned, red border-left)
- `.sme-chat-encounter__flavor` — italic flavor quote
- `.sme-chat-debug` — debug whisper wrapper (small, gray, bordered)

### Modified: `module/src/scarlet-minotaur-encounter.js`

Replace inline `style="..."` attributes in each chat message method with the corresponding CSS classes. The HTML structure stays the same, only `style` attributes become `class` attributes.

## Tests

No new tests needed — this is a visual-only refactor. Existing BDD eye tests will confirm the chat messages still render (structure unchanged, only styling mechanism changes).

## Verification

```bash
npx playwright test tests/features/encounter-roller.feature
```

Also visually verify in Foundry that all four chat message types still look correct.

## Acceptance criteria

- [ ] No `style=` attributes remain in chat message HTML in `scarlet-minotaur-encounter.js`
- [ ] All four chat message types render visually identical to before
- [ ] Existing tests still pass
