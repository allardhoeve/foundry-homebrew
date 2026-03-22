# Writing BDD Tests

Practical guide for adding new BDD tests. For architecture details and infrastructure setup, see [TESTING.md](TESTING.md).

## Quick Start

1. Create a feature file in `tests/features/<feature-name>.feature`
2. Create step definitions in `tests/steps/<feature-name>.steps.js`
3. Run `npm test` (headless) or `npm run test:headed` (visible browser)

## Fixture Pattern

Every step file imports the same `test` fixture and creates BDD bindings from it:

```js
import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';

const { Given, When, Then } = createBdd(test);
```

Two fixtures are available:

- **`session`** — mutable holder `{ page, context, consoleErrors }`. Starts empty; the `Given I am logged in as {string}` step fills it. All other steps use `session.page` to interact with the browser.
- **`storageStatePaths`** — map of lowercase user names (`gamemaster`, `player1`, `player2`) to their auth state files. Used internally by the login step.

Every scenario must start with a login step in its `Background`:

```gherkin
Background:
  Given I am logged in as Gamemaster
```

## Fixed Actors

Tests use pre-existing actors in the test world — never create or delete actors. See [TESTING.md](TESTING.md) for the full actor table.

| Actor | Owned by |
|-------|----------|
| Creeg Greythorn (GM) | Gamemaster |
| Elbin Grizzlegut (GM) | Gamemaster |
| Iraga Draguul (1) | Gamemaster, Player1 |
| Jorbin Ironhelm (1) | Gamemaster, Player1 |
| Martin Rast (2) | Gamemaster, Player2 |
| Ralina Biggins (2) | Gamemaster, Player2 |

Arrange actor state via `page.evaluate()` calling Foundry's document API:

```js
Given('{string} has a lit torch', async ({ session }, actorName) => {
  await session.page.evaluate(async (name) => {
    const actor = game.actors.getName(name);
    await actor.createEmbeddedDocuments('Item', [torchTemplate]);
  }, actorName);
});
```

See `tests/steps/light-sources.steps.js` for the full `arrangeLight()` helper and light templates.

## Step Organization

| File | Purpose |
|------|---------|
| `common.steps.js` | Login, screenshots, world-scoped game settings |
| `light-sources.steps.js` | Adding/removing light items on actors |
| `<macro-name>.steps.js` | Steps specific to one macro's UI |

Reuse existing steps before writing new ones. Check `common.steps.js` and `light-sources.steps.js` first.

## Multi-User Testing

Each scenario gets one browser context. To test different user perspectives, write separate scenarios:

```gherkin
Scenario: GM sees all actors
  Given I am logged in as Gamemaster
  Then the selector should show 6 actors

Scenario: Player sees only their actors
  Given I am logged in as Player 1
  Then the selector should show 2 actors
```

See `tests/features/actor-visibility.feature` for a working example.

## Test Isolation

- **Client-scoped settings** — reset automatically by `localStorage.clear()` in the login step. No manual reset needed.
- **World-scoped settings** — reset explicitly in Background steps. Tag the feature `@mode:serial` so parallel workers don't collide:

```gherkin
@mode:serial
Feature: Light Adjuster

  Background:
    Given I am logged in as Gamemaster
    And no actors have light sources
```

## Eye Tests

Eye tests capture structured snapshots of the UI for inspection — not pass/fail. Use `console.log()` to output a JSON snapshot and `takeScreenshot()` for a visual capture:

```js
import { takeScreenshot } from '../support/screenshots.js';

Then('describe the window', async ({ session, $testInfo }) => {
  const snapshot = await session.page.locator('#my-app').evaluate(el => ({
    title: el.querySelector('.title')?.textContent?.trim() ?? '',
    status: el.querySelector('.status')?.textContent?.trim() ?? '',
  }));
  console.log('--- SNAPSHOT ---');
  console.log(JSON.stringify(snapshot, null, 2));
  console.log('--- END SNAPSHOT ---');
  await takeScreenshot(session.page, $testInfo, 'my-app-window');
});
```

In the feature file, eye test scenarios are grouped under a comment:

```gherkin
  # --- Eye tests ---

  Scenario: Describe the window in default state
    When I open the window
    Then describe the window
```

## Common Mistakes

- **Don't create or delete actors** — use the fixed actors and arrange their state
- **Don't manipulate DOM for state changes** — use `page.evaluate()` with Foundry's API (`game.actors`, `game.settings`, etc.)
- **Don't put infrastructure concerns in step definitions** — Docker, login, and canvas setup are handled by global setup and fixtures
- **Don't forget `@mode:serial`** — any feature that writes world-scoped settings or shared state needs this tag
- **Don't wait for `#sidebar` as a readiness signal** — the login step handles readiness via the `foundry-homebrew.ready` hook

## Running Tests

```bash
npm test              # headless
npm run test:headed   # see the browser
npm run test:debug    # Playwright inspector
```

Prerequisites (first run only): see [TESTING.md](TESTING.md#prerequisites).
