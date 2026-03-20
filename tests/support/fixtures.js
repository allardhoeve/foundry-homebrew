import { test as base } from 'playwright-bdd';

export const test = base.extend({
  /**
   * Collects console.error messages during the test.
   * Declared as a dependency of foundryPage to ensure the listener
   * is attached before any navigation (observers before actors).
   */
  consoleErrors: async ({ page }, use) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await use(errors);
  },

  /**
   * Page navigated to /game with storageState already applied, game ready.
   * Waits for #sidebar (always visible when game is loaded, regardless of active scene).
   * Depends on consoleErrors to guarantee the listener is attached before navigation.
   */
  foundryPage: async ({ page, consoleErrors }, use) => {
    void consoleErrors; // ordering dependency — listener must exist before navigation
    await page.goto('/game');
    await page.locator('#sidebar').waitFor({ state: 'visible', timeout: 30_000 });
    await use(page);
  },
});
