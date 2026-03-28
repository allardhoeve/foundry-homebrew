import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures.js';

import { takeScreenshot } from '../support/screenshots.js';

const { Given, When, Then } = createBdd(test);

const ENCOUNTER_ID = '#scarlet-minotaur-encounter';

async function openEncounterRoller(page) {
  await page.evaluate(() => {
    game.modules.get('foundry-homebrew').api.scarletMinotaurEncounter.render({ force: true });
  });
  await page.locator(ENCOUNTER_ID).waitFor({ state: 'visible', timeout: 5_000 });
}

async function closeEncounterRoller(page) {
  await page.evaluate(() => {
    const app = game.modules.get('foundry-homebrew').api.scarletMinotaurEncounter;
    if (app.rendered) app.close();
  });
  await page.locator(ENCOUNTER_ID).waitFor({ state: 'hidden', timeout: 5_000 });
}

// --- Given ---

Given('the encounter roller settings are reset', async ({ session }) => {
  await session.page.evaluate(async () => {
    await game.settings.set('lost-citadel-macros', 'minotaurPenalty', 0);
    await game.settings.set('lost-citadel-macros', 'rollMode', 'unset');
  });
});

// --- When ---

When('I open the Encounter Roller', async ({ session }) => {
  await openEncounterRoller(session.page);
});

When('I close the Encounter Roller', async ({ session }) => {
  await closeEncounterRoller(session.page);
});

When('I select roll mode {string}', async ({ session }, mode) => {
  await session.page.locator(`${ENCOUNTER_ID} .sme-picker-option[data-mode="${mode}"]`).click();
  // Wait for re-render into roller mode
  await session.page.locator(`${ENCOUNTER_ID} .sme-button-grid`).waitFor({ state: 'visible', timeout: 5_000 });
});

When('I force an encounter', async ({ session }) => {
  await session.page.locator(`${ENCOUNTER_ID} .sme-btn-debug`).click();
  // Wait for results panel to appear
  await session.page.locator(`${ENCOUNTER_ID} .sme-results`).waitFor({ state: 'visible', timeout: 5_000 });
});

When('I click the Encounter Roller settings button', async ({ session }) => {
  await session.page.locator(`${ENCOUNTER_ID} .sme-header-btn`).click();
  await session.page.locator(`${ENCOUNTER_ID} .sme-picker`).waitFor({ state: 'visible', timeout: 5_000 });
});

When('I click Change and select encounter {int}', async ({ session }, index) => {
  // Click the Change button to open the picker dialog
  await session.page.locator(`${ENCOUNTER_ID} .sme-results__change`).click();
  // The picker is a separate ApplicationV2 window (#scarlet-minotaur-picker).
  const pickerRow = session.page.locator(`#scarlet-minotaur-picker .sme-picker-dialog__row[data-index="${index}"]`);
  await pickerRow.waitFor({ state: 'visible', timeout: 5_000 });
  await pickerRow.click();
  // Wait for the main window to re-render with updated hero
  await session.page.locator(`${ENCOUNTER_ID} .sme-hero`).waitFor({ state: 'visible', timeout: 5_000 });
});

When('I click the Done button', async ({ session }) => {
  await session.page.locator(`${ENCOUNTER_ID} .sme-results__done`).click();
  // Wait for re-render back to roller mode
  await session.page.locator(`${ENCOUNTER_ID} .sme-button-grid`).waitFor({ state: 'visible', timeout: 5_000 });
});

// --- Then ---

Then('the Encounter Roller should be visible', async ({ session }) => {
  await expect(session.page.locator(ENCOUNTER_ID)).toBeVisible();
});

Then('the Encounter Roller should not be visible', async ({ session }) => {
  await expect(session.page.locator(ENCOUNTER_ID)).not.toBeVisible();
});

Then('the Encounter Roller should show the roll mode picker', async ({ session }) => {
  await expect(session.page.locator(`${ENCOUNTER_ID} .sme-picker`)).toBeVisible();
});

Then('the Encounter Roller should show the roller', async ({ session }) => {
  await expect(session.page.locator(`${ENCOUNTER_ID} .sme-button-grid`)).toBeVisible();
});

Then('the encounter penalty display should show {int}', async ({ session }, penalty) => {
  const select = session.page.locator(`${ENCOUNTER_ID} select[data-action="set-penalty"]`);
  await expect(select).toBeVisible();
  await expect(select).toHaveValue(String(penalty));
});

Then('the Encounter Roller should show the primary button {string}', async ({ session }, label) => {
  const btn = session.page.locator(`${ENCOUNTER_ID} .sme-btn-primary`);
  await expect(btn).toBeVisible();
  await expect(btn).toContainText(label);
});

Then('the results panel should be visible', async ({ session }) => {
  await expect(session.page.locator(`${ENCOUNTER_ID} .sme-results`)).toBeVisible();
});

Then('the results panel should show the hero encounter', async ({ session }) => {
  const hero = session.page.locator(`${ENCOUNTER_ID} .sme-hero__encounter`);
  await expect(hero).toBeVisible();
  await expect(hero).not.toBeEmpty();
});

Then('the results panel should show {int} tag pills', async ({ session }, count) => {
  const tags = session.page.locator(`${ENCOUNTER_ID} .sme-tag`);
  await expect(tags).toHaveCount(count);
});

Then('the results panel should show the Done button', async ({ session }) => {
  await expect(session.page.locator(`${ENCOUNTER_ID} .sme-results__done`)).toBeVisible();
});

Then('describe the results panel', async ({ session, $testInfo }) => {
  const snapshot = await session.page.locator(ENCOUNTER_ID).evaluate(el => {
    const result = {};
    result.title = el.querySelector('.sme-title')?.textContent?.trim() ?? '';
    result.rollInfo = el.querySelector('.sme-results__info')?.textContent?.trim() ?? '';
    result.heroText = el.querySelector('.sme-hero__encounter')?.textContent?.trim() ?? '';
    result.heroIsMinotaur = !!el.querySelector('.sme-hero--minotaur');
    result.tags = [...el.querySelectorAll('.sme-tag')].map(tag => ({
      text: tag.textContent?.trim() ?? '',
      disabled: tag.classList.contains('sme-tag--disabled'),
    }));
    result.doneVisible = !!el.querySelector('.sme-results__done');
    result.changeVisible = !!el.querySelector('.sme-results__change');
    return result;
  });

  console.log('--- RESULTS PANEL SNAPSHOT ---');
  console.log(JSON.stringify(snapshot, null, 2));
  console.log('--- END SNAPSHOT ---');

  await takeScreenshot(session.page, $testInfo, 'results-panel');
});

Then('describe the Encounter Roller window', async ({ session, $testInfo }) => {
  const snapshot = await session.page.locator(ENCOUNTER_ID).evaluate(el => {
    const result = {};
    const smeWindow = el.querySelector('.sme-window');

    // Mode
    const picker = el.querySelector('.sme-picker');
    const buttonGrid = el.querySelector('.sme-button-grid');
    result.mode = picker ? 'picker' : buttonGrid ? 'roller' : 'unknown';

    // Picker options
    if (picker) {
      result.pickerOptions = [...el.querySelectorAll('.sme-picker-option')].map(opt => ({
        mode: opt.dataset.mode,
        label: opt.querySelector('.sme-picker-label')?.textContent?.trim() ?? '',
      }));
    }

    // Roller state
    if (buttonGrid) {
      result.buttons = [...el.querySelectorAll('button[data-roll]')].map(btn => ({
        roll: btn.dataset.roll,
        label: btn.textContent?.trim() ?? '',
        class: [...btn.classList].filter(c => c.startsWith('sme-btn-')).join(' '),
      }));

      const select = el.querySelector('select[data-action="set-penalty"]');
      result.penaltyValue = select?.value ?? null;
      result.penaltyActive = smeWindow?.classList.contains('sme-penalty-active') ?? false;
    }

    // Title
    result.title = el.querySelector('.sme-title')?.textContent?.trim() ?? '';

    return result;
  });

  console.log('--- ENCOUNTER ROLLER SNAPSHOT ---');
  console.log(JSON.stringify(snapshot, null, 2));
  console.log('--- END SNAPSHOT ---');

  await takeScreenshot(session.page, $testInfo, 'encounter-roller-window');
});
