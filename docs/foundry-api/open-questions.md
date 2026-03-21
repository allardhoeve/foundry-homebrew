# Open Questions

Non-blocking. Investigate if/when relevant.

- **`GET /join` during world loading** — never observed mid-launch. Current polling
  approach works regardless. Hypothesis: returns "no active game session" error page
  (same as when no world is active).

- **`GET /api/status` during loading** — unknown if `active` flips to `true` before
  `game.ready`. Hypothesis: `active: false` until fully loaded.
