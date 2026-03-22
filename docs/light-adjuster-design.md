# Light Adjuster — Design Philosophy

## Personas

### GM

The GM who needs to reconcile light timers with narrative time jumps. Shadowdark tracks light in real-time, but the story doesn't always move in real-time — the party rests at camp, travels a corridor montage-style, or the GM skips ahead to the next interesting moment. When that happens, every active light source needs its timer adjusted to match. The Light Adjuster exists for this single workflow.

No player persona is needed. Players don't manage light duration — that tension belongs to the system and the GM.

## The Problem

Shadowdark's real-time light tracking is central to its design, but it creates a bookkeeping gap whenever narrative time diverges from table time. A ten-minute rest means every lit torch should lose ten minutes. Without a tool for this, the GM either does mental math per actor, ignores the discrepancy, or breaks flow to adjust timers one by one. None of those are acceptable mid-session.

## Window

A compact utility panel — not a dashboard, not atmospheric. This is a knob the GM turns and moves on.

- **Title** → **Buttons** → **Status** (follows the shared layout hierarchy)
- 2×2 button grid: **±1 min**, **±10 min** — covers the two most common adjustments (a quick corridor vs. a short rest)
- Live timer display updates via hooks so the GM sees the effect immediately
- No torch animation, no portraits, no atmosphere — that belongs to the Light Tracker

## General Principles

**Batch over individual.** The adjuster changes ALL active light sources at once. The GM shouldn't have to touch each actor — "the party rested for ten minutes" is a single action, not five.

**Speed over precision.** Preset increment buttons, not a text input. The GM is mid-session and reaching for this tool in a gap between scenes. Two clicks to add ten minutes is fast enough; typing "10" into a field is not.

**Transparent feedback.** A status line confirms what changed — e.g. *"Advanced 3 lights by 10 min"*. Silent mutations erode trust; the GM needs to know the tool did what they expected.

**Companion, not replacement.** The Light Adjuster works alongside the Light Tracker. It doesn't duplicate the tracker's display or atmosphere — it adjusts the underlying timers and gets out of the way.

## Integration with the Shadowdark Light Source Tracker

The adjuster updates `system.light.remainingSecs` directly on each item. It does **not** handle light expiration itself — that responsibility belongs to the system's `LightSourceTrackerSD`.

**How expiration works:** The system tracker polls on a configurable interval (default 30 seconds). On each tick it re-reads all light items, and when it finds `remainingSecs <= 0` it runs the full expiration chain: `actor.yourLightExpired()` → `actor.turnLightOff()` → item deletion → chat message.

**Consequence:** When the adjuster reduces a light to 0, there can be up to a 30-second delay before the system tracker picks it up and douses the light. This is a design tradeoff of the system's polling architecture — the tracker exposes no public method to force an immediate tick. The `dirty` flag (set automatically by item update hooks) ensures the next tick processes the change; it just can't make the tick come sooner.

**Why we don't douse lights ourselves:** The system's `turnLightOff()` zeroes the actor's *entire* token light (`dim: 0, bright: 0`), which would extinguish all lights on that actor — not just the depleted one. Letting the tracker handle expiration through its normal flow correctly handles actors with multiple light sources.
