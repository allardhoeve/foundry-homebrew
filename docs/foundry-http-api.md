# Foundry VTT HTTP API Reference (v13 build 351)

Hypothesis document — derived from source code analysis, official API docs, and community
research. Marked with confidence levels. Validate against HAR captures before relying on
edge-case behavior.

## Session & Cookies

All requests share a single session cookie.

| Field | Value |
|-------|-------|
| Cookie name | `session` |
| Format | 24-char random hex string |
| Max age | 86400000 ms (1 day) |
| SameSite | `strict` |
| Created | Automatically on first request to any route |

Session state (server-side):
```
{
  id: "...",
  admin: false,           // true after adminPassword action
  expires: <timestamp>,
  worlds: {               // world_id → user_id mapping
    "lost-citadel": "CSuZNwbNkDdfUfWD"
  }
}
```

**Confidence: HIGH** — session cookie behavior is observable in browser devtools.


## Routes

### `GET /api/status` — Health Check

No auth required. Always returns 200.

**No world active:**
```json
{ "active": false, "version": "13.351" }
```

**World active and ready:**
```json
{
  "active": true,
  "version": "13.351",
  "world": "lost-citadel",
  "system": "shadowdark",
  "systemVersion": "3.6.2",
  "users": 1,
  "uptime": 1234567890
}
```

**Confidence: HIGH** — simple endpoint, easy to verify.

**Open question:** What does this return while the world is *loading* (between launchWorld
and ready)? Hypothesis: `{ "active": false }` because `game.ready` is not yet true. Verify
with HAR.


### `POST /setup` — Admin Actions

Route is `/setup`, **not** `/api/setup`. All requests use `Content-Type: application/json`
and include an `action` field.

Requires admin session for most actions (set by `adminPassword` action).

#### Action: `adminPassword`

Authenticate as server admin.

```
POST /setup
{ "action": "adminPassword", "adminPassword": "<foundry_admin_key>" }
```

| Response | Meaning |
|----------|---------|
| 200 `{ "result": true }` | Authenticated, session cookie now has `admin: true` |
| 403 `{ "result": false }` | Wrong password |

**Confidence: MEDIUM** — research says the correct action name is `adminPassword`. Our
current code sends `action: "adminAuth"` and this **works in practice** (confirmed: admin
session is established and subsequent `launchWorld` succeeds). Hypothesis: it works because
`sessions.authenticateAdmin()` runs on ALL `/setup` POST requests as a side-effect (reads
`body.adminPassword` and sets `session.admin = true` before the action handler runs). The
`"adminAuth"` action then hits a default case that may return an error in the response body,
but with status 200 and the session already authenticated. The side-effect theory is plausible
but unproven — could also be that `adminAuth` is a valid alias. **Verify with HAR.**

#### Action: `launchWorld`

Launch a world asynchronously.

```
POST /setup
{ "action": "launchWorld", "world": "lost-citadel" }
```

Requires admin session.

| Response | Meaning |
|----------|---------|
| 200 `{}` | Launch accepted (async — world not ready yet) |
| 200 `{ "error": "..." }` | Invalid world ID or other error |
| 403 `{ "error": "..." }` | Not admin |

**Confidence: HIGH** for the happy path. The empty `{}` response is unusual — verify.

**Open question:** What happens when the world is already active? Hypothesis: returns an
error JSON (but status 200). Our code wraps this in try/catch and falls through to polling,
which works either way.

#### Action: `editWorld` (module activation candidate)

Update world manifest properties.

```
POST /setup
{ "action": "editWorld", "id": "lost-citadel", ...fields }
```

Available both in setup mode (requires admin) and with active world (requires GM role).

**Confidence: LOW** — unclear if this can toggle module activation. Module activation is
likely stored in the world's LevelDB settings database as `core.moduleConfiguration`, NOT
in `world.json`. See "Module Activation" section below.

#### Other known actions (not yet needed for testing)

| Action | Purpose |
|--------|---------|
| `adminLogout` | Revoke admin session |
| `adminConfigure` | Update server config (`options.json`) |
| `checkPackage` | Check package availability |
| `installPackage` / `uninstallPackage` | Package management |
| `createWorld` | Create a new world |
| `createBackup` / `restoreBackup` | Backup management |

**Confidence: MEDIUM** — action names from source analysis, not verified.


### `GET /join` — Join Page / World Readiness

Behavior depends on server state:

| State | Observed behavior |
|-------|-------------------|
| No world active | 200 — HTML error page containing `"no active game session"` |
| World loading | **Hypothesis: request hangs** — server holds connection open, retries internally every 1s until ready. Client eventually gets the ready page. |
| World ready | 200 — join form HTML (does NOT contain `"no active game session"`) |

**Confidence: MEDIUM** for the loading behavior. Our code uses `redirect: "manual"` to
detect 302s, but research suggests the server does NOT return 302 — it holds the connection.
Our polling works anyway because we detect readiness by checking the response body text.
**This is the #1 thing to verify with HAR.**

Our current polling strategy (in `global-setup.js`):
1. `fetch(BASE_URL/join, { redirect: "manual" })`
2. If 200 and body does NOT contain `"no active game session"` → ready
3. If 200 and body contains the error text → not ready, keep polling
4. If network error → container not up yet, keep polling (bail after 15s)
5. Exponential backoff: 500ms → 750ms → 1125ms → ... capped at 5s, hard timeout 60s


### `POST /join` — Authenticate as Game User

```
POST /join
Content-Type: application/json

{ "action": "join", "userid": "CSuZNwbNkDdfUfWD", "password": "" }
```

The `userid` field is the **internal user ID** (a random string like `CSuZNwbNkDdfUfWD`),
**NOT** the display name. Find it via `game.users.contents.map(u => ({id: u.id, name: u.name}))`
in the browser console.

**Evidence:** sending `"userid": "Gamemaster"` returns 401. Sending the internal ID returns 200.
The ID is stable per-world (stored in the world's user database).

| Response | Meaning |
|----------|---------|
| 200 `{ "request": "join", "status": "success", "redirect": "/game" }` | Authenticated |
| 401 (plain text) | Failed — body is a locale key like `"JOIN.ErrorInvalidPassword"` |

**Confidence: HIGH** for userid requirement (tested). **MEDIUM** for response shape (not yet
inspected response body in detail).

Known error strings:
- `JOIN.ErrorUserDoesNotExist`
- `JOIN.ErrorInvalidPassword`
- `JOIN.ErrorBanned`

#### Action: `shutdown`

```
POST /join
{ "action": "shutdown" }
```

Deactivates the world. Requires admin session.

**Confidence: LOW** — not yet tested.


### `GET /game` — Game Page

Requires authenticated user session (from `POST /join`). Returns the game UI HTML.

When no world is active, returns error page. Our `isWorldReady()` function checks
`GET /join` instead (which is the better choice since it doesn't require auth).


## Module Activation (Task 015)

Module activation is stored as a **world setting**, not in the world manifest.

```javascript
// In browser context (page.evaluate):
const config = game.settings.get("core", "moduleConfiguration") || {};
config["foundry-homebrew"] = true;
await game.settings.set("core", "moduleConfiguration", config);
// Requires page reload afterward
```

**Confidence: MEDIUM** — this is the documented approach from community sources and matches
how the Module Management UI works internally. But we haven't tested it programmatically.

**Open question:** Can this be done via HTTP API instead of `page.evaluate()`? The
`editWorld` setup action updates `world.json`, but module config lives in LevelDB. Hypothesis:
no HTTP-only path exists — `page.evaluate()` is the way.


## Client-Side APIs (for `page.evaluate()`)

These are used in BDD step definitions to arrange/assert game state.

### `game.settings`

```javascript
game.settings.get(namespace, key)              // → any
game.settings.set(namespace, key, value)       // → Promise<any>
game.settings.register(namespace, key, config) // → void (during init hook)
```

Settings scopes: `"world"` (DB, shared), `"client"` (localStorage), `"user"` (DB, per-user — new in v13).

**Confidence: HIGH** — well-documented, widely used.

### `game.actors` / `Actor`

```javascript
// Find
game.actors.get(id)                    // → Actor | undefined
game.actors.getName(name)              // → Actor | undefined
game.actors.find(fn)                   // → Actor | undefined

// CRUD
const actor = await Actor.create({ name, type, img, system })
await actor.update({ "system.field": value })
await actor.delete()
await Actor.deleteDocuments([id1, id2])
```

**Confidence: HIGH** — core Foundry API.

### Embedded Items on Actors

```javascript
// Create
const items = await actor.createEmbeddedDocuments("Item", [{ name, type, system }])

// Update
await items[0].update({ "system.light.remainingSecs": 600 })
// or
await actor.updateEmbeddedDocuments("Item", [{ _id, "system.field": value }])

// Delete
await actor.deleteEmbeddedDocuments("Item", [itemId])

// Find
actor.items.get(id)
actor.items.getName(name)
actor.items.find(fn)
actor.items.contents  // → Item[]
```

**Confidence: HIGH** — core Foundry API.

### Shadowdark Light Source Item Schema

Lives at `item.system.light`:

```javascript
{
  active: false,          // Currently lit?
  isSource: true,         // Is this a light source item?
  remainingSecs: 3600,    // Burn time remaining (seconds)
  longevityMins: 60,      // Total burn duration (minutes)
  template: "torch"       // Light template name
}
```

Templates: `torch`, `lantern`, `lightSpellNear`, `lightSpellDouble`.

**Confidence: HIGH** — verified from Shadowdark system source in `docs/shadowdark-light-tracker-api.md`.

### `game.modules`

```javascript
game.modules.get("foundry-homebrew")           // → Module | undefined
game.modules.get("foundry-homebrew")?.active   // → boolean
game.modules.get("foundry-homebrew")?.api      // → { lightTracker, scarletMinotaurEncounter, lightAdjuster }
```

**Confidence: HIGH** — this is how our module exposes its API.

### `game.messages` (Chat)

```javascript
game.messages.contents                         // → ChatMessage[]
game.messages.contents.at(-1)                  // → most recent
msg.content                                    // → HTML string
msg.whisper                                    // → User ID[] (empty = public)
msg.isRoll                                     // → boolean
msg.speaker                                    // → { scene, actor, token, alias }
```

**Confidence: HIGH** — core Foundry API.

### ApplicationV2 Toggle Pattern

```javascript
// Our modules use toggleInterface():
game.modules.get("foundry-homebrew").api.lightTracker.toggleInterface()

// Generic pattern:
if (app.rendered) await app.close();
else await app.render(true);

// Check state:
app.rendered   // → boolean
app.element    // → HTMLElement
```

**Confidence: HIGH** — matches our module source code.


## Flow for Test Global Setup

```
1. GET  /api/status       → check if world already active
2. POST /setup            → { action: "adminPassword", adminPassword: "..." }
                            Sets session.admin = true
3. POST /setup            → { action: "launchWorld", world: "lost-citadel" }
                            Returns {} immediately, world loads async
4. Poll GET /join          → wait for 200 without "no active game session"
                            Backoff: 500ms × 1.5, cap 5s, timeout 60s
5. POST /join             → { action: "join", userid: "<internal-id>", password: "" }
                            userid is the internal ID, NOT display name
                            Returns { status: "success", redirect: "/game" }
6. Save storageState       → cookies persisted for test reuse
```

**Confidence: HIGH** — this is what `global-setup.js` implements and it works.


## What to Verify with HAR Captures

Priority order:

1. **`GET /join` during world loading** — does it hang, 302, or return immediately with
   error text? This determines whether our polling approach is correct or just lucky.
2. **`POST /setup` with `action: "adminAuth"` vs `"adminPassword"`** — confirm the
   side-effect theory. What's the actual response body/status? (Partially verified: `adminAuth`
   works in practice, but we haven't inspected the response body.)
3. **`POST /setup` with `action: "launchWorld"` response** — confirm `{}` body.
4. **`POST /join` success response** — confirm JSON shape `{ request, status, redirect }`.
5. ~~**`POST /join` failure response** — confirm plain text body and 401 status.~~
   **VERIFIED:** 401 confirmed when sending display name instead of internal ID.
6. **`GET /api/status` during world loading** — does `active` flip before `game.ready`?
7. **Module activation via settings** — does `game.settings.set("core", "moduleConfiguration", ...)`
   require a reload, or does it hot-activate?
8. **`POST /join { action: "shutdown" }`** — response shape and required auth.

### Suggested HAR Recording Sessions

- Cold start: admin login → launch world → wait → join as GM
- Hot start: world already active → join as GM
- Join as player (non-GM)
- Shutdown world
- Failed login (wrong password)
- Module management toggle (browser devtools during Module Management UI)
