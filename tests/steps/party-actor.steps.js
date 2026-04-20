import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { expect } from '@playwright/test';

const { When, Then } = createBdd(test);

// --- Helpers ------------------------------------------------------------------

/** Wait for the party sheet to be visible in the DOM. */
async function waitForPartySheet(page) {
  await page.locator('.party-sheet').waitFor({ state: 'visible', timeout: 5_000 });
}

// --- When steps ---------------------------------------------------------------

When('I create a Party actor named {string}', async ({ session }, name) => {
  await session.page.evaluate(async (actorName) => {
    const actor = await Actor.create({ name: actorName, type: 'Party' });
    actor.sheet.render(true);
  }, name);
  await waitForPartySheet(session.page);
});

When('I add player {string} to the party', async ({ session }, playerName) => {
  await session.page.evaluate(async (name) => {
    const player = game.actors.find(a => a.name === name && a.type === 'Player');
    if (!player) throw new Error(`Player actor "${name}" not found`);

    // Find the open party sheet
    const partyActor = game.actors.find(a => a.type === 'Party');
    if (!partyActor) throw new Error('No Party actor found');

    const members = partyActor.system.members;
    if (!members.includes(player.uuid)) {
      await partyActor.update({ 'system.members': [...members, player.uuid] });
    }
  }, playerName);
  // Wait for re-render
  await session.page.waitForTimeout(500);
});

When('I remove member {string} from the party', async ({ session }, memberName) => {
  const card = session.page.locator('.pa-member', { has: session.page.locator(`.pa-member-name:text("${memberName}")`) });
  await card.locator('.pa-remove').click();
  await session.page.waitForTimeout(500);
});

When('I click member name {string}', async ({ session }, memberName) => {
  await session.page.locator(`.pa-member-name:text("${memberName}")`).click();
  await session.page.waitForTimeout(500);
});

// --- Then steps ---------------------------------------------------------------

Then('the Party sheet should be visible', async ({ session }) => {
  await expect(session.page.locator('.party-sheet')).toBeVisible();
});

Then('the Party sheet title should contain {string}', async ({ session }, name) => {
  const title = session.page.locator('.party-sheet .pa-name');
  await expect(title).toHaveValue(name);
});

Then('the Party sheet should show the empty state', async ({ session }) => {
  await expect(session.page.locator('.pa-empty')).toBeVisible();
});

Then('the Party sheet should show member {string}', async ({ session }, name) => {
  await expect(session.page.locator(`.pa-member-name:text("${name}")`)).toBeVisible();
});

Then('the Party sheet should show HP for {string}', async ({ session }, name) => {
  const card = session.page.locator('.pa-member', { has: session.page.locator(`.pa-member-name:text("${name}")`) });
  const hpStat = card.locator('.pa-stat .fa-heart').first();
  await expect(hpStat).toBeVisible();
});

Then('the Party sheet should show {int} member(s)', async ({ session }, count) => {
  await expect(session.page.locator('.pa-member')).toHaveCount(count);
});

Then('the character sheet for {string} should be visible', async ({ session }, name) => {
  // The Shadowdark player sheet should open with the character's name in the header
  const sheet = session.page.locator('.sheet .window-title', { hasText: name });
  await expect(sheet).toBeVisible({ timeout: 5_000 });
});

Then('describe the Party sheet', async ({ session }) => {
  const data = await session.page.evaluate(() => {
    const sheet = document.querySelector('.party-sheet');
    if (!sheet) return { visible: false };

    const name = sheet.querySelector('.pa-name')?.value ?? '';
    const empty = sheet.querySelector('.pa-empty')?.textContent?.trim() ?? null;
    const members = [...sheet.querySelectorAll('.pa-member')].map(card => {
      const memberName = card.querySelector('.pa-member-name')?.textContent?.trim() ?? '';
      const stats = [...card.querySelectorAll('.pa-stat')].map(s => s.textContent.trim());
      const effects = [...card.querySelectorAll('.pa-effect-icon')].map(e => e.title);
      return { name: memberName, stats, effects };
    });
    const notes = sheet.querySelector('.pa-notes-field')?.value ?? '';

    return { visible: true, name, empty, members, notes };
  });

  console.log('--- Party Sheet Eye Test ---');
  console.log(JSON.stringify(data, null, 2));
});
