import fs from 'node:fs';
import path from 'node:path';

/**
 * Custom Playwright reporter that generates a visual storybook HTML page.
 *
 * Organizes screenshots by feature (chapter) → scenario (section) → screenshots
 * with labels. Produces a single self-contained HTML file with base64-encoded images.
 */
class VisualStorybookReporter {
  constructor() {
    /** @type {Map<string, { scenarios: Map<string, { status: string, screenshots: Array<{ label: string, path: string }> }> }>} */
    this.features = new Map();
  }

  onTestEnd(test, result) {
    const screenshots = result.attachments.filter(a => a.contentType === 'image/png' && a.path);
    if (screenshots.length === 0) return;

    // playwright-bdd nests: project > feature file > scenario
    const featureName = test.parent?.title || 'Unknown Feature';
    const scenarioName = test.title;

    if (!this.features.has(featureName)) {
      this.features.set(featureName, { scenarios: new Map() });
    }

    const feature = this.features.get(featureName);
    feature.scenarios.set(scenarioName, {
      status: result.status,
      screenshots: screenshots.map(s => ({ label: s.name, path: s.path })),
    });
  }

  async onEnd() {
    if (this.features.size === 0) return;

    const outputDir = path.resolve('tests/visual-storybook');
    fs.mkdirSync(outputDir, { recursive: true });

    const html = this._generateHtml();
    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
  }

  _generateHtml() {
    const featureSections = [];
    const tocEntries = [];

    for (const [featureName, feature] of this.features) {
      const featureId = this._slugify(featureName);
      tocEntries.push(`<li><a href="#${featureId}">${this._esc(featureName)}</a></li>`);

      const scenarioBlocks = [];
      for (const [scenarioName, scenario] of feature.scenarios) {
        const statusDot = this._statusDot(scenario.status);
        const images = scenario.screenshots.map(s => {
          const data = this._readBase64(s.path);
          if (!data) return '';
          return `<figure><img src="data:image/png;base64,${data}" alt="${this._esc(s.label)}"><figcaption>${this._esc(s.label)}</figcaption></figure>`;
        }).join('\n');

        scenarioBlocks.push(`
          <div class="scenario">
            <h3>${statusDot} ${this._esc(scenarioName)}</h3>
            <div class="screenshots">${images}</div>
          </div>`);
      }

      featureSections.push(`
        <section class="feature" id="${featureId}">
          <h2>${this._esc(featureName)}</h2>
          ${scenarioBlocks.join('\n')}
        </section>`);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual Storybook</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #f5f5f5; color: #333; line-height: 1.5; padding: 2rem; max-width: 1200px; margin: 0 auto; }
  h1 { margin-bottom: 1rem; }
  nav { background: #fff; border-radius: 8px; padding: 1rem 1.5rem; margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  nav ul { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; }
  nav a { color: #2563eb; text-decoration: none; }
  nav a:hover { text-decoration: underline; }
  .feature { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;
             box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .feature h2 { border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-bottom: 1rem; }
  .scenario { margin-bottom: 1.5rem; }
  .scenario h3 { margin-bottom: 0.75rem; font-size: 1rem; }
  .screenshots { display: flex; flex-wrap: wrap; gap: 1rem; }
  figure { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem;
           max-width: 560px; }
  figure img { width: 100%; height: auto; border-radius: 4px; display: block; }
  figcaption { text-align: center; font-size: 0.85rem; color: #666; margin-top: 0.4rem; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .dot-passed { background: #22c55e; }
  .dot-failed { background: #ef4444; }
  .dot-skipped { background: #eab308; }
  .timestamp { color: #999; font-size: 0.85rem; margin-bottom: 1.5rem; }
</style>
</head>
<body>
<h1>Visual Storybook</h1>
<p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
<nav><ul>${tocEntries.join('\n')}</ul></nav>
${featureSections.join('\n')}
</body>
</html>`;
  }

  _readBase64(filePath) {
    try {
      return fs.readFileSync(filePath).toString('base64');
    } catch {
      return null;
    }
  }

  _statusDot(status) {
    const cls = status === 'passed' ? 'dot-passed' : status === 'failed' ? 'dot-failed' : 'dot-skipped';
    return `<span class="dot ${cls}"></span>`;
  }

  _slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  _esc(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

export default VisualStorybookReporter;
