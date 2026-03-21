# HTTP Routes

All routes are on the Foundry server (default `localhost:30000`).


## `GET /` — Root

Always redirects.

| World state | Response |
|-------------|----------|
| World active | `302` → `/join` |
| No world | `302` → `/setup` |

Evidence: hot-start#0, cold-start#163.


## `GET /api/status` — Health Check

No auth required.

**World active** (verified via `curl`):
```json
{
  "active": true,
  "version": "13.351",
  "world": "lost-citadel",
  "system": "shadowdark",
  "systemVersion": "3.6.2",
  "users": 1,
  "uptime": 1471792
}
```

**No world active** (from cold-start HAR):
- `304 Not Modified`, ~35 bytes (cached).
- Likely: `{ "active": false, "version": "13.351" }` (35 bytes matches).

Evidence: cold-start#0.


## `POST /auth` — Admin Authentication (Browser Route)

See [session-and-auth.md](session-and-auth.md#admin-authentication).

Form-encoded, NOT JSON. Only works in setup mode.


## `POST /setup` — Setup Actions

All requests use `Content-Type: application/json` and include an `action` field
(except shutdown — see below). Requires admin session.

### Action: `launchWorld`

```json
{ "action": "launchWorld", "world": "lost-citadel" }
```

Response: `200`, 2 bytes (`{}`). Launch accepted — world loads asynchronously.
Progress is delivered via WebSocket (see [websocket-protocol.md](websocket-protocol.md)).

Five launch phases observed:
1. `connectWorld` ("SETUP.WorldLaunchConnect") — 14 progress ticks
2. `migrateWorld` ("SETUP.WorldLaunchMigrate") — 14 ticks
3. `connectPackage` ("SETUP.WorldLaunchConnectPackage") — 22 ticks
4. `migratePackage` ("SETUP.WorldLaunchMigratePackage") — 22 ticks
5. `complete` (pct: 100)

Each tick: `{ step, pct, id: "lost-citadel", hasChanged: true, action: "launchWorld" }`

Evidence: cold-start#56.

### Action: `listBackups`

```json
{ "action": "listBackups" }
```

Response: `200`
```json
{ "module": {}, "system": {}, "world": {}, "snapshots": {} }
```

Evidence: cold-start#48, cold-start#211.

### Shutdown (no action field!)

```json
{ "shutdown": true }
```

Note: this does NOT use the `action` pattern. The field is `"shutdown": true`.

Response: `302` → `/setup`. `text/plain`, Content-Length: 28.

The server may be briefly unavailable during shutdown (status 0 observed on
the redirect follow).

Evidence: cold-start#161.

### Action: `editWorld`

```json
{ "action": "editWorld", "id": "lost-citadel", ...fields }
```

Not observed in HAR. Confidence: LOW.

### Other known actions

| Action | Verified | Purpose |
|--------|----------|---------|
| `launchWorld` | HAR | Launch a world |
| `listBackups` | HAR | List backups |
| `adminPassword` | Source | Authenticate admin (JSON route — browser uses POST /auth instead) |
| `adminLogout` | Source | Revoke admin session |
| `editWorld` | Source | Update world manifest |
| `installPackage` / `uninstallPackage` | Source | Package management |


## `GET /join` — Join Page / World Readiness

| State | Response | Timing |
|-------|----------|--------|
| World active | `200` — join form HTML (2696 bytes) | ~4-22ms |
| No world active | `200` — error page with `"no active game session"` | immediate |

Join page HTML (from hot-start HAR):
```html
<body class="auth join flexcol background theme-dark join-theme-default">
  <header id="main-header"><h1>Lost Citadel</h1></header>
  <template id="join-game"></template>
</body>
```

Key identifiers:
- Body classes: `auth join flexcol background theme-dark join-theme-default`
- World name in `<title>` and `<h1>`
- Join form is a `<template id="join-game">` (populated client-side via WebSocket)
- Does NOT contain `"no active game session"` when world is active

Evidence: hot-start#1, hot-start#101, cold-start#58.


## `POST /join` — Authenticate as Game User

See [session-and-auth.md](session-and-auth.md#user-join-game-authentication).


## `GET /game` — Game Page

| State | Response |
|-------|----------|
| User authenticated | `200` — game HTML (3861 bytes) |
| Not authenticated | `302` → `/join` |

Evidence: cold-start#57, cold-start#96, hot-start#39.


## Assets Loaded per Page

**All pages:** `foundry2.css`, `fontawesome`, jQuery, Handlebars, Pixi.js, Socket.IO,
TinyMCE, `vendor.mjs`, `foundry.mjs`, fonts, `lang/en.json`, tour JSONs.

**`/game` additionally loads:**
- `simplepeer.min.js` (WebRTC)
- `systems/shadowdark/shadowdark-compiled.mjs`
- `modules/foundry-homebrew/src/player-light-tracker.js`
- `modules/foundry-homebrew/src/scarlet-minotaur-encounter.js`
- `modules/foundry-homebrew/src/light-adjuster.js`
- System + module CSS files
- `systems/shadowdark/i18n/en.json`
- UI textures: `denim075.png`, `parchment.jpg`
