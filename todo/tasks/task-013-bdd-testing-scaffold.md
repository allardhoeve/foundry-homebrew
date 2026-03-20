# Task 013: BDD Testing Scaffold

Independent of other tasks.

## Goal

Scaffold the BDD end-to-end testing infrastructure: project structure, config files, fixtures, step definitions, and npm scripts. After this task, the full test skeleton exists and `npx bddgen` generates spec files from Gherkin — but the tests do not yet run against a live Foundry instance (that is task 014).

## Background

We need repeatable, composable e2e tests for the Foundry VTT module. The architecture decisions are documented in `docs/TESTING.md`. This task creates the file structure and wiring; task 014 connects it to a running Foundry.

## Context

- `docs/TESTING.md` — architecture and design decisions for the testing setup
- `docker/docker-compose.yml` — Docker Compose config, currently missing the bind-mount for the module
- `docker/secrets.json` — credentials file (gitignored), required for API login
- `package.json` — currently has no test scripts or Playwright/playwright-bdd dependencies

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| BDD framework | playwright-bdd (Gherkin on Playwright Test) |
| Session management | storageState via global setup |
| World launch | `POST /api/setup` in global setup |
| Authentication | `POST /join` in global setup |
| Fixture pattern | Custom `foundryPage`, `consoleErrors` |

## Changes

### Modified: `package.json`

Add dependencies and scripts:

- `devDependencies`: `@playwright/test`, `playwright-bdd`
- `scripts`: `test`, `test:headed`, `test:debug`, `test:generate` (playwright-bdd codegen)

### Modified: `docker/docker-compose.yml`

Add the module bind-mount:

```yaml
volumes:
  - ./data:/data/
  - ../:/data/Data/modules/foundry-homebrew:ro
```

### Modified: `.gitignore`

Add entries for:

- `tests/.features-gen/` (playwright-bdd generated files)
- `tests/.auth/` (storageState JSON)

### New: `docker/secrets.json.tmpl`

Template showing required fields for `docker/secrets.json`:

```json
{
  "foundry_admin_key": "<your-foundry-admin-password>",
  "foundry_username": "<your-foundry-account-username>",
  "foundry_password": "<your-foundry-account-password>",
  "foundry_world": "lost-citadel",
  "foundry_gamemaster_user": "Gamemaster",
  "foundry_gamemaster_password": ""
}
```

### New: `tests/playwright.config.js`

Playwright Test config:

- `testDir: ".features-gen"` (playwright-bdd output)
- `timeout: 60_000`
- `baseURL: "http://localhost:30000"`
- `globalSetup` pointing to `support/global-setup.js`
- `use.storageState` pointing to saved auth state
- HTML reporter, screenshots/traces on failure

### New: `tests/support/global-setup.js`

Stub global setup function with TODO markers for task 014:

1. Load secrets from `docker/secrets.json`
2. `POST /api/setup` to launch world — TODO (task 014)
3. Poll/wait for world readiness — TODO (task 014)
4. `POST /join` to authenticate as Gamemaster — TODO (task 014)
5. Save storageState to `tests/.auth/storageState.json` — TODO (task 014)

### New: `tests/support/fixtures.js`

Custom Playwright fixtures using `test.extend()`:

- `foundryPage` — page with storageState, navigated to `/game`, waits for `#board` visible
- `consoleErrors` — array collecting `console.error` during test; asserted empty in teardown

### New: `tests/steps/common.steps.js`

Shared step definitions:

- `Given I am logged in as Gamemaster` — verify in-game state (storageState handles actual auth)
- `Given the canvas is ready` — wait for `#board`

### New: `tests/steps/smoke.steps.js`

Step definitions for the smoke test:

- `Then the module {string} should be active` — evaluate `game.modules.get(moduleName)?.active` in the browser context and assert it is `true`
- `Then there should be no console errors` — assert the `consoleErrors` fixture array is empty

### New: `tests/features/smoke.feature`

```gherkin
Feature: Module loads correctly

  Scenario: Foundry loads the module without errors
    Given I am logged in as Gamemaster
    And the canvas is ready
    Then the module "foundry-homebrew" should be active
    And there should be no console errors
```

## Verification

```bash
# Install deps
npm install

# Verify playwright-bdd generates specs from the feature file
npx bddgen

# Check generated output exists
ls tests/.features-gen/
```

Full end-to-end verification (Docker + running tests) is deferred to task 014.

## Pitfalls

- **playwright-bdd version** — ensure compatibility with Playwright Test version. Check playwright-bdd docs for supported Playwright versions.
- **`defineBddConfig` vs `npx bddgen`** — playwright-bdd v8+ may use `defineBddConfig()` inside `playwright.config.js` instead of a standalone `npx bddgen` step. Check the installed version's API and adjust the config and npm scripts accordingly.
- **`.features-gen` must be generated before tests run** — the `test` npm script should run `npx bddgen` first (unless `defineBddConfig` handles this automatically).
- **Fixture imports** — step files must import fixtures from `tests/support/fixtures.js` and pass them to `createBdd()` so steps share the same fixture context.
- **Playwright browser install** — `npx playwright install chromium` is needed before tests can run. Consider adding a `test:install` script or documenting this in the npm scripts section.

## Acceptance criteria

- [ ] `npm install` adds `@playwright/test` and `playwright-bdd` as devDependencies
- [ ] `docker/docker-compose.yml` includes the module bind-mount with relative paths
- [ ] `docker/secrets.json.tmpl` documents the required credentials fields
- [ ] `tests/features/smoke.feature` exists with a valid Gherkin scenario
- [ ] `tests/steps/common.steps.js` defines shared Given steps
- [ ] `tests/steps/smoke.steps.js` defines Then steps for module-active and console-error checks
- [ ] `tests/support/global-setup.js` exists as a stub with TODO markers for task 014
- [ ] `tests/support/fixtures.js` exports `foundryPage` and `consoleErrors` fixtures
- [ ] `npx bddgen` generates spec files in `tests/.features-gen/`
- [ ] `.features-gen/` and `.auth/` directories are gitignored

## Scope boundaries

- **In scope**: testing infrastructure, config, fixtures, step definitions, npm scripts, docker-compose fix, secrets template
- **Out of scope**: API integration (task 014), module activation automation (task 015), CI/CD pipeline, multi-user testing
- **Do not** modify existing module source code (`src/`, `styles/`)
