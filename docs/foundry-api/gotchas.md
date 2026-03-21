# Gotchas

Things the official Foundry docs miss, get wrong, or don't explain clearly.


## HTTP API

### `POST /join` requires the internal user ID, not the display name

The `userid` field must be the 16-char alphanumeric internal ID (e.g.,
`CSuZNwbNkDdfUfWD`), not the display name (`Gamemaster`). Sending the display
name returns `401`.

### `POST /auth` is form-encoded, not JSON

The browser admin login uses `Content-Type: application/x-www-form-urlencoded`.
However, `POST /setup` with JSON `{"action": "adminAuth", ...}` also works as
an alternative route.

### Shutdown uses `{ "shutdown": true }`, not `{ "action": "shutdown" }`

The shutdown request to `POST /setup` breaks the `action` pattern used by every
other setup endpoint.

### `POST /auth` only works when no world is active

When a world is running, `POST /auth` redirects `302 → /auth → /join`.
Similarly, `POST /setup` with `adminAuth` returns `403 Forbidden` when a world
is active.

### Chrome HAR exports omit cookies

Chrome DevTools HAR export does not include `Set-Cookie` headers or `Cookie`
request headers. This is a Chrome bug, not a Foundry behavior. Use `curl -v`
to verify cookie behavior.


## UI / DOM

### `#board` is a `<template>` — use `#sidebar` for readiness

`#board` is a `<template>` element that stays hidden when no scene is active.
Use `#sidebar` as the game-ready signal — it's always visible when the game is
loaded.

### Minimum viewport: 1366x768

Foundry requires at least 1366x768. Below that, Foundry logs a console error
and may not render properly. Our Playwright config uses 1920x1080.


## Hooks

### `renderChatMessage` is deprecated

Use `renderChatMessageHTML` instead. The new hook passes an `HTMLElement` argument
instead of jQuery.


## WebSocket

### Join form is populated client-side via WebSocket

The `GET /join` HTML response contains a `<template id="join-game">` that is
empty. The actual join form is populated by client-side JavaScript after the
`getJoinData` WebSocket response arrives.

### World launch is asynchronous

`POST /setup` with `launchWorld` returns immediately (`200`, `{}`). The actual
launch progress comes over WebSocket. You must poll `GET /join` or listen on
the WebSocket to know when the world is ready.


## Testing

### `storageState` works because of cookies

Playwright's `ctx.storageState()` captures the `session` cookie. This is the
standard mechanism — no magic.

### World data directory bootstrapping

A fresh `docker/data/` directory needs game system installation, world creation,
user setup, and settings — too much to automate via API. Use a known-good tarball
instead.
