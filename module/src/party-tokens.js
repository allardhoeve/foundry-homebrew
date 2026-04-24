// Party Token Merge & Explode
//
// Merge collapses all member tokens on the current scene into a single party
// token placed at the first member's position. Explode does the reverse:
// creates member tokens in a spiral around the party token, checking walls.

// --- Spiral offsets --------------------------------------------------------
// Hard-coded clockwise spiral: origin, inner ring (8), outer ring (16).
// Positions are in grid-cell offsets from the party token.

const SPIRAL_OFFSETS = [
    { x: 0, y: 0 },
    // Inner ring (4 cardinal + 4 diagonal)
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
    { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
    // Outer ring (16 positions)
    { x: -1, y: -2 }, { x: 0, y: -2 }, { x: 1, y: -2 }, { x: 2, y: -2 },
    { x: 2, y: -1 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 },
    { x: 1, y: 2 }, { x: 0, y: 2 }, { x: -1, y: 2 }, { x: -2, y: 2 },
    { x: -2, y: 1 }, { x: -2, y: 0 }, { x: -2, y: -1 }, { x: -2, y: -2 },
];

// --- Helpers ---------------------------------------------------------------

function extractActorId(uuid) {
    // UUID format: "Actor.abc123" — extract the ID portion
    return uuid.split(".").pop();
}

function findMemberTokens(scene, memberUuids) {
    const tokens = [];
    for (const uuid of memberUuids) {
        const actorId = extractActorId(uuid);
        const token = scene.tokens.find(t => t.actorId === actorId);
        if (token) tokens.push(token);
    }
    return tokens;
}

function findPartyToken(scene, partyActorId) {
    return scene.tokens.find(t => t.actorId === partyActorId);
}

function checkWallCollision(fromCenter, toCenter) {
    return CONFIG.Canvas.polygonBackends.move.testCollision(
        fromCenter, toCenter,
        { type: "move", mode: "any" },
    );
}

// Walk step-by-step from origin toward target, stopping before any wall.
// Collision is checked from origin center to each step (same as crunch-my-party).
// Returns the furthest reachable grid-snapped position.
function findSafePosition(originX, originY, offset, gridSize, tokenW, tokenH) {
    const targetX = originX + offset.x * gridSize;
    const targetY = originY + offset.y * gridSize;

    let finalX = originX;
    let finalY = originY;

    const steps = Math.max(Math.abs(offset.x), Math.abs(offset.y));
    if (steps === 0) return { x: originX, y: originY };

    const originCenter = {
        x: originX + tokenW / 2,
        y: originY + tokenH / 2,
    };

    for (let i = 1; i <= steps; i++) {
        const stepX = originX + (targetX - originX) * (i / steps);
        const stepY = originY + (targetY - originY) * (i / steps);
        const stepCenter = {
            x: stepX + tokenW / 2,
            y: stepY + tokenH / 2,
        };

        if (checkWallCollision(originCenter, stepCenter)) break;

        const snapped = canvas.grid.getSnappedPoint({ x: stepX, y: stepY }, { mode: CONST.GRID_SNAPPING_MODES.VERTEX });
        finalX = snapped.x;
        finalY = snapped.y;
    }

    return { x: finalX, y: finalY };
}

// --- Merge -----------------------------------------------------------------

export async function mergePartyTokens(partyActor) {
    const scene = canvas.scene;
    if (!scene) {
        ui.notifications.warn("No active scene.");
        return;
    }

    const memberTokens = findMemberTokens(scene, partyActor.system.members);
    if (memberTokens.length === 0) {
        ui.notifications.warn("No member tokens found on this scene.");
        return;
    }

    // Position: first member token (matching member order)
    const anchor = memberTokens[0];
    const position = { x: anchor.x, y: anchor.y };

    // Delete member tokens
    const tokenIds = memberTokens.map(t => t._id);
    await scene.deleteEmbeddedDocuments("Token", tokenIds);

    // Create party token at anchor position
    const tokenData = partyActor.prototypeToken.toObject();
    tokenData.actorId = partyActor._id;
    tokenData.actorLink = true;
    tokenData.x = position.x;
    tokenData.y = position.y;
    await scene.createEmbeddedDocuments("Token", [tokenData]);

    await partyActor.update({ "system.merged": true });
}

// --- Explode ---------------------------------------------------------------

export async function explodePartyTokens(partyActor) {
    const scene = canvas.scene;
    if (!scene) {
        ui.notifications.warn("No active scene.");
        return;
    }

    const partyToken = findPartyToken(scene, partyActor._id);
    if (!partyToken) {
        ui.notifications.warn("No party token found on this scene.");
        return;
    }

    const originX = partyToken.x;
    const originY = partyToken.y;
    const gridSize = canvas.grid.size;

    // Resolve member actors and build token data
    const tokensToCreate = [];
    let spiralIndex = 0;

    for (const uuid of partyActor.system.members) {
        const actor = await fromUuid(uuid);
        if (!actor) continue;
        if (spiralIndex >= SPIRAL_OFFSETS.length) break;

        const offset = SPIRAL_OFFSETS[spiralIndex++];
        const tokenData = actor.prototypeToken.toObject();
        tokenData.actorId = actor._id;
        tokenData.actorLink = true;

        // Compute position with wall safety
        const tokenW = (tokenData.width ?? 1) * gridSize;
        const tokenH = (tokenData.height ?? 1) * gridSize;
        const pos = findSafePosition(originX, originY, offset, gridSize, tokenW, tokenH);
        tokenData.x = pos.x;
        tokenData.y = pos.y;

        tokensToCreate.push(tokenData);
    }

    if (tokensToCreate.length === 0) {
        ui.notifications.warn("No members to place.");
        return;
    }

    // Create member tokens, then delete party token
    await scene.createEmbeddedDocuments("Token", tokensToCreate);
    await scene.deleteEmbeddedDocuments("Token", [partyToken._id]);

    await partyActor.update({ "system.merged": false });
}

export { SPIRAL_OFFSETS, findSafePosition, extractActorId };
