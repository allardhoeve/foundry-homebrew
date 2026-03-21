import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { storageStatePaths } from '../support/fixtures.js';

const { Given } = createBdd(test);

Given(/^I am logged in as (.+)$/, async ({ browser, session }, userName) => {
  const key = userName.toLowerCase().replace(/\s+/g, '');
  const stateFile = storageStatePaths[key];
  if (!stateFile) {
    throw new Error(
      `Unknown login user "${userName}". ` +
      `Available: ${Object.keys(storageStatePaths).join(', ')}`,
    );
  }

  const context = await browser.newContext({ storageState: stateFile });
  const page = await context.newPage();

  // Attach console error listener before navigation
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      session.consoleErrors.push(msg.text());
    }
  });

  await page.goto('/game');
  await page.locator('#sidebar').waitFor({ state: 'visible', timeout: 30_000 });

  // Guard: the test world must have at least one Player actor owned by the current user.
  const hasPlayer = await page.evaluate(() =>
    game.actors.some(a => a.type === 'Player' && a.isOwner)
  );
  if (!hasPlayer) {
    throw new Error(
      'Test world needs at least one Player actor owned by the current user. ' +
      'Create one in the Foundry admin and set ownership.'
    );
  }

  session.page = page;
  session.context = context;
});
