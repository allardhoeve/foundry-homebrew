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
    storageState: 'tests/.auth/storageState.json',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  globalSetup: './support/global-setup.js',
  reporter: [['html', { open: 'never' }]],
});
