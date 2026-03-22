import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures.js';
import { takeScreenshot } from '../support/screenshots.js';

const { When, Then } = createBdd(test);

const ADJUSTER_ID = '#light-adjuster';

const DELTA_MAP = {
  '-10 min': '-600',
  '-1 min':  '-60',
  '+1 min':  '60',
  '+10 min': '600',
};

async function openLightAdjuster(page) {
  await page.evaluate(() => {
    game.modules.get('foundry-homebrew').api.lightAdjuster.render({ force: true });
  });
  await page.locator(ADJUSTER_ID).waitFor({ state: 'visible', timeout: 5_000 });
}

async function closeLightAdjuster(page) {
  await page.evaluate(() => {
    const app = game.modules.get('foundry-homebrew').api.lightAdjuster;
    if (app.rendered) app.close();
  });
  await page.locator(ADJUSTER_ID).waitFor({ state: 'hidden', timeout: 5_000 });
}

// --- When ---

When('I open the Light Adjuster', async ({ session }) => {
  await openLightAdjuster(session.page);
});

When('I close the Light Adjuster', async ({ session }) => {
  await closeLightAdjuster(session.page);
});

When('I adjust light timers by {string}', async ({ session }, label) => {
  const delta = DELTA_MAP[label];
  if (!delta) throw new Error(`Unknown adjustment label "${label}". Available: ${Object.keys(DELTA_MAP).join(', ')}`);
  await session.page.locator(`${ADJUSTER_ID} button[data-delta="${delta}"]`).click();
  // Wait for re-render: status is empty until _adjustLights completes and re-renders.
  await expect(session.page.locator(`${ADJUSTER_ID} .la-status`)).not.toBeEmpty({ timeout: 5_000 });
});

// --- Then ---

Then('the Light Adjuster should be visible', async ({ session }) => {
  await expect(session.page.locator(ADJUSTER_ID)).toBeVisible();
});

Then('the Light Adjuster should show the button grid', async ({ session }) => {
  await expect(session.page.locator(`${ADJUSTER_ID} .la-button-grid`)).toBeVisible();
});

Then('the Light Adjuster status should be visible', async ({ session }) => {
  const status = session.page.locator(`${ADJUSTER_ID} .la-status`);
  await expect(status).toBeVisible();
  await expect(status).not.toBeEmpty();
});

Then('the Light Adjuster timer summary should be visible', async ({ session }) => {
  const timers = session.page.locator(`${ADJUSTER_ID} .la-timers`);
  await expect(timers).toBeVisible();
  await expect(timers).not.toBeEmpty();
});

Then('the Light Adjuster timer summary should mention {string}', async ({ session }, text) => {
  const timers = session.page.locator(`${ADJUSTER_ID} .la-timers`);
  await expect(timers).toBeVisible();
  await expect(timers).toContainText(text);
});

Then('describe the Light Adjuster window', async ({ session, $testInfo }) => {
  const snapshot = await session.page.locator(ADJUSTER_ID).evaluate(el => {
    const result = {};

    // Buttons
    const grid = el.querySelector('.la-button-grid');
    if (grid) {
      result.buttons = [...grid.querySelectorAll('button[data-delta]')].map(btn => ({
        delta: btn.dataset.delta,
        label: btn.textContent?.trim() ?? '',
      }));
    }

    // Status
    result.status = el.querySelector('.la-status')?.textContent?.trim() ?? '';

    // Timers
    result.timers = el.querySelector('.la-timers')?.textContent?.trim() ?? '';

    // Title
    result.title = el.querySelector('.la-title')?.textContent?.trim() ?? '';

    return result;
  });

  console.log('--- LIGHT ADJUSTER SNAPSHOT ---');
  console.log(JSON.stringify(snapshot, null, 2));
  console.log('--- END SNAPSHOT ---');

  await takeScreenshot(session.page, $testInfo, 'light-adjuster-window');
});
