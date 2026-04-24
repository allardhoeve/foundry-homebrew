// Pure HP classification — no Foundry dependencies, testable in Node.

/**
 * Compute the CSS class for a member's HP display.
 * @param {number} hp - Current HP
 * @param {number} hpMax - Maximum HP
 * @param {Set<string>} statuses - Set of active status IDs (e.g. "dead")
 * @returns {string} CSS class: "pa-hp--dead", "pa-hp--damaged", or ""
 */
export function computeHpClass(hp, hpMax, statuses) {
    if (statuses.has("dead")) return "pa-hp--dead";
    const fraction = hpMax > 0 ? hp / hpMax : 0;
    if (fraction < 0.5) return "pa-hp--damaged";
    return "";
}
