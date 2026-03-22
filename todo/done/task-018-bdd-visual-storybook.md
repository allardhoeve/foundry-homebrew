# Task 018: BDD Visual Storybook

Independent of other tasks. Enhances the existing BDD test infrastructure.

## Goal

Add strategic screenshot capture to BDD tests and generate a visual storybook report — a browsable HTML page organized by feature (chapter) → scenario (section) → screenshots (visual narrative).

## Background

The project's "eye tests" capture structured JSON snapshots of DOM state, which is useful for programmatic inspection but cannot show layout, spacing, colors, or visual issues. A visual storybook pairs with eye tests to give both humans and multimodal AI a way to see the actual UI at key test moments.

## Context

- `tests/support/fixtures.js` — custom `session` fixture; playwright-bdd auto-injects `$testInfo`
- `tests/steps/common.steps.js` — shared Gherkin steps (login, settings)
- `tests/steps/encounter-roller.steps.js` — has eye test at line 105 (`describe the Encounter Roller window`)
- `tests/steps/player-light-tracker.steps.js` — has eye test at line 160 (`describe the tracker window`)
- `tests/playwright.config.js` — Playwright config with HTML reporter
- Playwright's `testInfo.attach()` stores attachments in `test-results/` and surfaces them in reporters
- Playwright's custom reporter API provides `onTestEnd` (per-test results with attachments) and `onEnd` (generate output)

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| Screenshot storage | `testInfo.attach()` — Playwright manages storage; reporters access via attachment paths |
| Report format | Self-contained HTML with base64-encoded images (single portable file) |
| Report location | `tests/visual-storybook/index.html` (alongside other test infrastructure) |
| Opt-in mechanism | Gherkin step `And I take a screenshot called "label"` + programmatic `takeScreenshot()` helper |
| Visual regression | Not included — screenshots are for inspection only, not diff comparison |

## Changes

### New: `tests/support/screenshots.js`

Helper function `takeScreenshot(page, testInfo, label)` — calls `page.screenshot()` and `testInfo.attach()`.

### New: `tests/support/visual-storybook-reporter.js`

Custom Playwright reporter that:
- Collects `image/png` attachments from test results, organized by feature → scenario
- On `onEnd`, generates `tests/visual-storybook/index.html` with base64-encoded images
- Includes table of contents, feature/scenario headings, status indicators, and image labels

### Modified: `tests/steps/common.steps.js`

- Import `takeScreenshot` from `screenshots.js`
- Add `When` for `createBdd` (was only `Given`)
- New step: `When('I take a screenshot called {string}', ...)` — opt-in screenshot in any feature file

### Modified: `tests/steps/encounter-roller.steps.js`

- Import `takeScreenshot`
- Add `$testInfo` to `describe the Encounter Roller window` step params
- Call `takeScreenshot` after JSON snapshot log

### Modified: `tests/steps/player-light-tracker.steps.js`

- Import `takeScreenshot`
- Add `$testInfo` to `describe the tracker window` step params
- Call `takeScreenshot` after JSON snapshot log

### Modified: `tests/playwright.config.js`

- Add custom reporter: `['./support/visual-storybook-reporter.js']` alongside existing HTML reporter

### Modified: `package.json`

- Add script: `"test:storybook": "open tests/visual-storybook/index.html"`

### Modified: `.gitignore`

- Add `tests/visual-storybook/`

## Verification

```bash
# Run tests — all should pass, storybook generated automatically
npm test

# Open the visual storybook
npm run test:storybook

# Verify standard Playwright report still works
npx playwright show-report
```

- [ ] Eye test screenshots appear in storybook (encounter roller + light tracker)
- [ ] Features display as chapters with scenario sections
- [ ] Screenshots have labels beneath them
- [ ] Scenario status dots show correct colors

## Acceptance criteria

- [ ] All existing tests still pass (`npm test`)
- [ ] `tests/visual-storybook/index.html` is generated after each test run
- [ ] Storybook shows features as chapters, scenarios as sections, screenshots inline
- [ ] Eye test steps capture screenshots alongside JSON snapshots
- [ ] `And I take a screenshot called "label"` step works in any feature file
- [ ] Storybook is a single self-contained HTML file (no broken images)
- [ ] `tests/visual-storybook/` is gitignored

## Scope boundaries

- **In scope**: screenshot helper, Gherkin step, visual storybook reporter, wiring into eye tests
- **Out of scope**: visual regression/diff comparison, automatic per-step screenshots, CI integration
- **Do not** modify existing module source code (`module/src/`, `module/styles/`)
