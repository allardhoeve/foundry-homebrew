import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.steps.js', 'support/fixtures.js'],
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:30000',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  globalSetup: './support/global-setup.js',
  reporter: [
    ['html', { open: 'never' }],
    ['./support/visual-storybook-reporter.js'],
  ],
  // Features tagged @mode:serial mutate shared world state (actor items, world
  // settings).  Running them in a single-worker project that depends on the
  // parallel project guarantees they never overlap with each other or with
  // read-only tests.
  projects: [
    { name: 'parallel', grepInvert: /@mode:serial/ },
    { name: 'serial',   grep: /@mode:serial/, fullyParallel: false, workers: 1, dependencies: ['parallel'] },
  ],
});
