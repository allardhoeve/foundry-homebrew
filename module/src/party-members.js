// Pure party-member helpers — no Foundry dependencies, testable in Node.

/**
 * Count carried (non-stashed) rations.
 * @param {Object[]} items - Actor items array
 * @returns {number} Total ration quantity
 */
export function countRations(items) {
    return items
        .filter(i => i.name.toLowerCase() === "rations" && !i.system.stashed)
        .reduce((sum, i) => sum + (i.system.quantity ?? 0), 0);
}

/**
 * Count carried (non-stashed) light source items.
 * @param {Object[]} items - Actor items array
 * @returns {number} Total light source quantity
 */
export function countLightSources(items) {
    return items
        .filter(i => i.system.light?.isSource && !i.system.stashed)
        .reduce((sum, i) => sum + (i.system.quantity ?? 0), 0);
}

// Shadowdark constants (CONFIG.SHADOWDARK.DEFAULTS in 3.6.x and 4.0.0).
const FREE_COIN_CARRY = 100;
const GEMS_PER_SLOT = 10;

/**
 * Compute slot usage for a Shadowdark character. Mirrors PlayerSheetSD's
 * inline logic in Shadowdark 3.6.x. Faithful to its quirks: stashed gems
 * still occupy slots.
 *
 * @param {Object} system - Actor system data with optional `coins`
 * @param {Object[]} items - Actor items (Player items collection coerced to array)
 * @returns {{ coins: number, gear: number, gems: number, treasure: number, total: number }}
 */
export function computeSlotUsage(system, items) {
    const slots = { coins: 0, gear: 0, gems: 0, treasure: 0, total: 0 };

    if (system?.coins) {
        const total = (system.coins.gp ?? 0) + (system.coins.sp ?? 0) + (system.coins.cp ?? 0);
        if (total > FREE_COIN_CARRY) {
            slots.coins = Math.ceil((total - FREE_COIN_CARRY) / FREE_COIN_CARRY);
        }
    }

    const freeCarrySeen = {};
    let gemCount = 0;

    for (const i of items ?? []) {
        if (!i.system?.isPhysical) continue;

        if (i.type === "Gem" || i.system.isGem) {
            gemCount++;
            continue;
        }

        if (i.system.stashed) continue;

        let freeCarry = i.system.slots?.free_carry ?? 0;
        if (Object.hasOwn(freeCarrySeen, i.name)) {
            freeCarry = Math.max(0, freeCarry - freeCarrySeen[i.name]);
            freeCarrySeen[i.name] += freeCarry;
        } else {
            freeCarrySeen[i.name] = freeCarry;
        }

        const perSlot = i.system.slots?.per_slot ?? 1;
        const quantity = i.system.quantity ?? 1;
        const slotsUsed = i.system.slots?.slots_used ?? 1;
        const used = Math.ceil(quantity / perSlot) * slotsUsed - freeCarry * slotsUsed;

        if (i.system.treasure || i.system.isTreasure) slots.treasure += used;
        else slots.gear += used;
    }

    if (gemCount > 0) slots.gems = Math.ceil(gemCount / GEMS_PER_SLOT);

    slots.total = slots.coins + slots.gear + slots.gems + slots.treasure;
    return slots;
}

/**
 * Compute gear slot usage status (Shadowdark 3.6.x).
 *
 * @param {Object} system - Actor system data with `slots` (max capacity)
 * @param {Object[]} items - Actor items
 * @returns {{ used: number, max: number, over: boolean }}
 */
export function computeSlotStatus(system, items) {
    const used = computeSlotUsage(system, items).total;
    const max = system?.slots ?? 0;
    return { used, max, over: used > max };
}

/**
 * Collect active (non-suppressed) effects that carry statuses.
 * @param {Object} actor - Actor with allApplicableEffects()
 * @returns {{ statuses: Set<string>, effects: Array<{name: string, icon: string}> }}
 */
export function collectEffects(actor) {
    const activeEffects = [...actor.allApplicableEffects()]
        .filter(e => !e.isSuppressed && e.statuses.size > 0);
    const statuses = new Set(activeEffects.flatMap(e => [...e.statuses]));
    const effects = activeEffects
        .map(e => ({ name: e.name, icon: e.icon ?? e.img ?? "" }));
    return { statuses, effects };
}

/**
 * Check whether an actor ID is a member of a party.
 * @param {string[]} memberUuids - The party's system.members array (e.g. ["Actor.abc123"])
 * @param {string} actorId - The actor's document ID
 * @returns {boolean}
 */
export function isMemberOf(memberUuids, actorId) {
    return memberUuids.includes(`Actor.${actorId}`);
}
