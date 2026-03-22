import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd(test);

// --- Helpers ---

const TRACKER_ID = '#player-light-tracker';

async function openTracker(page) {
  await page.evaluate(() =>
    game.modules.get('foundry-homebrew').api.lightTracker.toggleInterface()
  );
  await page.locator(TRACKER_ID).waitFor({ state: 'visible', timeout: 5000 });
}

async function closeTracker(page) {
  await page.evaluate(() => {
    const tracker = game.modules.get('foundry-homebrew').api.lightTracker;
    if (tracker.rendered) tracker.close();
  });
  await page.locator(TRACKER_ID).waitFor({ state: 'hidden', timeout: 5000 });
}

// --- Given ---

Given('the Player Light Tracker is open', async ({ session }) => {
  await openTracker(session.page);
});

Given('the Player Light Tracker is open in compact mode', async ({ session }) => {
  await openTracker(session.page);
  // Ensure compact mode is on
  const isCompact = await session.page.locator(TRACKER_ID).evaluate(
    el => el.classList.contains('plt-compact')
  );
  if (!isCompact) {
    await session.page.locator(`${TRACKER_ID} .plt-header-btn[title="Toggle size"]`).click();
  }
  await expect(session.page.locator(TRACKER_ID)).toHaveClass(/plt-compact/);
});

// --- When ---

When('I open the Player Light Tracker', async ({ session }) => {
  await openTracker(session.page);
});

When('I close the Player Light Tracker', async ({ session }) => {
  await closeTracker(session.page);
});

When('I click the compact toggle', async ({ session }) => {
  await session.page.locator(`${TRACKER_ID} .plt-header-btn[title="Toggle size"]`).click();
});

When('I click the character portrait', async ({ session }) => {
  await session.page.locator(`${TRACKER_ID} .plt-compact-portrait`).click();
});

When('I click the black and white toggle', async ({ session }) => {
  await session.page.locator(`${TRACKER_ID} .plt-header-btn[title="Black & White"]`).click();
});

// --- Then: Assertions ---

Then('the tracker window should be visible', async ({ session }) => {
  await expect(session.page.locator(TRACKER_ID)).toBeVisible();
});

Then('the tracker should have the title {string}', async ({ session }, title) => {
  const headerTitle = session.page.locator(`${TRACKER_ID} .plt-header-title`);
  await expect(headerTitle).toHaveText(title);
});

Then('the tracker should show a status message', async ({ session }) => {
  const status = session.page.locator(`${TRACKER_ID} .plt-status-text`);
  await expect(status).toBeVisible();
  const text = await status.textContent();
  expect(text.trim().length).toBeGreaterThan(0);
});

Then('the tracker should show an animation area', async ({ session }) => {
  const animation = session.page.locator(`${TRACKER_ID} .plt-animation`);
  await expect(animation).toBeVisible();
});

Then('only the active character portrait should be visible', async ({ session }) => {
  const portrait = session.page.locator(`${TRACKER_ID} .plt-compact-portrait`);
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveCount(1);
});

Then('the character portrait should not be visible', async ({ session }) => {
  const portrait = session.page.locator(`${TRACKER_ID} .plt-compact-portrait`);
  await expect(portrait).not.toBeVisible();
});

Then('the animation area should be hidden', async ({ session }) => {
  const animation = session.page.locator(`${TRACKER_ID} .plt-animation`);
  await expect(animation).not.toBeVisible();
});

Then('the character selector popup should be visible', async ({ session }) => {
  const popup = session.page.locator(`${TRACKER_ID} .plt-popup`);
  await expect(popup).toHaveCSS('opacity', '1');
});

Then('the tracker should have the desaturated style applied', async ({ session }) => {
  const pltWindow = session.page.locator(`${TRACKER_ID} .plt-window`);
  await expect(pltWindow).toHaveClass(/plt-bw/);
});

Then('the tracker status should say {string}', async ({ session }, expectedText) => {
  const status = session.page.locator(`${TRACKER_ID} .plt-status-text`);
  await expect(status).toHaveText(expectedText);
});

Then('the tracker status should contain {string}', async ({ session }, expectedText) => {
  const status = session.page.locator(`${TRACKER_ID} .plt-status-text`);
  await expect(status).toContainText(expectedText, { ignoreCase: true });
});

Then('the tracker should show a torch animation', async ({ session }) => {
  const video = session.page.locator(`${TRACKER_ID} .plt-video`);
  await expect(video).toBeVisible();
  const src = await video.getAttribute('src');
  expect(src).toMatch(/yellow\.mp4|orange\.mp4|red\.mp4/);
});

Then('the tracker should show a spell animation', async ({ session }) => {
  const video = session.page.locator(`${TRACKER_ID} .plt-video`);
  await expect(video).toBeVisible();
  const src = await video.getAttribute('src');
  expect(src).toContain('staff');
});

Then('the tracker should not show an animation', async ({ session }) => {
  const video = session.page.locator(`${TRACKER_ID} .plt-video`);
  const image = session.page.locator(`${TRACKER_ID} .plt-image`);
  await expect(video).toHaveCount(0);
  await expect(image).toHaveCount(0);
});

// --- Then: Visibility assertions ---

Then('the character selector should show {int} actors', async ({ session }, count) => {
  const buttons = session.page.locator(`${TRACKER_ID} .plt-character-btn`);
  await expect(buttons).toHaveCount(count);
});

Then('the character selector should include {string}', async ({ session }, actorName) => {
  const button = session.page.locator(`${TRACKER_ID} .plt-character-selector`).getByTitle(actorName, { exact: true });
  await expect(button).toBeVisible();
});

// --- Then: Eye tests (structured inspection) ---

Then('describe the tracker window', async ({ session }) => {
  const snapshot = await session.page.locator(TRACKER_ID).evaluate(el => {
    const result = {};

    // Window classes (mode & state)
    const pltWindow = el.querySelector('.plt-window');
    result.stateClass = [...(pltWindow?.classList ?? [])]
      .find(c => c.startsWith('plt-state-')) ?? 'none';
    result.lightType = pltWindow?.dataset?.lightType ?? 'none';
    result.isCompact = el.classList.contains('plt-compact');
    result.isBW = pltWindow?.classList.contains('plt-bw') ?? false;

    // Header title
    result.title = el.querySelector('.plt-header-title')?.textContent?.trim() ?? '';

    // Status text
    result.statusText = el.querySelector('.plt-status-text')?.textContent?.trim() ?? '';

    // Animation
    const video = el.querySelector('.plt-video');
    const image = el.querySelector('.plt-image');
    result.animation = video
      ? { type: 'video', src: video.src }
      : image
        ? { type: 'image', src: image.src }
        : { type: 'none' };

    // Character portrait (compact mode)
    const portrait = el.querySelector('.plt-compact-portrait');
    result.portrait = portrait
      ? { visible: true, src: portrait.src, alt: portrait.alt }
      : { visible: false };

    // Character selector
    const selectorBtns = el.querySelectorAll('.plt-character-btn');
    result.characterSelector = [...selectorBtns].map(btn => ({
      name: btn.title,
      active: btn.classList.contains('plt-character-active'),
    }));

    return result;
  });

  // Log the snapshot so Claude can read it from test output
  console.log('--- TRACKER SNAPSHOT ---');
  console.log(JSON.stringify(snapshot, null, 2));
  console.log('--- END SNAPSHOT ---');
});
