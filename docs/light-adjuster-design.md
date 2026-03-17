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
