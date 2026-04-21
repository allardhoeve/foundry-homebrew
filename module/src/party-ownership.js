// Pure ownership computation — no Foundry dependencies, testable in Node.

const OWNER = 3; // CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER

/**
 * Compute the party actor's ownership map from member actor ownerships.
 * @param {Object[]} memberOwnerships - Array of ownership maps from member actors
 * @param {Object[]} users - Array of { id, isGM } user objects
 * @returns {Object} The ownership map to set on the party actor
 */
export function computePartyOwnership(memberOwnerships, users) {
    const ownership = { default: 0 };

    for (const memberOwnership of memberOwnerships) {
        for (const [userId, level] of Object.entries(memberOwnership)) {
            if (userId === "default") continue;
            if (level >= OWNER) {
                ownership[userId] = OWNER;
            }
        }
    }

    // Always keep GM ownership
    for (const user of users) {
        if (user.isGM) ownership[user.id] = OWNER;
    }

    return ownership;
}
