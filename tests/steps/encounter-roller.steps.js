import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures.js';
import { getChatMessages } from './common.steps.js';

const { Given, When, Then } = createBdd(test);

const ENCOUNTER_ID = '#scarlet-minotaur-encounter';
const SME_API = "game.modules.get('foundry-homebrew').api.scarletMinotaurEncounter";

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

Then('a public chat message should appear containing {string}', async ({ session }, text) => {
  const lower = text.toLowerCase();
  await expect.poll(
    () => getChatMessages(session.page).then(msgs =>
      msgs.some(m => !m.whisper.length && m.content.toLowerCase().includes(lower))
    ),
    { timeout: 10_000, message: `Expected a public chat message containing "${text}"` }
  ).toBe(true);
});

Then('a whisper should appear containing {string}', async ({ session }, text) => {
  const lower = text.toLowerCase();
  await expect.poll(
    () => getChatMessages(session.page).then(msgs =>
      msgs.some(m => m.whisper.length > 0 && m.content.toLowerCase().includes(lower))
    ),
    { timeout: 10_000, message: `Expected a whisper containing "${text}"` }
  ).toBe(true);
});

Then('describe the Encounter Roller window', async ({ session }) => {
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
});
