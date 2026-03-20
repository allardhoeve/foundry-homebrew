import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';

const { Given } = createBdd(test);

Given('I am logged in as Gamemaster', async ({ foundryPage }) => {
  // storageState handles authentication; foundryPage fixture guarantees
  // we're on /game with #board visible — nothing extra needed here.
  void foundryPage;
});

Given('the canvas is ready', async ({ foundryPage }) => {
  // foundryPage fixture already waits for #board visible.
  void foundryPage;
});
