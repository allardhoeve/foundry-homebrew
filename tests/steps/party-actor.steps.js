import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd(test);

const PARTY_TYPE = 'foundry-homebrew.Party';

// --- Helpers ------------------------------------------------------------------

async function waitForPartySheet(page) {
  await page.locator('.party-sheet').waitFor({ state: 'visible', timeout: 5_000 });
}

// --- Given steps --------------------------------------------------------------

Given('all Party actors are deleted', async ({ session }) => {
  await session.page.evaluate(async (type) => {
    const parties = game.actors.filter(a => a.type === type);
    for (const p of parties) await p.delete();
  }, PARTY_TYPE);
});

// --- When steps ---------------------------------------------------------------

When('I create a Party actor named {string}', async ({ session }, name) => {
  await session.page.evaluate(async ({ actorName, type }) => {
    const actor = await Actor.create({ name: actorName, type });
    actor.sheet.render(true);
  }, { actorName: name, type: PARTY_TYPE });
  await waitForPartySheet(session.page);
});

When('I add player {string} to the party', async ({ session }, playerName) => {
  await session.page.evaluate(async ({ name, type }) => {
    const player = game.actors.find(a => a.name === name && a.type === 'Player');
    if (!player) throw new Error(`Player actor "${name}" not found`);

    const partyActor = game.actors.find(a => a.type === type);
    if (!partyActor) throw new Error('No Party actor found');

    const members = partyActor.system.members;
    if (!members.includes(player.uuid)) {
      await partyActor.update({ 'system.members': [...members, player.uuid] });
    }
  }, { name: playerName, type: PARTY_TYPE });
  await session.page.waitForTimeout(500);
});

When('I remove member {string} from the party', async ({ session }, memberName) => {
  const card = session.page.locator('.pa-member', {
    has: session.page.locator(`.pa-member-name:text("${memberName}")`),
  });
  await card.locator('.pa-remove').click();
  await session.page.waitForTimeout(500);
});

When('I click member name {string}', async ({ session }, memberName) => {
  await session.page.locator(`.pa-member-name:text("${memberName}")`).click();
  await session.page.waitForTimeout(500);
});

When('I add a non-Player actor to the party', async ({ session }) => {
  await session.page.evaluate(async (type) => {
    // Create a temporary NPC-type actor and try to add it via the sheet's drop handler
    const npc = await Actor.create({ name: '_test_npc', type: 'NPC' });
    const partyActor = game.actors.find(a => a.type === type);
    if (!partyActor) throw new Error('No Party actor found');

    // Simulate what _onDropActor receives
    await partyActor.sheet._onDropActor(new DragEvent('drop'), {
      type: 'Actor',
      uuid: npc.uuid,
    });

    // Clean up the temporary NPC
    await npc.delete();
  }, PARTY_TYPE);
  await session.page.waitForTimeout(500);
});

When('I set the party notes to {string}', async ({ session }, text) => {
  const notes = session.page.locator('.pa-notes-field');
  await notes.fill(text);
  // Trigger form submission by blurring
  await notes.blur();
  await session.page.waitForTimeout(500);
});

// --- Then steps ---------------------------------------------------------------

Then('the Party sheet should be visible', async ({ session }) => {
  await expect(session.page.locator('.party-sheet')).toBeVisible();
});

Then('the Party sheet title should contain {string}', async ({ session }, name) => {
  const title = session.page.locator('.party-sheet input[name="name"]');
  await expect(title).toHaveValue(name);
});

Then('the Party sheet should show the empty state', async ({ session }) => {
  await expect(session.page.locator('.pa-empty')).toBeVisible();
});

Then('the Party sheet should show member {string}', async ({ session }, name) => {
  await expect(session.page.locator(`.pa-member-name:text("${name}")`)).toBeVisible();
});

Then('the Party sheet should show HP for {string}', async ({ session }, name) => {
  const card = session.page.locator('.pa-member', {
    has: session.page.locator(`.pa-member-name:text("${name}")`),
  });
  await expect(card.locator('.fa-heart').first()).toBeVisible();
});

Then('the Party sheet should show {int} member(s)', async ({ session }, count) => {
  await expect(session.page.locator('.pa-member')).toHaveCount(count);
});

Then('the character sheet for {string} should be visible', async ({ session }, name) => {
  const sheet = session.page.locator('.window-title', { hasText: name });
  await expect(sheet).toBeVisible({ timeout: 5_000 });
});

Then('the Party sheet should show rations for {string}', async ({ session }, name) => {
  const card = session.page.locator('.pa-member', {
    has: session.page.locator(`.pa-member-name:text("${name}")`),
  });
  await expect(card.locator('.fa-drumstick-bite').first()).toBeVisible();
});

Then('the Party sheet should show light sources for {string}', async ({ session }, name) => {
  const card = session.page.locator('.pa-member', {
    has: session.page.locator(`.pa-member-name:text("${name}")`),
  });
  await expect(card.locator('.fa-fire-flame-curved').first()).toBeVisible();
});

Then('the Party sheet should show slot usage for {string}', async ({ session }, name) => {
  const card = session.page.locator('.pa-member', {
    has: session.page.locator(`.pa-member-name:text("${name}")`),
  });
  await expect(card.locator('.fa-weight-hanging').first()).toBeVisible();
});

Then('the Party sheet should show notes {string}', async ({ session }, text) => {
  const notes = session.page.locator('.pa-notes-field');
  await expect(notes).toHaveValue(text);
});

Then('describe the Party sheet', async ({ session }) => {
  const data = await session.page.evaluate(() => {
    const sheet = document.querySelector('.party-sheet');
    if (!sheet) return { visible: false };

    const name = sheet.querySelector('input[name="name"]')?.value ?? '';
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
