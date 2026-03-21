# Foundry VTT API Reference

**Version:** v13 build 351 (Shadowdark system 3.6.2)

This documents the **undocumented** parts of Foundry VTT — the HTTP server API,
WebSocket protocol, and gotchas that the official docs miss or get wrong. For the
client-side JavaScript API (`game.*`, `Actor`, `Item`, etc.), use the
[official API docs](https://foundryvtt.com/api/v13/index.html).

## Contents

| Document | What it covers |
|----------|---------------|
| [session-and-auth.md](session-and-auth.md) | Cookie-based sessions, admin auth, user join flow |
| [http-routes.md](http-routes.md) | Server HTTP endpoints (`/setup`, `/join`, `/game`, `/api/status`) |
| [websocket-protocol.md](websocket-protocol.md) | Socket.IO events and lifecycle per page |
| [gotchas.md](gotchas.md) | Things the official docs miss, get wrong, or don't explain |
| [open-questions.md](open-questions.md) | Unverified hypotheses to test |

## How this was built

Derived from HAR captures (Chrome DevTools), `curl` verification, and source code
analysis. Two HAR sessions were recorded against `localhost:30000` (Docker Foundry):

| File | Abbreviation | Scenario |
|------|-------------|----------|
| `login-start-world-join-return-to-setup.har` | **cold-start** | Admin login → launch world → join as GM → shutdown → return to setup |
| `running-admin-login-logout.har` | **hot-start** | World already running → join as GM → logout |

Evidence references use the format `cold-start#42` (HAR entry index).

## How to update

On a new Foundry release:
1. Record new HAR captures for the same scenarios
2. Diff against existing docs
3. Update and re-verify with `curl`
