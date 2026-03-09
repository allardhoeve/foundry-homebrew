# Shadowdark Light Tracker API Reference

Reference documentation for the Shadowdark system's light source tracking internals,
based on analysis of `third_party/foundryvtt-shadowdark/`.

## Core Classes

### LightSourceTrackerSD

**File:** `system/src/apps/LightSourceTrackerSD.mjs`
**Extends:** `foundry.appv1.api.Application`
**Instance:** `game.shadowdark.lightSourceTracker`

GM-only application. The `render()` method explicitly blocks non-GM users:

```javascript
async render(force, options) {
    if (!game.user.isGM) return;
    super.render(force, options);
}
```

#### Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `monitoredLightSources` | `Array` | Actor data objects with `.lightSources[]` arrays |
| `dirty` | `boolean` | Flag that triggers `_gatherLightSources()` on next tick |
| `realTime` | `RealTimeSD` | Real-time clock for automatic time advancement |
| `performingTick` | `boolean` | Lock to prevent concurrent updates |
| `updatingLightSources` | `boolean` | Lock during light source gathering |

#### Key Methods

| Method | Description |
|--------|-------------|
| `start()` | Starts the tracker (GM only). Gathers light sources, starts housekeeping interval (1s), optionally auto-opens UI |
| `toggleInterface(force)` | Opens/closes the UI. Without `force=true`, requires GM |
| `toggleLightSource(actor, item)` | Toggles a light on/off. Non-GM players emit a socket event instead |
| `onUpdateWorldTime(worldTime, worldDelta)` | Called on `updateWorldTime` hook. Decrements `remainingSecs` for all tracked lights. Expires lights at 0 |
| `_gatherLightSources()` | Scans all Player actors with active owners for active light sources. Also scans scene for dropped Light actors |
| `_updateLightSources()` | If dirty, re-gathers and re-renders |
| `dropLightSourceOnScene(...)` | Creates a Light actor+token on the scene from a player's light item |
| `pickupLightSourceFromScene(...)` | Returns a dropped Light actor back to a player's inventory |

### RealTimeSD

**File:** `system/src/apps/RealTimeSD.mjs`

Advances game world time by 1 second every real second (primary GM only).

| Method | Description |
|--------|-------------|
| `start()` / `stop()` | Controls the real-time clock |
| `isEnabled()` | Checks `realtimeLightTracking` setting |
| `isPaused()` | True if game is paused AND `pauseLightTrackingWithGame` is enabled |

## Actor Light Source API (ActorSD)

**File:** `system/src/documents/ActorSD.mjs`

| Method | Description |
|--------|-------------|
| `getActiveLightSources()` | Returns array of active light items |
| `hasActiveLightSources()` | Boolean check |
| `hasNoActiveLightSources()` | Boolean check |
| `turnLightOn(itemId)` | Activates light, applies token lighting config |
| `turnLightOff()` | Disables light and removes token lighting |
| `toggleLight(active, itemId)` | Toggles light state |
| `changeLightSettings(lightData)` | Updates token light configuration |
| `yourLightExpired(itemId)` | Handles expired light (sends chat message, removes item) |
| `yourLightWentOut(itemId)` | Handles manually extinguished light |

## Item Light Source API (ItemSD)

**File:** `system/src/documents/ItemSD.mjs`

| Method | Description |
|--------|-------------|
| `isLight()` | True if item is a light source |
| `isActiveLight()` | True if item is an active light source |
| `lightRemainingString()` | Formatted remaining burn time |
| `setLightRemaining(remainingSeconds)` | Sets remaining duration |

## Light Source Data Structure

Light data lives on items at `item.system.light`:

```javascript
{
    active: false,          // Currently lit?
    isSource: true,         // Is this a light source item?
    remainingSecs: 3600,    // Seconds of burn time remaining
    longevityMins: 60,      // Total burn duration in minutes
    template: "torch"       // Light template name
}
```

## Light Types

Defined in `system/src/config.mjs`:

| Template | Description |
|----------|-------------|
| `torch` | Standard torch |
| `lantern` | Standard lantern |
| `lightSpellNear` | Light spell (near range) |
| `lightSpellDouble` | Light spell (double duration) |

Predefined light spell item UUIDs in `CONFIG.SHADOWDARK.LIGHT_SOURCE_ITEM_IDS`.

## Hooks

Registered in `system/src/hooks/light-source-tracker.mjs` (GM only):

| Hook | Handler | Effect |
|------|---------|--------|
| `deleteActor` | `_deleteActorHook` | Marks dirty if actor had active lights |
| `deleteItem` | `_deleteItemHook` | Marks dirty if item was active light |
| `pauseGame` | `_pauseGameHook` | Re-renders UI |
| `updateActor` | `_makeDirty` | Marks dirty |
| `activateTokenLayer` | `_makeDirty` | Marks dirty |
| `updateUser` | `_makeDirty` | Marks dirty |
| `updateWorldTime` | `onUpdateWorldTime` | Decrements light timers, expires lights |
| `userConnected` | `_makeDirty` | Marks dirty |

## Socket Events

Via `game.socket.emit("system.shadowdark", ...)`:

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `toggleLightSource` | Player → GM | Non-GM player requests light toggle |
| `dropLightSourceOnScene` | Player → GM | Non-GM player drops light on scene |
| `pickupLightSourceFromScene` | Player → GM | Non-GM player picks up light |

## Game Settings

Registered under the `shadowdark` namespace:

| Setting | Default | Description |
|---------|---------|-------------|
| `trackLightSources` | `true` | Enable/disable light tracking |
| `trackLightSourcesOpen` | `true` | Auto-open tracker UI on start |
| `trackInactiveUserLightSources` | `false` | Track lights for offline players |
| `realtimeLightTracking` | `true` | Enable real-time clock advancement |
| `pauseLightTrackingWithGame` | varies | Pause clock when game is paused |
| `trackLightSourcesInterval` | `30` | Seconds between timer updates |

## How Light Tracking Works (Flow)

1. GM starts tracker via `start()` → gathers all player actors with active owners
2. Housekeeping runs every 1 second, checks `dirty` flag → re-gathers if dirty
3. `updateWorldTime` hook fires (from real-time clock or manual advancement)
4. `onUpdateWorldTime()` decrements `remainingSecs` for each tracked light by the time delta
5. If `remainingSecs <= 0`, light expires → item deleted, chat notification sent
6. UI re-renders with updated remaining times

## Key Observations for Player-Facing Module

- All tracking logic runs GM-side only. Players interact via socket events.
- `_gatherLightSources()` already builds per-actor light source arrays — this data structure is what we need, just filtered to the current player's actor.
- The `updateWorldTime` hook is the main driver for time changes. A player-side module can listen to this same hook to update its own UI.
- `item.system.light.remainingSecs` is the canonical source of remaining time, updated by the GM's tracker.
- Players can call `actor.getActiveLightSources()` on their own actor to get current light state.
- Item updates (when GM decrements `remainingSecs`) will propagate to all clients automatically via Foundry's document sync.
