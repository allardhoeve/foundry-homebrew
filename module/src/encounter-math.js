// Pure encounter-table logic, extracted for testability.
//
// The encounter roller (scarlet-minotaur-encounter.js) delegates to these
// functions. Unit tests in tests/unit/encounter-math.test.js cover the
// clamping and lookup edge cases.

/**
 * Clamp the d8 roll minus penalty to a minimum of 1.
 * Results below 1 are treated as 1 per the module rules.
 */
export function calculateAdjustedResult(d8Roll, penalty) {
    return Math.max(1, d8Roll - penalty);
}

/**
 * Resolve a full encounter-table roll: apply penalty, look up the encounter,
 * and determine whether the Scarlet Minotaur appears.
 *
 * @param {number} d8Roll      Raw 1d8 result (1–8)
 * @param {number} penalty     Current cumulative penalty (0, 2, 4, …)
 * @param {string[]} encounters  Encounter text array (index 0 = result 1)
 * @returns {{ adjustedResult: number, encounter: string, isMinotaur: boolean }}
 */
export function resolveEncounter(d8Roll, penalty, encounters) {
    const adjustedResult = calculateAdjustedResult(d8Roll, penalty);
    return {
        adjustedResult,
        encounter: encounters[adjustedResult - 1],
        isMinotaur: adjustedResult === 1
    };
}

/**
 * Resolve distance sub-roll (1d6).
 * @param {number} d6Roll  Raw 1d6 result (1–6)
 * @returns {{ label: string, roll: number }}
 */
export function resolveDistance(d6Roll) {
    if (d6Roll <= 1) return { label: "Close", roll: d6Roll };
    if (d6Roll <= 4) return { label: "Near", roll: d6Roll };
    return { label: "Far", roll: d6Roll };
}

/**
 * Resolve activity sub-roll (2d6).
 * @param {number} twoD6Roll  Raw 2d6 result (2–12)
 * @returns {{ label: string, roll: number }}
 */
export function resolveActivity(twoD6Roll) {
    if (twoD6Roll <= 4)  return { label: "Hunting", roll: twoD6Roll };
    if (twoD6Roll <= 6)  return { label: "Eating", roll: twoD6Roll };
    if (twoD6Roll <= 8)  return { label: "Building/nesting", roll: twoD6Roll };
    if (twoD6Roll <= 10) return { label: "Socializing/playing", roll: twoD6Roll };
    if (twoD6Roll <= 11) return { label: "Guarding", roll: twoD6Roll };
    return { label: "Sleeping", roll: twoD6Roll };
}

/**
 * Resolve reaction sub-roll (2d6, range extends for CHA modifier).
 * @param {number} twoD6Roll  Raw 2d6 result (may be outside 2–12 with modifiers)
 * @returns {{ label: string, roll: number }}
 */
export function resolveReaction(twoD6Roll) {
    if (twoD6Roll <= 6)  return { label: "Hostile", roll: twoD6Roll };
    if (twoD6Roll <= 8)  return { label: "Suspicious", roll: twoD6Roll };
    if (twoD6Roll <= 9)  return { label: "Neutral", roll: twoD6Roll };
    if (twoD6Roll <= 11) return { label: "Curious", roll: twoD6Roll };
    return { label: "Friendly", roll: twoD6Roll };
}
