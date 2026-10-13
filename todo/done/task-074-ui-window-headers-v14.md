# Task 074: Keep our window headers intact under Foundry 14.368

Independent of every other open task.

## Goal

Foundry 14 added a ⋮ controls menu (Detach / Attach) to every ApplicationV2 header. Our
dark windows laid their header out with `justify-content: space-between`, so the new
button landed in the middle of the Light Tracker's header. Fix the layout so it no longer
depends on which buttons Foundry adds, and catch the next change in a test.

## Background

- Every class built `DEFAULT_OPTIONS` with `mergeObject(super.DEFAULT_OPTIONS, …)`.
  ApplicationV2 already merges the inheritance chain (`_initializeApplicationOptions`),
  so array options were concatenated twice and Detach appeared twice in the menu.
- Light Tracker, Light Adjuster, Scarlet Minotaur and Asset Browser each carried a copy
  of the same frame override.
- Build 368 also broke the BDD login: admin auth moved to a form POST on `/auth`, the
  join form posts `username` + `userId`, and POSTs without an `Origin` header are
  rejected. Foundry 368 also requires Chromium 146+.

## Changes

- [x] `DEFAULT_OPTIONS` is a plain object in all six ApplicationV2 classes
- [x] New `module/styles/dark-window.css` (`fh-dark-window`): close first, its auto margin
      sends everything else to the right edge. Replaces the four copied blocks.
- [x] Tracker and Minotaur header buttons use Foundry's `header-control icon fa-solid`
      classes, as the Crawling Clock does; active state is `aria-pressed`
- [x] Detach stays available (Foundry default), listed once
- [x] `tests/support/global-setup.js` speaks the 368 login protocol
- [x] Playwright 1.64 (Chromium 156), playwright-bdd 9.2

## Tests

- [x] New `tests/features/window-headers.feature`: per window, no header button floats away
      from the edges, and the controls menu lists no entry twice. Fails 6 of 10 on the old
      code, passes 10 of 10 on the new.

## Pitfalls

- A new stylesheet in `module.json` only loads after the world is relaunched; Foundry reads
  the manifest at launch.
- Don't hold a Gamemaster session in another browser while the BDD suite runs: logins
  then hang until timeout (a 31 minute run instead of a few).
- `third_party/foundryvtt` is still build 360; refresh it from the container
  (`/home/node/resources/app`).

**Results (2026-10-13):** after a world relaunch, window-headers, player-light-tracker,
light-adjuster, encounter-roller, smoke and actor-visibility 56/56; unit 93/93. The full
BDD suite was not run.
