import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { expect } from '@playwright/test';

const { Then } = createBdd(test);

Then('the module {string} should be active', async ({ foundryPage }, moduleName) => {
  const isActive = await foundryPage.evaluate(
    (name) => game.modules.get(name)?.active === true,
    moduleName,
  );
  expect(isActive).toBe(true);
});

Then('there should be no console errors', async ({ consoleErrors }) => {
  expect(consoleErrors).toEqual([]);
});
