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

/**
 * Compute gear slot usage status.
 * @param {Object} system - Actor system data with getSlotUsage() and slots
 * @returns {{ used: number, max: number, over: boolean }}
 */
export function computeSlotStatus(system) {
    const used = system.getSlotUsage().total;
    const max = system.slots;
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
