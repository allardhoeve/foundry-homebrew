# Scarlet Minotaur Random Encounter — Design Document

This document captures the design philosophy for the Scarlet Minotaur random encounter feature. It describes *what* the feature should do and *why* — not how it's built. Implementation should be derivable from this document. For source material, penalty tables, and roll flow, see `scarlet-minotaur-random-encounter-check.md`.

---

## Personas

### DM (primary)

The DM wants low-friction encounter rolls that don't break game flow. They need to see and adjust the Minotaur penalty at a glance. They want an "encounter now" escape hatch for ad-hoc drama or debugging.

### Players (secondary)

Players receive a public chat message when an encounter occurs. They should not know a check was made if nothing happened. The Scarlet Minotaur is a boss moment — its appearance should feel dramatic and distinct from ordinary encounters.

---

## The Encounter Check

Two cadence models, each with distinct gameplay character:

### 1d6 every two rounds (RAW)

- 1/6 (≈16.7%) chance per check, but only one check per two-round window.
- Higher spike probability per check.
- Cannot trigger two encounters in back-to-back rounds.

### 1d12 every round (convenience)

- 1/12 (≈8.3%) chance per round.
- Over two rounds: 1 − (11/12)² ≈ 16.0% — close but not identical to RAW.
- Can trigger encounters on consecutive rounds.
- Lower per-check tension, but removes the "did I roll last round?" tracking burden.

### The qualitative difference

1d12 trades the sharp every-other-round spike for smoother per-round risk, and opens the possibility of back-to-back encounters. Neither model is strictly better — it's a DM preference based on whether they value bookkeeping reduction or the sharper probability pulse.

The DM should be able to choose which model they prefer.

---

## Noise Check

When the party makes noise, the DM rolls an extra 1d6 check immediately, regardless of which cadence model is active. This is always 1d6 — noise is an acute event, not part of the regular cadence.

---

## The Scarlet Minotaur & Penalty Stacking

The d8 encounter table has a cumulative −2 penalty that pushes results toward the Minotaur (result 1). Each time the table is rolled without hitting the Minotaur, the penalty grows. Rolling the Minotaur resets it to 0.

This creates a tension arc: the Minotaur becomes increasingly inevitable. Players may not know the mechanic, but they'll feel the pattern — encounters skew toward the Minotaur the longer they explore. The reset creates relief and a fresh cycle.

---

## Chat Message Philosophy

- **No encounter:** Only the DM knows a check happened. Players should not be aware of checks that produce nothing — it preserves immersion and avoids "nothing happened" noise.
- **Normal encounter:** Public, atmospheric. The dungeon speaks — not a game system reporting a result.
- **Scarlet Minotaur:** Public, dramatic. This is a boss moment. Distinct visual treatment that signals danger before players even read the text.
- **Debug breakdown:** DM-only. Raw numbers for verification. The DM should always be able to see the math behind a result.

---

## UI Design Principles

- **Unified with the Light Tracker:** Dark aesthetic, Blackletter title, same visual family. These are sibling tools for the same dungeon.
- **Button hierarchy communicates frequency:** The primary check is prominent (gold), the noise check is secondary (muted), the "encounter now" button is tertiary (subtle/debug).
- **Penalty is always visible** — it's the key state the DM needs to track. Visually escalates (neutral → crimson) as it grows.
- **Manual penalty adjustment:** The DM may need to correct the penalty (e.g., narrative override, session continuity). This should be easy but not prominent.
- **Help text:** Available but hidden by default. The UI should be self-explanatory after first use.

---

## General Principles

- **Keep the DM in flow.** One click to roll. Results route themselves — the DM doesn't decide who sees what.
- **Transparency for the DM.** Every roll shows its math in a debug whisper. The DM should never wonder "how did that result happen?"
- **Atmosphere for the players.** Public messages should feel like the dungeon, not a system. Flavor text, dramatic styling, thematic speaker aliases.
- **Design without implementation.** This document describes what the feature should do and why, not how it's built. Implementation is derived from this.
