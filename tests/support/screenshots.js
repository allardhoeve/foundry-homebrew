/**
 * Take a screenshot and attach it to the Playwright test report.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} label - Human-readable description (used as attachment name)
 */
export async function takeScreenshot(page, testInfo, label) {
  const screenshot = await page.screenshot({ fullPage: false });
  await testInfo.attach(label, {
    body: screenshot,
    contentType: 'image/png',
  });
}
