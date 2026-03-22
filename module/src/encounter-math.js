// Pure encounter-table logic, extracted for testability.
//
// The encounter roller (scarlet-minotaur-encounter.js) delegates to these
// functions. Unit tests in tests/unit/encounter-math.test.js cover the
// clamping and lookup edge cases.

export const ENCOUNTERS = [
    "The Scarlet Minotaur (Area 18) stalks into sight, bellowing challenges and pawing the stone.",
    "1d4 ettercaps and 1d8 beastmen clash in a bloody melee.",
    "A dry gust of wind extinguishes all torches and lamps.",
    "1d6 ettercaps creep along, searching for gold and gems.",
    "The skeletons of 1d6 dead adventurers or warrior-mages stagger into sight.",
    "2d4 beastmen argue in hushed whispers over who gets to eat the centipedes they just trapped in a bag.",
    "1d4 darkmantles swoop out, bobbing and spinning in a territorial warning dance.",
    "A cave creeper rushes along the ceiling toward light."
];

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
 * @param {number} d8Roll   Raw 1d8 result (1–8)
 * @param {number} penalty  Current cumulative penalty (0, 2, 4, …)
 * @returns {{ adjustedResult: number, encounter: string, isMinotaur: boolean }}
 */
export function resolveEncounter(d8Roll, penalty) {
    const adjustedResult = calculateAdjustedResult(d8Roll, penalty);
    return {
        adjustedResult,
        encounter: ENCOUNTERS[adjustedResult - 1],
        isMinotaur: adjustedResult === 1
    };
}
