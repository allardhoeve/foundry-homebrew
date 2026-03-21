# BDD End-to-End Testing Architecture

## Overview

We use **Playwright Test** with **playwright-bdd** to run BDD-style end-to-end tests against a local Docker Foundry VTT instance. Tests are written as Gherkin feature files with reusable step definitions, running against a real Chromium browser.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | JavaScript | Matches module codebase — single language for source and tests |
| Runner | Playwright Test | First-class browser automation; Foundry needs a real browser |
| BDD layer | playwright-bdd | Gherkin feature files + reusable step definitions, idempotent by design |
| Session management | storageState | Login once via API in global setup, reuse for all tests — no UI login per test |
| API shortcuts | `POST /setup`, `POST /join` | Launch world and authenticate without browser UI |
| Docker bind-mount | Project root mounted read-only | Live code changes without copying files |

## Architecture

### Directory Structure

```
tests/
├── features/              # Gherkin .feature files
│   └── smoke.feature
├── steps/                 # Step definitions
│   ├── common.steps.js    # Shared Given/When/Then (login, navigation)
│   └── smoke.steps.js     # Smoke-test-specific steps
├── support/
│   ├── fixtures.js        # Custom Playwright fixtures (session, storageStatePaths)
│   └── global-setup.js    # API login + storageState capture
├── .features-gen/         # Generated spec files (playwright-bdd output, gitignored)
└── playwright.config.js
```

### Global Setup Flow

`global-setup.js` runs once before all tests:

1. Read credentials from `docker/secrets.json`
2. Check if world is already active (GET `/join`, check for "no active game session")
3. If not active: `POST /setup` with `adminAuth`, then `POST /setup` with `launchWorld`
4. Poll `GET /join` until the join form page appears (not the error page)
5. `POST /join` — authenticate as Gamemaster (uses internal user ID, not display name)
6. Save `storageState` to a JSON file — cookies captured

Steps 4–6 repeat for each user (Gamemaster, Player1, Player2), saving separate storageState files: `storageState-gamemaster.json`, `storageState-player1.json`, `storageState-player2.json`. The default `storageState.json` is a copy of the gamemaster file for backward compatibility.

Every test reuses the saved storageState, so browser contexts start already authenticated.

### Fixture Design

Custom fixtures extend Playwright's `test` object via `createBdd(test)`:

- **`session`** — mutable holder `{ page, context, consoleErrors }`, created eagerly but empty. The `Given I am logged in as {string}` step fills it in: looks up the user's storageState file, creates a new browser context, attaches the console error listener, navigates to `/game`, waits for `#sidebar`, and runs guard checks. Teardown closes the context.
- **`storageStatePaths`** — exported map of lowercase user names to their storageState file paths (e.g., `gamemaster`, `player1`, `player2`). Used by the login step to resolve the correct storageState file.

Every scenario starts with `Given I am logged in as SomeUser`. This single step creates the browser context with the correct storageState, attaches listeners, navigates, and stores everything on `session`. All other steps use `session.page`.

### Step Reuse

Steps are defined in `common.steps.js` using `createBdd(test)` from playwright-bdd. Feature-specific steps import the same `test` fixture and add domain steps. All steps share the same fixture context.

```gherkin
Feature: Encounter Roller
  Background:
    Given I am logged in as Gamemaster

  Scenario: Open the roller
    When I open the Encounter Roller
    Then the roller window should be visible
```

```js
// common.steps.js
const { Given } = createBdd(test);

Given(/^I am logged in as (.+)$/, async ({ browser, session }, userName) => {
  // Creates a browser context with the user's storageState,
  // navigates to /game, and stores everything on session
});
```

## Test World Setup

The test world must be configured manually in the Foundry admin before running tests. The fixture guards verify this setup is present.

### Users

| User | Role | Password | Assigned Character |
|------|------|----------|--------------------|
| Gamemaster | GM | *(empty)* | Creeg Greythorn (GM) |
| Player1 | Player | player1 | Iraga Draguul (1) |
| Player2 | Player | player2 | Martin Rast (2) |

### Actors (all type: Player)

| Actor | Owned by |
|-------|----------|
| Creeg Greythorn (GM) | Gamemaster |
| Elbin Grizzlegut (GM) | Gamemaster |
| Iraga Draguul (1) | Gamemaster, Player1 |
| Jorbin Ironhelm (1) | Gamemaster, Player1 |
| Martin Rast (2) | Gamemaster, Player2 |
| Ralina Biggins (2) | Gamemaster, Player2 |

Each user has two owned actors: one assigned as their default character, one unassigned. This covers:
- **Character selector** — multiple actors per user
- **Party light awareness** — actors with and without light
- **Ownership visibility** — GM sees all actors, players see only their own
- **Darkness** — state when nobody has light

## Prerequisites

- **Docker and Docker Compose** — for running the Foundry VTT instance
- **Node.js** — for Playwright and test tooling
- **`docker/secrets.json`** — credentials file (gitignored). Copy from `docker/secrets.json.tmpl` and fill in your values.
- **Playwright Chromium** — `npx playwright install chromium`

## Docker Bind-Mount

`docker-compose.yml` uses two bind-mounts:

```yaml
volumes:
  - ./data:/data/
  - ../:/data/Data/modules/foundry-homebrew:ro
```

- **`./data:/data/`** — Foundry's own persistence (worlds, settings, etc.)
- **`../:/data/Data/modules/foundry-homebrew:ro`** — Mounts the project root as the module directory. The repo layout matches `module.json` declarations (`src/`, `styles/`, `packs/`), so code changes are reflected immediately.

The `:ro` flag prevents Foundry from writing into the repo. Compendium edits through the Foundry UI will fail silently — drop `:ro` or mount `packs/` separately as read-write if needed.

## Running Tests

```bash
npm test                 # headless
npm run test:headed      # see the browser
npm run test:debug       # Playwright inspector
```

Before first run:

```bash
npm install
npx playwright install chromium
cd docker && docker compose up -d
npm run build            # ensure packs/macros/ exists
```

## Pitfalls

- **World launch timing** — after `POST /setup` with `launchWorld`, Foundry may take 10–30s to initialize. Global setup polls with exponential backoff (60s timeout).
- **Headless WebGL** — Foundry requires WebGL for its rendering pipeline. Headless Chromium doesn't enable it by default. The config passes `--use-gl=angle --use-angle=swiftshader` to enable software-rendered WebGL.
- **Viewport size** — Foundry requires at least 1366×768. The config sets 1920×1080. Below minimum, Foundry logs a console error and may not render properly.
- **`#board` vs `#sidebar`** — `#board` is a `<template>` element that stays hidden when no scene is active. Use `#sidebar` as the readiness signal — it's always visible when the game is loaded.
- **`POST /join` userid** — the `userid` field requires the internal user ID (e.g., `CSuZNwbNkDdfUfWD`), not the display name. Find it via `game.users` in the browser console.
- **`POST /setup` endpoint** — the route is `/setup`, not `/api/setup`. The `/api/setup` route returns 404 when a world is active.
- **Module not enabled** — the world must have `foundry-homebrew` activated in Module Management. The smoke test catches this.
- **Packs directory** — run `npm run build` so `packs/macros/` exists before Foundry loads the compendium.
- **storageState staleness** — if the Docker container restarts between runs, the saved session may be invalid. Global setup always re-authenticates.
