import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base } from 'playwright-bdd';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Map of user names to their storageState file paths. */
export const storageStatePaths = {
  gamemaster: resolve(__dirname, '../.auth/storageState-gamemaster.json'),
  player1: resolve(__dirname, '../.auth/storageState-player1.json'),
  player2: resolve(__dirname, '../.auth/storageState-player2.json'),
};

export const test = base.extend({
  /**
   * Mutable session holder. Created eagerly but empty — the login step
   * fills in page, context, and consoleErrors. Teardown closes the context.
   */
  session: async ({}, use) => {
    const state = { page: null, context: null, consoleErrors: [] };
    await use(state);
    if (state.page) await state.page.close();
    if (state.context) await state.context.close();
  },
});
