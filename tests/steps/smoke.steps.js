import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { expect } from '@playwright/test';

const { Then } = createBdd(test);

Then('the module {string} should be active', async ({ session }, moduleName) => {
  const isActive = await session.page.evaluate(
    (name) => game.modules.get(name)?.active === true,
    moduleName,
  );
  expect(isActive).toBe(true);
});

Then('there should be no console errors', async ({ session }) => {
  expect(session.consoleErrors).toEqual([]);
});
