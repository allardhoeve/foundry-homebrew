# Task 014: BDD Foundry API Integration

Depends on task-013.

## Goal

Implement the global setup that connects the test scaffold to a running Docker Foundry instance: world launch via API, readiness polling, authentication, and storageState capture. After this task, `npm test` runs the smoke test end-to-end against Docker Foundry.

## Background

Task 013 scaffolds the test infrastructure with stub global setup. This task fills in the API integration: the exact request payloads for `/api/setup` and `/join`, the polling strategy for world readiness, and storageState persistence.

## Context

- `tests/support/global-setup.js` — stub from task 013, has TODO markers to fill in
- `docker/secrets.json.tmpl` — documents the required credential fields
- `docker/docker-compose.yml` — Docker Compose config with module bind-mount (from task 013)
- `docs/TESTING.md` — architecture reference
- `docker/data/Logs/` — Foundry server logs (useful for debugging the API flow)

## API reference (researched from Foundry v13 build 351)

### Step 1: `POST /api/setup` — admin auth

Authenticate as server admin. Sets a session cookie required for subsequent setup calls.

```
POST /api/setup
Content-Type: application/json

{ "action": "adminAuth", "adminPassword": "<foundry_admin_key>" }
```

- **200**: authenticated, session cookie set
- **403**: wrong admin key

### Step 2: `POST /api/setup` — launch world

Trigger world launch. Returns immediately; the world loads asynchronously.

```
POST /api/setup
Content-Type: application/json

{ "action": "launchWorld", "world": "<foundry_world>" }
```

- **200**: launch accepted (async — world is not yet ready)
- If the world is already active, this may error or no-op — handle gracefully

### Step 3: Poll `GET /join` for world readiness

Foundry's routing changes based on server state:

- **No world active**: `GET /join` → **302** redirect to `/setup`
- **World loading**: `GET /join` → **302** redirect to `/setup`
- **World ready**: `GET /join` → **200** (join page HTML)

Use native `fetch()` with `redirect: "manual"` to see the 302 without following it (Playwright's `APIRequestContext` does not support `maxRedirects`).

**Polling with exponential backoff:**

- Initial interval: **500ms**, multiplied by **1.5** each attempt, capped at **5s**
- Hard timeout: **60s**

**Failure detection — abort early rather than waiting for the full timeout:**

| Signal | Meaning | Action |
|--------|---------|--------|
| Network error (ECONNREFUSED) | Container not listening yet | Retry (normal during startup) |
| Network error persists > 15s | Container likely crashed or never started | Abort with "is the container running?" hint |
| `GET /join` returns **500** or **503** | Foundry internal error | Abort immediately — world launch failed |
| `GET /join` returns **302** but no progress after 45s | Likely stuck (bad migration, missing data) | Abort with "check docker logs" hint |
| Consecutive network errors after previously getting HTTP responses | Container died mid-startup | Abort with "container may have crashed" hint |

The polling function should track state transitions (no-response → got-302 → got-200) and detect regressions. A transition from HTTP responses back to network errors is a strong crash signal.

### Step 4: `POST /join` — authenticate as Gamemaster

```
POST /join
Content-Type: application/json

{ "action": "join", "userid": "<foundry_gamemaster_user>", "password": "<foundry_gamemaster_password>" }
```

- **200**: authenticated, session cookie grants access to `/game`
- The `userid` field is the display name (e.g., "Gamemaster"), not an internal ID

### Step 5: Save storageState

Call `ctx.storageState({ path: "tests/.auth/storageState.json" })` to persist cookies for test reuse.

## Changes

### Modified: `tests/support/global-setup.js`

Replace TODO stubs with working implementation using Playwright's `request` API:

```js
import { request } from "@playwright/test";

const POLL_TIMEOUT_MS = 60_000;
const POLL_INITIAL_MS = 500;
const POLL_MULTIPLIER = 1.5;
const POLL_CAP_MS = 5_000;
const NETWORK_ERROR_BAIL_MS = 15_000;

export default async function globalSetup() {
  const secrets = JSON.parse(fs.readFileSync("docker/secrets.json", "utf-8"));
  const ctx = await request.newContext({ baseURL: "http://localhost:30000" });

  // 1. Admin auth
  await ctx.post("/api/setup", {
    data: { action: "adminAuth", adminPassword: secrets.foundry_admin_key },
  });

  // 2. Launch world
  await ctx.post("/api/setup", {
    data: { action: "launchWorld", world: secrets.foundry_world },
  });

  // 3. Poll GET /join until 200 (with backoff and failure detection)
  await pollUntilReady();

  // 4. Join as Gamemaster
  await ctx.post("/join", {
    data: {
      action: "join",
      userid: secrets.foundry_gamemaster_user,
      password: secrets.foundry_gamemaster_password || "",
    },
  });

  // 5. Save storageState
  await ctx.storageState({ path: "tests/.auth/storageState.json" });
  await ctx.dispose();
}

async function pollUntilReady() {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let interval = POLL_INITIAL_MS;
  let firstNetworkError = null;
  let everGotHttpResponse = false;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/join`, { redirect: "manual" });
      everGotHttpResponse = true;
      firstNetworkError = null; // reset — server is responding

      if (res.status === 200) return; // world ready

      if (res.status >= 500) {
        throw new Error(
          `Foundry returned ${res.status} — world launch failed. Check: docker compose logs foundry`
        );
      }
      // 302 — still loading, keep polling
    } catch (err) {
      if (err.message.includes("world launch failed")) throw err; // re-throw our own aborts

      // Network error (ECONNREFUSED, etc.)
      if (!firstNetworkError) firstNetworkError = Date.now();

      if (everGotHttpResponse) {
        throw new Error(
          "Lost connection to Foundry after it was responding — container may have crashed. " +
          "Check: docker compose logs foundry"
        );
      }
      if (Date.now() - firstNetworkError > NETWORK_ERROR_BAIL_MS) {
        throw new Error(
          `Cannot reach Foundry after ${NETWORK_ERROR_BAIL_MS / 1000}s — ` +
          "is the container running? Check: docker compose ps"
        );
      }
    }

    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * POLL_MULTIPLIER, POLL_CAP_MS);
  }

  throw new Error(
    `World did not become ready within ${POLL_TIMEOUT_MS / 1000}s. ` +
    "It may be stuck on migration. Check: docker compose logs foundry"
  );
}
```

## Verification

```bash
# Start Docker Foundry
cd docker && docker compose up -d

# Install deps and browser
npm install
npx playwright install chromium

# Build packs
npm run build

# Generate playwright-bdd specs and run
npm test
```

Manual check: `npm run test:headed` should show Chromium opening, landing directly on the game canvas (no login UI), and the smoke test passing.

## Pitfalls

- **Two-step setup auth** — must call `POST /api/setup` with `adminAuth` first to get a session cookie, then `launchWorld` second. Skipping the auth step will fail.
- **Playwright auto-follows redirects** — Playwright's `APIRequestContext` does not support `maxRedirects` and always follows redirects. The polling loop uses Node's native `fetch()` with `redirect: "manual"` instead, which returns the 302 response directly without following or throwing.
- **Global setup timeout** — world launch can take 30s+ (migrations, package loading). Use a 60s timeout.
- **World already active** — if Docker was left running between test runs, `launchWorld` may error. Wrap the `launchWorld` call in a try/catch that falls through to polling — if the world is already up, `GET /join` will return 200 immediately.
- **storageState staleness** — if the Docker container restarts between runs, the saved session may be invalid. Global setup should always re-authenticate rather than reusing stale state.
- **Docker container must be running** — none of the npm scripts start Docker. The verification section assumes `docker compose up -d` was run manually. Consider documenting this clearly or adding a pre-check that fails fast with a helpful message if the container isn't up.

## Acceptance criteria

- [x] `tests/support/global-setup.js` successfully authenticates as admin and launches the world
- [x] Global setup polls `GET /join` for world readiness and proceeds only when 200
- [x] Global setup authenticates as Gamemaster via `POST /join` and saves storageState
- [x] `npm test` runs the smoke test end-to-end and passes
- [x] `npm run test:headed` shows the browser with no login UI interaction
- [x] No console errors reported by the smoke test
- [x] API request shapes are documented in code comments within `global-setup.js`

## Scope boundaries

- **In scope**: global-setup API implementation, readiness polling, storageState capture, verifying full e2e flow
- **Out of scope**: additional test scenarios, module activation automation (task 015), CI/CD pipeline
- **Do not** modify existing module source code (`src/`, `styles/`)
