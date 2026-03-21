# WebSocket Protocol

All real-time data flows through Socket.IO over WebSocket.

```
ws://localhost:30000/socket.io/?session=<24-char-hex>&EIO=4&transport=websocket
```

Upgrades to `101 Switching Protocols`. Each page (setup, join, game) opens its own
WebSocket connection.


## Session Event

Sent on every WebSocket connect:

```json
{ "sessionId": "14bb53644bfb4afd921edd86", "userId": null }
```

`userId` is `null` on setup and join pages. On the game page, it contains the
authenticated user's internal ID:

```json
{ "sessionId": "14bb53644bfb4afd921edd86", "userId": "CSuZNwbNkDdfUfWD" }
```


## Events by Page

| Page | Client sends | Server responds with |
|------|-------------|---------------------|
| `/setup` | `getSetupData` | Worlds, modules, systems, packages, options, news |
| `/join` | `getJoinData` | Release info, world, users (with `_id` and `name`), passwordString |
| `/game` | `world` | Full game state: actors, scenes, items, journal, macros, settings, etc. |


### `/setup` — `getSetupData`

Response includes `isAdmin: true`, `isSetup: true`, and full package lists.

Evidence: cold-start#28 (101 messages).

### `/join` — `getJoinData`

Response includes:
```json
{
  "users": [{"name": "Gamemaster", "role": 4, "_id": "CSuZNwbNkDdfUfWD", "color": "#285fcc"}],
  "isAdmin": true,
  "passwordString": "••••••••••••••••"
}
```

This is where you can discover user IDs for `POST /join`.

Evidence: cold-start#84 (14 messages).

### `/game` — `world`

Response includes all game data. Observed sizes:
- actors: ~170K chars
- scenes: ~289K chars

On shutdown, the server sends a `shutdown` event:
```json
{"world": "lost-citadel", "userId": "CSuZNwbNkDdfUfWD"}
```

Evidence: cold-start#129 (369 messages), hot-start#69.


## World Launch Progress (via `/setup` WebSocket)

After `POST /setup` with `launchWorld`, progress is delivered as WebSocket events.
See [http-routes.md](http-routes.md#action-launchworld) for the five phases and
tick format.
