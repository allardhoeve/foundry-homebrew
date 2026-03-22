import path from 'node:path';

/**
 * Take a screenshot and attach it to the Playwright test report.
 *
 * Saves to a file so the attachment always has a `path` property,
 * which reporters (including the visual storybook) can read reliably.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} label - Human-readable description (used as attachment name and filename)
 */
export async function takeScreenshot(page, testInfo, label) {
  const filePath = testInfo.outputPath(`${label}.png`);
  await page.screenshot({ fullPage: false, path: filePath });
  await testInfo.attach(label, {
    path: filePath,
    contentType: 'image/png',
  });
}
