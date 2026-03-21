# Task 016: BDD Step Definitions

Depends on task-013 (scaffold), task-014 (API integration).

## Goal

Implement the full step definition library for testing the three module features (Player Light Tracker, Encounter Roller, Light Adjuster) plus shared game-state steps. After this task, feature files for each macro can be written using a well-organized step library, and a contributor guide documents how to add new tests.

## Background

Task 013 scaffolds the test infrastructure with a smoke test. This task adds the domain-specific step definitions that make it possible to write meaningful BDD scenarios for the module's features. Steps are organized by scope: common (game state), then one file per macro.

## Context

- `module/src/player-light-tracker.js` — ApplicationV2; reads `item.system.light.{remainingSecs, longevityMins, active, isSource}`; states: bright (>50%), good (>25%), fading; also party light; registered at `module.api.lightTracker`
- `module/src/scarlet-minotaur-encounter.js` — ApplicationV2; roll mode picker, encounter check, penalty tracking via `game.settings`; registered at `module.api.scarletMinotaurEncounter`
- `module/src/light-adjuster.js` — ApplicationV2; GM-only; adjusts `remainingSecs` on all active lights; registered at `module.api.lightAdjuster`
- `tests/steps/common.steps.js` — from task 013, has `Given I am logged in as Gamemaster`
- `tests/support/fixtures.js` — from task 013, has `foundryPage` and `consoleErrors`

## Design decisions (resolved — updated to reflect implementation)

| Question | Decision |
|----------|----------|
| Step file organization | One file per scope: `common.steps.js` (shared), `light-tracker.steps.js`, `light-sources.steps.js` (split from common), plus future per-macro files |
| Fixture pattern | `session` (mutable holder) and `storageStatePaths` — replaces originally planned `foundryPage`/`consoleErrors` |
| Actor approach | Fixed pre-existing actors in the test world, modified via item updates — no actor creation/deletion lifecycle |
| Game state manipulation | Via `page.evaluate()` calling Foundry's document API (`item.update()`, `game.settings.set()`) |
| App interaction | Open via `page.evaluate()` calling `module.api.<app>.toggleInterface()`; interact via DOM selectors |
| Cleanup | Cross-scenario contamination fixed via state reset in Before hooks (commit f11fdf2) — no After cleanup hook needed |
| Multi-user auth | Global setup authenticates Gamemaster, Player1, Player2 with per-user storageState files |
| Login implies infra | `Given I am logged in as Gamemaster` is the highest-level precondition; implies Docker, world, canvas |

## Changes

### Modified: `tests/steps/common.steps.js`

Expand with shared game-state steps. These are reusable across all feature files.

**Login & identity:**
- `Given I am logged in as Gamemaster` — (already exists from task 013) verifies in-game state
- `Given I am logged in as a player` — needs a second storageState or join as player; verify non-GM

**Actor & light state (arranged via Foundry API in `page.evaluate()`):**
- `Given Actor {string} has lit a torch` — find or create actor, create/activate a torch item with `light.active: true`, `light.isSource: true`, full `remainingSecs`
- `Given Actor {string} has lit a spell light` — same but with spell type
- `Given Actor {string}'s light source has {int}:{int} remaining` — update `system.light.remainingSecs` on the active light item (mm:ss parsed to seconds)
- `Given Actor {string} has no active light source` — deactivate or delete light items
- `Given no actors have active light sources` — deactivate all

**Settings state:**
- `Given the Minotaur penalty is {int}` — `game.settings.set("foundry-homebrew", "minotaurPenalty", n)` via `page.evaluate()`
- `Given the encounter roll mode is {string}` — `game.settings.set("foundry-homebrew", "rollMode", mode)` via `page.evaluate()`

**Assertions (shared):**
- `Then there should be no console errors` — (already exists from task 013)
- `Then the module {string} should be active` — (already exists from task 013)

### New: `tests/steps/light-tracker.steps.js`

Steps specific to the Player Light Tracker UI.

**Actions:**
- `When I open the Player Light Tracker` — `module.api.lightTracker.toggleInterface()` via `page.evaluate()`
- `When I close the Player Light Tracker` — same toggle
- `When I select character {string} in the light tracker` — click `.plt-character-btn` matching actor name
- `When I toggle compact mode` — click the resize header button
- `When I toggle black and white mode` — click the B&W header button

**Assertions:**
- `Then the light status should read {string}` — assert `.plt-status-text` text content
- `Then the light state should be {string}` — assert `.plt-window` has class `plt-state-{state}` (bright/good/fading/darkness/party-bright/party-good/party-fading)
- `Then the tracker should show party light` — assert state class starts with `plt-state-party-`
- `Then the tracker should be in compact mode` — assert `#player-light-tracker.plt-compact`
- `Then the Player Light Tracker should be visible` — assert `#player-light-tracker` is visible
- `Then the Player Light Tracker should not be visible` — assert hidden/absent

### New: `tests/steps/encounter-roller.steps.js`

Steps specific to the Encounter Roller UI.

**Actions:**
- `When I open the Encounter Roller` — `module.api.scarletMinotaurEncounter.toggleInterface()` via `page.evaluate()`
- `When I close the Encounter Roller` — same toggle
- `When I select roll mode {string}` — click `.sme-picker-option[data-mode="{mode}"]`
- `When I roll a normal encounter check` — click `button[data-roll="1d12"]`
- `When I roll a noise encounter check` — click `button[data-roll="1d6"]`
- `When I force an encounter` — click `button[data-roll="1d1"]`
- `When I set the encounter penalty to {int}` — change `.sme-penalty-select` value

**Assertions:**
- `Then the Encounter Roller should be visible` — assert `#scarlet-minotaur-encounter` is visible
- `Then the Encounter Roller should show the roll mode picker` — assert `.sme-picker` is visible
- `Then the Encounter Roller should show the roller` — assert `.sme-button-grid` is visible
- `Then the encounter penalty display should show {int}` — assert `.sme-penalty-select` selected value
- `Then a GM whisper should contain {string}` — find whispered chat message with matching text
- `Then a public chat message should contain {string}` — find non-whisper chat message with matching text

### New: `tests/steps/light-adjuster.steps.js`

Steps specific to the Light Adjuster UI.

**Actions:**
- `When I open the Light Adjuster` — `module.api.lightAdjuster.toggleInterface()` via `page.evaluate()`
- `When I close the Light Adjuster` — same toggle
- `When I adjust light timers by {string}` — click the matching `button[data-delta]` (parse "+10 min" / "-1 min" to delta value)

**Assertions:**
- `Then the Light Adjuster should be visible` — assert `#light-adjuster` is visible
- `Then the adjuster status should read {string}` — assert `.la-status` text
- `Then the timer summary should mention {string}` — assert `.la-timers` contains text

### New: `tests/features/light-tracker.feature`

Example feature file to validate the step library works:

```gherkin
Feature: Player Light Tracker

  Background:
    Given I am logged in as Gamemaster

  Scenario: Tracker shows bright light for a fresh torch
    Given Actor "Torch Bearer" has lit a torch
    When I open the Player Light Tracker
    Then the light state should be "bright"
    And the light status should read "Your light shines brightly"

  Scenario: Tracker shows fading when torch is nearly out
    Given Actor "Torch Bearer" has lit a torch
    And Actor "Torch Bearer"'s light source has 10:00 remaining
    When I open the Player Light Tracker
    Then the light state should be "fading"

  Scenario: Tracker shows darkness with no light
    Given Actor "Torch Bearer" has no active light source
    When I open the Player Light Tracker
    Then the light state should be "darkness"
```

### New: `tests/features/encounter-roller.feature`

```gherkin
Feature: Encounter Roller

  Background:
    Given I am logged in as Gamemaster
    And the encounter roll mode is "both"
    And the Minotaur penalty is 0

  Scenario: Roller opens with correct initial state
    When I open the Encounter Roller
    Then the Encounter Roller should be visible
    And the encounter penalty display should show 0

  Scenario: Forcing an encounter increments penalty
    When I open the Encounter Roller
    And I force an encounter
    Then a public chat message should contain "RANDOM ENCOUNTER"
```

### New: `tests/features/light-adjuster.feature`

```gherkin
Feature: Light Adjuster

  Background:
    Given I am logged in as Gamemaster

  Scenario: Adjusting timers with active lights
    Given Actor "Torch Bearer" has lit a torch
    When I open the Light Adjuster
    And I adjust light timers by "-10 min"
    Then the adjuster status should read "Adjusted 1 light on 1 actor by −10m"
    And the timer summary should mention "Torch Bearer"
```

### New: `tests/support/cleanup.js`

After-hook that runs after each scenario to reset game state:

- Delete any actors created during the scenario (tracked via a fixture array)
- Reset encounter settings to defaults
- Close any open application windows

### New: `docs/WRITING-TESTS.md`

Contributor guide for writing BDD tests. Content described in Step 2 below.

## Step 2: Contributor guide (`docs/WRITING-TESTS.md`)

A practical guide so that future work (human or agent) doesn't re-explore from scratch.

### Content outline

**How tests are structured:**
- Feature files in `tests/features/` — one per module feature
- Step definitions in `tests/steps/` — `common.steps.js` for shared steps, one file per macro
- All step files import `test` from `tests/support/fixtures.js` and use `createBdd(test)`

**Writing a new feature file:**
- Start with `Background: Given I am logged in as Gamemaster` (or player)
- Use existing steps from the library (list them or point to `tests/steps/`)
- Arrange game state with Given steps, act with When steps, assert with Then steps

**Adding a new step:**
- Common/game-state steps → `common.steps.js`
- Macro-specific steps → `<macro-name>.steps.js`
- Steps manipulate game state via `page.evaluate()` calling Foundry's document API
- Steps interact with UI via Playwright selectors on the app's DOM
- Never put infrastructure concerns (Docker, login, canvas) in step definitions — that's handled by fixtures and global setup

**Available fixtures:**
- `foundryPage` — already logged in, canvas ready, use for all `page.evaluate()` and DOM interaction
- `consoleErrors` — auto-collected, assert with `Then there should be no console errors`

**Step naming conventions:**
- Given = arrange game state (actors, items, settings)
- When = user action (open app, click button, toggle setting)
- Then = assertion (UI state, chat messages, game state)
- Use quotes for variable strings: `{string}`; bare `{int}` for numbers

**Cleanup:**
- Actors created in steps are tracked and deleted after each scenario
- Settings are reset to defaults after each scenario
- App windows are closed after each scenario

**Running tests:**
- `npm test` — headless
- `npm run test:headed` — watch the browser
- `npm run test:debug` — Playwright inspector
- Docker must be running first

**Common mistakes:**
- Don't write `Given the canvas is ready` — it's implicit in the fixture
- Don't write `Given Docker is running` — that's infrastructure, not BDD
- Don't manipulate DOM directly for state changes — use `page.evaluate()` with Foundry's API
- Don't forget cleanup — if a step creates an actor, register it for cleanup

## Verification

```bash
# Run all feature files
npm test

# Run a single feature
npx playwright test --grep "Light Tracker"

# Headed mode to visually verify
npm run test:headed
```

## Pitfalls

- **Actor creation via API** — Foundry's `Actor.create()` in `page.evaluate()` returns a promise. Steps must `await` the result. The created actor ID must be tracked for cleanup.
- **Light source item schema** — the exact shape of `system.light` may vary by game system. Test against the actual Shadowdark system schema in the test world. Research the exact field paths before implementing.
- **Chat message assertions** — chat messages are async. Steps that assert on chat content may need a short wait or poll for the message to appear in the DOM.
- **Encounter roller randomness** — the normal/noise check rolls are random. Only the "force encounter" button (`1d1`) gives a deterministic result. Feature files should use forced encounters for assertions about encounter table results.
- **Player login** — `Given I am logged in as a player` needs either a second storageState file or a way to join as a different user mid-test. This may require a separate global-setup step or a fixture that re-authenticates. Defer to implementation time.
- **Torch longevity** — the light tracker uses `longevityMins` to calculate fractions. When creating a torch in a Given step, set both `remainingSecs` and `longevityMins` to known values so thresholds are predictable (e.g., 60 min torch with 60 min remaining = bright).

## Acceptance criteria

- [x] `tests/steps/common.steps.js` defines all shared game-state steps (actor light, settings)
- [x] `tests/steps/light-tracker.steps.js` defines all Player Light Tracker steps (30+ steps)
- [ ] ~~`tests/steps/encounter-roller.steps.js` defines all Encounter Roller steps~~ → moved to task-016a
- [ ] ~~`tests/steps/light-adjuster.steps.js` defines all Light Adjuster steps~~ → moved to task-016b
- [x] `tests/features/light-tracker.feature` has at least 3 scenarios covering bright/fading/darkness (33 scenarios)
- [ ] ~~`tests/features/encounter-roller.feature` has at least 2 scenarios~~ → moved to task-016a
- [ ] ~~`tests/features/light-adjuster.feature` has at least 1 scenario~~ → moved to task-016b
- ~~[ ] Cleanup hook resets game state after each scenario~~ — **Dropped**: fixed pre-existing actors approach avoids needing this
- [ ] ~~`docs/WRITING-TESTS.md` exists with contributor guidance~~ → moved to task-016c
- [x] All light tracker feature files pass with `npm test`

**Note:** Remaining work has been split into independent tasks:
- task-016a: Encounter Roller BDD Tests
- task-016b: Light Adjuster BDD Tests
- task-016c: BDD Contributor Guide

## Scope boundaries

- **In scope**: step definitions for all three macros, example feature files, cleanup hooks, contributor guide
- **Out of scope**: exhaustive scenario coverage (add more features later), CI/CD, player-login steps (defer until needed), pre-baked test actors in Docker world
- **Do not** modify existing module source code (`module/src/`, `module/styles/`)
