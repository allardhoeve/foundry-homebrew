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
| API shortcuts | `POST /api/setup`, `POST /join` | Launch world and authenticate without browser UI |
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
│   ├── fixtures.js        # Custom Playwright fixtures (foundryPage, consoleErrors)
│   └── global-setup.js    # API login + storageState capture
├── .features-gen/         # Generated spec files (playwright-bdd output, gitignored)
└── playwright.config.js
```

### Global Setup Flow

`global-setup.js` runs once before all tests:

1. Read credentials from `docker/secrets.json`
2. `POST /api/setup` — launch the world (if not already active)
3. Wait for world to be ready (Foundry can take 10–30s to initialize)
4. `POST /join` — authenticate as Gamemaster
5. Save `storageState` to a JSON file — cookies + localStorage captured

Every test reuses the saved storageState, so browser contexts start already authenticated.

### Fixture Design

Custom fixtures extend Playwright's `test` object via `createBdd(test)`:

- **`foundryPage`** — a `Page` with storageState already applied, navigated to `/game`, canvas ready (`#board` visible)
- **`consoleErrors`** — array collecting `console.error` during test

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

Given('I am logged in as Gamemaster', async ({ foundryPage }) => {
  // storageState already applied — just verify we're in-game
});
```

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

- **World launch timing** — after `POST /api/setup`, Foundry may take 10–30s to initialize. Global setup must poll or wait with a generous timeout.
- **Module not enabled** — the world must have `foundry-homebrew` activated in Module Management. The smoke test catches this.
- **Packs directory** — run `npm run build` so `packs/macros/` exists before Foundry loads the compendium.
- **storageState staleness** — if the Docker container restarts between runs, the saved session may be invalid. Global setup should handle re-authentication.
