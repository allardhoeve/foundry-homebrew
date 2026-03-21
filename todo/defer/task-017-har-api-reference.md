# Task 017: Auto-capture HAR files from BDD tests and distill into API reference

Independent of other tasks (uses existing BDD infrastructure from task-013/014).

## Goal

Automatically record Foundry VTT's HTTP/socket traffic during BDD test runs, then distill the captured HARs into a structured API reference that lives in the repo. The primary consumer is the LLM — having a reliable API reference eliminates repeated discovery of Foundry's undocumented endpoints each session.

## Background

Foundry VTT has no public API spec (no Swagger/OpenAPI). The client-server protocol is socket.io-based and undocumented. Module developers (and LLMs assisting them) rediscover endpoint behavior by trial and error every time.

Our BDD tests already exercise real Foundry scenarios via Playwright against a Docker instance. Playwright has built-in HAR recording (`recordHar` context option), so we can capture traffic as a free side effect of tests we're already running.

Foundry releases are infrequent — the captured API contracts stay valid for long periods. On a new release, re-running the BDD suite regenerates the HARs and a diff shows what changed.

## Approach

### 1. Add HAR recording to the Playwright fixture

In `tests/support/fixtures.js`, configure `recordHar` on the browser context so each scenario produces its own HAR file:

```js
context = await browser.newContext({
  storageState: '...',
  recordHar: {
    path: `tests/hars/${testInfo.title}.har`,
    urlFilter: /^https?:\/\/localhost/  // only capture Foundry traffic
  }
});
```

- HARs go to `tests/hars/` (gitignored — they're build artifacts, not source)
- Filter to localhost to avoid noise from external requests

### 2. Write a distiller script

A Node script (`scripts/distill-hars.js` or similar) that:

- Reads all `.har` files from `tests/hars/`
- Extracts unique endpoint signatures: method, URL path, request content-type, response status
- Groups by endpoint, deduplicates
- For each endpoint, picks one representative request/response pair and extracts the payload shape (keys and types, not full values)
- Outputs structured markdown to `docs/api/`

### 3. Structure the API reference

```
docs/api/
├── README.md              # overview, how to regenerate
├── setup-and-auth.md      # /setup, /join, session endpoints
├── game-state.md          # /game, socket events for world data
└── ...                    # grouped by domain area
```

Each endpoint entry should include:
- Method + URL pattern
- When it's used (which scenario triggered it)
- Request shape (headers, body keys/types)
- Response shape (status, body keys/types)
- One concrete example (sanitized)

## Open questions

- [ ] Should we capture WebSocket frames too, or just HTTP? Playwright HAR captures HTTP well but socket.io frames may need extra handling.
- [ ] What's the right granularity for the distilled docs — one file per domain area, or one file per endpoint?
- [ ] Should the distiller output JSON (machine-readable, could generate OpenAPI later) or markdown (human/LLM-readable)?
- [ ] Do we want a CI step that regenerates and commits the docs, or is this a manual `npm run docs:api` task?

## Acceptance criteria

- [ ] BDD test runs produce HAR files as a side effect (no manual capture needed)
- [ ] A script distills HARs into a structured API reference in `docs/api/`
- [ ] The reference is useful to the LLM — reduces or eliminates endpoint discovery fumbling
- [ ] HAR files themselves are gitignored; only the distilled docs are committed
- [ ] Running the BDD suite + distiller is documented in a single command

## Scope boundaries

- **In scope**: HAR recording, distillation script, API reference docs
- **Out of scope**: Building a JS API client library, OpenAPI spec generation, testing against non-local Foundry instances
