# Task 007: Player Light Tracker — Party Light Awareness

Depends on task-001. Independent of tasks 002, 003, 004, 005, 006.

## Goal

Make the light tracker group-aware so that characters without their own light source see a thematic "you're relying on someone else's light" message instead of the incorrect "The darkness engulfs you."

## Background

Currently, every character without an active personal light source sees "The darkness engulfs you" — even if a party member is holding a lit torch three feet away. This is atmospheric but wrong. A character standing next to a torchbearer can see just fine; they simply don't have their own flame.

We need middle states: *you can see, but your safety depends on someone else's light*. The party states mirror the personal light thresholds (bright/good/fading), so dependent characters feel the urgency as the party's best light depletes. This keeps the tension ("don't wander off") without lying to the player.

## The state machine

The tracker currently has four states. This task adds three party-dependent states — `PARTY_BRIGHT`, `PARTY_GOOD`, and `PARTY_FADING` — reflecting the strength of the party's best light source, and redefines when `DARKNESS` applies.

```
┌──────────────────────────────────────────────────────────────────┐
│                    PERSONAL LIGHT?                                │
│                         │                                         │
│              ┌──── yes ─┤── no ──┐                                │
│              │          │        │                                 │
│              ▼          │        ▼                                 │
│     ┌────────────────┐  │  ┌───────────────────┐                  │
│     │ BRIGHT / GOOD  │  │  │   PARTY LIGHT?    │                  │
│     │  / FADING      │  │  │                   │                  │
│     │ (as today)     │  │  ├── yes ──┐         │                  │
│     └───────┬────────┘  │  │         ▼         │                  │
│             │           │  │  ┌──────────────┐ │                  │
│             │ remaining │  │  │ best party   │ │                  │
│             │ hits 0    │  │  │ light frac:  │ │                  │
│             │           │  │  │ >50%  PARTY_ │ │                  │
│             ▼           │  │  │       BRIGHT │ │                  │
│     ┌───────────┐       │  │  │ 25-50 PARTY_ │ │                  │
│     │  light    │       │  │  │       GOOD   │ │                  │
│     │  expires  │───────┼──┤  │ <25%  PARTY_ │ │                  │
│     │           │       │  │  │       FADING │ │                  │
│     └───────────┘       │  │  └──────────────┘ │                  │
│                         │  │                   │                  │
│                         │  ├── no ───┐         │                  │
│                         │  │         ▼         │                  │
│                         │  │   ┌─────────┐     │                  │
│                         │  │   │DARKNESS │     │                  │
│                         │  │   └─────────┘     │                  │
│                         │  └───────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

### State definitions

| State | Condition | Status text | Animation |
|-------|-----------|-------------|-----------|
| `BRIGHT` | Actor has personal light, fraction > 50% | "Your light shines brightly" | Torch/staff flame (as today) |
| `GOOD` | Actor has personal light, fraction 25–50% | "Your light shines well" | Dimmer flame (as today) |
| `FADING` | Actor has personal light, fraction < 25% | "Your light starts to fade" | Flickering flame (as today) |
| `PARTY_BRIGHT` | **No personal light**, best party light fraction > 50% | "The party has strong light. Don't stray." | No flame animation (black), eerie text styling |
| `PARTY_GOOD` | **No personal light**, best party light fraction 25–50% | "The party has weak light. Stay close." | No flame animation (black), eerie text styling |
| `PARTY_FADING` | **No personal light**, best party light fraction < 25% | "The party's light is fading." | No flame animation (black), eerie text styling |
| `DARKNESS` | **No personal light**, and **no party member** has light either | "The darkness engulfs you" | No flame animation (black), as today |

### Transition summary

| From → To | Trigger |
|-----------|---------|
| DARKNESS → BRIGHT/GOOD/FADING | Actor lights a personal source |
| DARKNESS → PARTY_* | A party member lights a source |
| PARTY_* → BRIGHT/GOOD/FADING | Actor lights their own source |
| PARTY_* → DARKNESS | Last party light expires or is doused |
| BRIGHT/GOOD/FADING → PARTY_* | Personal light expires but party still has light |
| BRIGHT/GOOD/FADING → DARKNESS | Personal light expires and no party light exists |
| BRIGHT → GOOD → FADING | Time passes, personal fraction decreases |
| PARTY_BRIGHT → PARTY_GOOD → PARTY_FADING | Time passes, best party light fraction decreases |

### Important: what counts as "party"

All actors of type `"Player"` in the world — the same set we already use for the character selector. We do **not** filter by ownership; even unowned PCs count, because in the fiction they're in the same dungeon.

## Context

- `macros/player-light-tracker.js` — all tracker logic lives here
- `actor.getActiveLightSources()` — Shadowdark API, returns active light items for an actor
- `game.actors.filter(a => a.type === "Player")` — all PC actors in the world

## Design decisions (resolved)

| Question | Decision |
|----------|----------|
| What text for the party-dependent states? | Three tiers: "The party has strong light. Don't stray." / "The party has weak light. Stay close." / "The party's light is fading." |
| Show whose light they're relying on? | No — keep it vague and atmospheric |
| Animation for PARTY_* states? | None (black). The absence of flame reminds them they have no personal light |
| CSS styling for PARTY_* states? | Three progressively dimmer cool blue-gray tones — lighter for PARTY_BRIGHT, dimmest for PARTY_FADING |
| Torches AND spells active in party? | Irrelevant for the dependent character — they just know light exists nearby. The light *type* only matters for your own personal animation |
| Douse button in PARTY_* states? | No — you have nothing to douse |
| Hook registration | Must also listen for item changes on *all* party actors, not just the viewed actor |

## Changes

### Modified: `macros/player-light-tracker.js`

#### 1. Add `PARTY_*` state constants

```javascript
const STATES = {
    DARKNESS: "darkness",
    BRIGHT: "bright",
    GOOD: "good",
    FADING: "fading",
    PARTY_BRIGHT: "party-bright",
    PARTY_GOOD: "party-good",
    PARTY_FADING: "party-fading",
};
```

#### 2. Add party-state data constants (alongside `DARKNESS_DATA`)

```javascript
const PARTY_BRIGHT_DATA = {
    stateKey: STATES.PARTY_BRIGHT,
    statusText: "The party has strong light. Don't stray.",
    lightName: null,
    lightItem: null,
    lightType: "torch",
};

const PARTY_GOOD_DATA = {
    stateKey: STATES.PARTY_GOOD,
    statusText: "The party has weak light. Stay close.",
    lightName: null,
    lightItem: null,
    lightType: "torch",
};

const PARTY_FADING_DATA = {
    stateKey: STATES.PARTY_FADING,
    statusText: "The party's light is fading.",
    lightName: null,
    lightItem: null,
    lightType: "torch",
};
```

#### 3. Rewrite `_getLightData()` with three-tier check

```javascript
async _getLightData() {
    const actor = this.actor;
    if (!actor) return DARKNESS_DATA;

    // 1. Personal light — works exactly as before
    const activeLights = await actor.getActiveLightSources();
    if (activeLights?.length > 0) {
        const sorted = [...activeLights].sort(
            (a, b) => a.system.light.remainingSecs - b.system.light.remainingSecs
        );
        const item = sorted[0];
        const state = getLightState(item);
        return {
            stateKey: state.key,
            statusText: state.text,
            lightName: item.name,
            lightItem: item,
            lightType: getLightType(item),
        };
    }

    // 2. Party light — find best light among all other PCs
    const partyActors = game.actors.filter(
        a => a.type === "Player" && a._id !== actor._id
    );
    let bestPartyLight = null;
    for (const partyActor of partyActors) {
        const partyLights = await partyActor.getActiveLightSources();
        if (partyLights?.length > 0) {
            for (const light of partyLights) {
                if (!bestPartyLight || light.system.light.remainingSecs > bestPartyLight.system.light.remainingSecs) {
                    bestPartyLight = light;
                }
            }
        }
    }
    if (bestPartyLight) {
        const state = getLightState(bestPartyLight);
        if (state.key === STATES.BRIGHT) return PARTY_BRIGHT_DATA;
        if (state.key === STATES.GOOD) return PARTY_GOOD_DATA;
        return PARTY_FADING_DATA;
    }

    // 3. True darkness
    return DARKNESS_DATA;
}
```

#### 4. Add CSS for the PARTY state

```css
/* State: party-bright (strong party light) */
.plt-state-party-bright .plt-status-text {
    color: #8a9aaa;
    text-shadow: 0 0 8px rgba(138, 154, 170, 0.2);
    font-size: 24px;
}

/* State: party-good (weak party light) */
.plt-state-party-good .plt-status-text {
    color: #7a8a9a;
    text-shadow: 0 0 8px rgba(122, 138, 154, 0.15);
    font-size: 24px;
}

/* State: party-fading (party light fading) */
.plt-state-party-fading .plt-status-text {
    color: #6a7a8a;
    text-shadow: 0 0 6px rgba(106, 122, 138, 0.1);
    font-size: 24px;
}
```

Cool blue-gray tones, progressively dimmer — they can see, but the warmth isn't theirs. `party-bright` is the lightest, `party-fading` the dimmest. Slightly smaller font so the longer text fits well.

#### 5. Broaden hook registration

Currently hooks only fire for the viewed actor. We need to also listen for light changes on other party members, since their lights going on/off changes our state.

The `_registerHooks` method should register `updateItem`, `createItem`, and `deleteItem` hooks that fire the refresh for *any* party actor, not just the viewed one:

```javascript
// Instead of checking just actorId, check all party actor IDs
const partyIds = new Set(
    game.actors.filter(a => a.type === "Player").map(a => a._id)
);

register("updateItem", (item) => {
    if (partyIds.has(item.parent?._id)) refresh();
});
```

## Pitfalls

- **Performance**: `getActiveLightSources()` is async and we now call it for multiple actors. Should be fine for typical party sizes (4–6) but don't loop unnecessarily — bail out as soon as we find one lit party member.
- **Hook spam**: Broadening hooks to all party actors means more triggers. The existing 250ms debounce should handle this, but keep an eye on it.
- **Transition animations**: The `PARTY_*` states have no video (like `DARKNESS`). Transitions from personal-light states to `PARTY_*` should play the extinguish animation, same as transitioning to `DARKNESS`. The `isLit()` helper should treat all `PARTY_*` states as unlit.

## Acceptance criteria

- [ ] Character with personal light sees BRIGHT/GOOD/FADING as before (no regression)
- [ ] Character with no personal light but a party member has bright light (>50%) sees "The party has strong light. Don't stray."
- [ ] Character with no personal light but a party member has good light (25–50%) sees "The party has weak light. Stay close."
- [ ] Character with no personal light but a party member has fading light (<25%) sees "The party's light is fading."
- [ ] Character with no personal light and no party light sees "The darkness engulfs you"
- [ ] When the last party light expires, dependent characters transition from PARTY_FADING → DARKNESS
- [ ] When a party member lights a torch, characters in DARKNESS transition to PARTY_BRIGHT
- [ ] As the best party light depletes, dependent characters transition PARTY_BRIGHT → PARTY_GOOD → PARTY_FADING
- [ ] The douse button does not appear in any PARTY_* state
- [ ] Extinguish animation plays when transitioning from personal light to PARTY_*
- [ ] Each party state uses progressively dimmer cool blue-gray styling, distinct from both lit and darkness states

## Scope boundaries

- **In scope**: party light awareness, three PARTY_* strength states, broadened hooks, CSS for new states
- **Out of scope**: showing *whose* light you depend on, distance-based light (proximity), light type awareness for dependent characters, NPC light sources
