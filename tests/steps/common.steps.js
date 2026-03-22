import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { storageStatePaths } from '../support/fixtures.js';
import { takeScreenshot } from '../support/screenshots.js';

const { Given, When } = createBdd(test);

When('I take a screenshot called {string}', async ({ session, $testInfo }, label) => {
  await takeScreenshot(session.page, $testInfo, label);
});

/** Read chat messages collected by the per-scenario Foundry hook. */
export async function getChatMessages(page) {
  return page.evaluate(() => window.__testChatMessages ?? []);
}

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

  // Clear localStorage before Foundry reads client-scoped settings during init.
  // Runs before any page scripts, guaranteeing every test starts from defaults.
  await context.addInitScript(() => localStorage.clear());

  // Attach console error listener before navigation
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      session.consoleErrors.push(msg.text());
    }
  });

  await page.goto('/game');

  // Wait for the module's explicit readiness signal — guarantees all APIs
  // are registered and world data is loaded (fires on Foundry's "ready" hook).
  // Uses waitForFunction because `game` may not exist yet when goto resolves.
  await page.waitForFunction(() => {
    const module = globalThis.game?.modules?.get("foundry-homebrew");
    return module?.ready === true;
  }, { timeout: 30_000 });

  // Secondary wait: ensure the DOM is interactive for Playwright.
  await page.locator('#sidebar').waitFor({ state: 'visible', timeout: 30_000 });

  // Collect chat messages created during this scenario via Foundry hook.
  await page.evaluate(() => {
    window.__testChatMessages = [];
    Hooks.on('createChatMessage', (message) => {
      window.__testChatMessages.push({
        id: message.id,
        content: message.content,
        whisper: message.whisper ?? [],
        speaker: message.speaker,
        timestamp: Date.now(),
      });
    });
  });

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

Given('the Minotaur penalty is {int}', async ({ session }, penalty) => {
  await session.page.evaluate(async (val) => {
    await game.settings.set('lost-citadel-macros', 'minotaurPenalty', val);
  }, penalty);
});

Given('the encounter roll mode is {string}', async ({ session }, mode) => {
  await session.page.evaluate(async (val) => {
    await game.settings.set('lost-citadel-macros', 'rollMode', val);
  }, mode);
});
