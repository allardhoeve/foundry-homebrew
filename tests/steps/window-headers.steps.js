import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { expect } from '@playwright/test';

const { When, Then } = createBdd(test);

// Window name in the feature → key under game.modules.get('foundry-homebrew').api
const WINDOWS = {
  'Light Tracker': 'lightTracker',
  'Light Adjuster': 'lightAdjuster',
  'Scarlet Minotaur': 'scarletMinotaurEncounter',
  'Asset Browser': 'assetBrowser',
  'Crawling Clock': 'crawlingClock',
};

// Buttons closer than this belong to the same group; a group closer than this to a
// header edge counts as sitting at that edge.
const GAP_PX = 12;

function apiKey(name) {
  const key = WINDOWS[name];
  if (!key) throw new Error(`Unknown window "${name}". Known: ${Object.keys(WINDOWS).join(', ')}`);
  return key;
}

async function windowId(page, name) {
  return page.evaluate(key => game.modules.get('foundry-homebrew').api[key].id, apiKey(name));
}

When('I open the {string} window', async ({ session }, name) => {
  const page = session.page;
  await page.evaluate(async key => {
    const app = game.modules.get('foundry-homebrew').api[key];
    if (!app.rendered) await app.render({ force: true });
  }, apiKey(name));
  await page.locator(`#${await windowId(page, name)} .window-header`).waitFor({ state: 'visible', timeout: 5000 });
});

When('I open the controls menu of the {string} window', async ({ session }, name) => {
  const page = session.page;
  await page.locator(`#${await windowId(page, name)} .window-header [data-action="toggleControls"]`).click();
  await page.locator('#context-menu .context-item').first().waitFor({ state: 'visible', timeout: 5000 });
});

Then('no button in the {string} header floats away from the edges', async ({ session }, name) => {
  const page = session.page;
  const id = await windowId(page, name);
  const layout = await page.locator(`#${id} .window-header`).evaluate(header => {
    const box = header.getBoundingClientRect();
    const buttons = [...header.querySelectorAll('button')]
      .map(b => ({ label: b.getAttribute('aria-label') || b.title || b.dataset.action, rect: b.getBoundingClientRect() }))
      .filter(b => b.rect.width > 0)
      .sort((a, b) => a.rect.left - b.rect.left)
      .map(b => ({ label: b.label, left: b.rect.left - box.left, right: b.rect.right - box.left }));
    return { width: box.width, buttons };
  });

  // Gather neighbouring buttons into groups, then require each group to touch an edge.
  const groups = [];
  for (const button of layout.buttons) {
    const last = groups.at(-1);
    if (last && button.left - last.right <= GAP_PX) {
      last.labels.push(button.label);
      last.right = button.right;
    } else {
      groups.push({ labels: [button.label], left: button.left, right: button.right });
    }
  }
  const floating = groups
    .filter(g => g.left > GAP_PX && layout.width - g.right > GAP_PX)
    .map(g => `${g.labels.join(' + ')} at ${Math.round(g.left)}px of ${Math.round(layout.width)}px`);
  expect(floating, 'header buttons away from both edges').toEqual([]);
});

Then('the controls menu should list no entry twice', async ({ session }) => {
  const labels = await session.page.locator('#context-menu .context-item').allTextContents();
  const trimmed = labels.map(l => l.trim());
  const repeated = trimmed.filter((label, i) => trimmed.indexOf(label) !== i);
  expect(repeated, `menu entries: ${trimmed.join(', ')}`).toEqual([]);
});
