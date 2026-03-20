import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'http://localhost:30000';
const POLL_TIMEOUT_MS = 60_000;
const POLL_INITIAL_MS = 500;
const POLL_MULTIPLIER = 1.5;
const POLL_CAP_MS = 5_000;
const NETWORK_ERROR_BAIL_MS = 15_000;

/**
 * Playwright global setup — runs once before all tests.
 *
 * Observed browser flow (Foundry v13 build 351):
 *   GET /         → redirects to /auth (admin password)
 *   POST /setup   → { action: "adminAuth", adminPassword: "..." }
 *   POST /setup   → { action: "launchWorld", world: "..." }
 *   (world loads asynchronously, /join becomes available)
 *   POST /join    → { action: "join", userid: "Gamemaster", password: "" }
 *   → lands on /game
 */
export default async function globalSetup() {
  const secretsPath = resolve(__dirname, '../../docker/secrets.json');
  const secrets = JSON.parse(readFileSync(secretsPath, 'utf-8'));

  const ctx = await request.newContext({ baseURL: BASE_URL });

  try {
    // Check if the world is already active (container left running between test runs).
    // When active, GET /game returns the game page (body class includes "game").
    // When not active, GET /game returns the error page ("no active game session").
    const worldAlreadyReady = await isWorldReady();

    if (worldAlreadyReady) {
      console.log('[global-setup] World already active — skipping setup');
    } else {
      // Step 1: Authenticate as server admin
      // POST /setup { action: "adminAuth", adminPassword: "<key>" }
      // Sets session cookie required for subsequent setup calls
      const authRes = await ctx.post('/setup', {
        data: { action: 'adminAuth', adminPassword: secrets.foundry_admin_key },
      });
      if (!authRes.ok()) {
        throw new Error(`Admin auth failed (${authRes.status()}). Check foundry_admin_key in docker/secrets.json`);
      }
      console.log('[global-setup] Admin authenticated');

      // Step 2: Launch the world (async — returns before world is ready)
      // POST /setup { action: "launchWorld", world: "<world_name>" }
      // If the world is already active, this may error — fall through to polling
      try {
        const launchRes = await ctx.post('/setup', {
          data: { action: 'launchWorld', world: secrets.foundry_world },
        });
        if (launchRes.ok()) {
          console.log(`[global-setup] World "${secrets.foundry_world}" launch requested`);
        } else {
          console.log(`[global-setup] launchWorld returned ${launchRes.status()} — world may already be active`);
        }
      } catch {
        console.log('[global-setup] launchWorld threw — world may already be active, continuing to poll');
      }

      // Step 3: Poll GET /join until the world is ready
      // When no world is active, /join returns the error page or redirects to /setup.
      // When the world is ready, /join returns the join form page.
      await pollUntilReady();
      console.log('[global-setup] World is ready');
    }

    // Step 4: Authenticate as Gamemaster
    // POST /join { action: "join", userid: "<name>", password: "<pw>" }
    const joinRes = await ctx.post('/join', {
      data: {
        action: 'join',
        userid: secrets.foundry_gamemaster_userid,
        password: secrets.foundry_game_password || '',
      },
    });
    if (!joinRes.ok()) {
      throw new Error(
        `Join as "${secrets.foundry_gamemaster_user}" failed (${joinRes.status()}). ` +
        'Check foundry_gamemaster_userid/foundry_game_password in docker/secrets.json',
      );
    }
    console.log(`[global-setup] Joined as "${secrets.foundry_gamemaster_user}"`);

    // Step 5: Save storageState (cookies + localStorage) for test reuse
    const authDir = resolve(__dirname, '../.auth');
    mkdirSync(authDir, { recursive: true });
    await ctx.storageState({ path: resolve(authDir, 'storageState.json') });
    console.log('[global-setup] storageState saved');
  } finally {
    await ctx.dispose();
  }
}

/**
 * Quick check: is the world already active?
 *
 * GET /game with no session returns the game page (body class "game") when a world
 * is active, or the error page (body class "auth error") when no world is running.
 * We check for "no active game session" in the response body.
 */
async function isWorldReady() {
  try {
    const res = await fetch(`${BASE_URL}/join`, { redirect: 'manual' });
    if (res.status !== 200) return false;
    const body = await res.text();
    // The error page contains "no active game session"; the real join form does not.
    return !body.includes('no active game session');
  } catch {
    return false;
  }
}

/**
 * Poll GET /join until the world is ready (join form page, not error page).
 *
 * Uses native fetch with redirect: "manual" so we can see 302s without following them.
 * Exponential backoff: 500ms → 750ms → 1125ms → ... capped at 5s.
 * Hard timeout: 60s.
 *
 * Failure detection:
 * - Network errors > 15s with no HTTP response ever → container not running
 * - Network errors after previously getting HTTP responses → container crashed
 * - HTTP 500/503 → world launch failed, abort immediately
 */
async function pollUntilReady() {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let interval = POLL_INITIAL_MS;
  let firstNetworkError = null;
  let everGotHttpResponse = false;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/join`, { redirect: 'manual' });
      everGotHttpResponse = true;
      firstNetworkError = null;

      if (res.status === 200) {
        const body = await res.text();
        if (!body.includes('no active game session')) return;
        // 200 with error page — world not ready yet, keep polling
      }

      if (res.status >= 500) {
        throw new Error(
          `Foundry returned ${res.status} — world launch failed. Check: docker compose logs foundry`,
        );
      }

      // 302 or 200-with-error — still loading, keep polling
    } catch (err) {
      if (err.message.includes('world launch failed')) throw err;

      // Network error (ECONNREFUSED, etc.)
      if (!firstNetworkError) firstNetworkError = Date.now();

      if (everGotHttpResponse) {
        throw new Error(
          'Lost connection to Foundry after it was responding — container may have crashed. ' +
          'Check: docker compose logs foundry',
        );
      }
      if (Date.now() - firstNetworkError > NETWORK_ERROR_BAIL_MS) {
        throw new Error(
          `Cannot reach Foundry after ${NETWORK_ERROR_BAIL_MS / 1000}s — ` +
          'is the container running? Check: docker compose ps',
        );
      }
    }

    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * POLL_MULTIPLIER, POLL_CAP_MS);
  }

  throw new Error(
    `World did not become ready within ${POLL_TIMEOUT_MS / 1000}s. ` +
    'It may be stuck on migration. Check: docker compose logs foundry',
  );
}
