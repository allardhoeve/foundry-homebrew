# Session & Authentication

## Session Cookie

Foundry uses a standard HTTP cookie for session management.

| Field | Value |
|-------|-------|
| Cookie name | `session` |
| Format | 24-char hex string |
| Max-Age | 86400 (1 day) |
| Path | `/` |
| SameSite | `Strict` |
| HttpOnly | No (not set) |
| Secure | No (not set) |

Every HTTP response sets this cookie via `Set-Cookie`. The session is created
automatically on first contact with any route.

The same session ID appears in the WebSocket URL as a query parameter:
```
ws://localhost:30000/socket.io/?session=<24-char-hex>&EIO=4&transport=websocket
```

Session state (server-side):
```json
{
  "id": "14bb53644bfb4afd921edd86",
  "admin": false,
  "expires": "<timestamp>",
  "worlds": {
    "lost-citadel": "CSuZNwbNkDdfUfWD"
  }
}
```

**Implication for Playwright tests:** `ctx.storageState()` captures cookies. Playwright
saves the `session` cookie and replays it in the browser context.

**Chrome HAR discrepancy:** Chrome DevTools HAR export omits cookies from the
export despite them being present in actual traffic. Verified by `curl -v` which
shows `Set-Cookie` on every response.


## Admin Authentication

The browser's admin login form submits to `POST /auth` (form-encoded):

```
POST /auth
Content-Type: application/x-www-form-urlencoded

adminPassword=<key>&action=adminAuth
```

Response: `302 Found` → `/setup`. Session cookie now has `admin: true`.

**Only works in setup mode.** When a world is active, `POST /auth` redirects
`302 → /auth → /join`. The admin auth route is inaccessible while a world is running.

**Alternative route:** `POST /setup` with JSON `{"action": "adminAuth", "adminPassword": "..."}`
also works (this is what our test global-setup uses). Different route and encoding,
same effect. When a world is active, this returns `403 Forbidden`.

Evidence: cold-start#1.


## User Join (Game Authentication)

```json
POST /join
Content-Type: application/json

{ "action": "join", "userid": "CSuZNwbNkDdfUfWD", "password": "" }
```

**The `userid` field is the internal Foundry user ID** (16-char alphanumeric), NOT
the display name. Sending `"Gamemaster"` returns 401.

| Response | Meaning |
|----------|---------|
| `200` | Authenticated |
| `401` (plain text) | Failed — locale key like `JOIN.ErrorUserDoesNotExist` |

Response body (86 bytes, verified via `curl`):
```json
{"request":"join","status":"success","message":"JOIN.LoginSuccess","redirect":"/game"}
```

**How to find user IDs:**
```javascript
// In browser console on /game:
game.users.contents.map(u => ({ id: u.id, name: u.name, role: u.role }))
```
Or inspect the WebSocket `getJoinData` response which includes a `users` array
with `_id` and `name` fields.

Evidence: cold-start#95, hot-start#38.


## Logout

There is **no logout endpoint**. Logging out is simply navigating to `/join`.
The game world remains active. A new WebSocket opens with the same session ID
but `userId: null`.

Evidence: hot-start#101, hot-start#125.


## Test Global Setup Flow

```
1. GET  /api/status       → check if world already active
2. POST /setup            → { action: "adminAuth", adminPassword: "..." }
                            (browser uses POST /auth with form-encoding instead,
                             but our JSON POST to /setup also works)
3. POST /setup            → { action: "launchWorld", world: "lost-citadel" }
                            Returns {} (2 bytes), world loads async
4. Poll GET /join          → wait for 200 without "no active game session"
                            Backoff: 500ms × 1.5, cap 5s, timeout 60s
5. POST /join             → { action: "join", userid: "<internal-id>", password: "" }
                            userid is the internal ID, NOT display name
                            Response: { status: "success", redirect: "/game" }
6. Save storageState       → persists session cookie for browser reuse
```
