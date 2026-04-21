import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePartyOwnership } from '../../module/src/party-ownership.js';

// Foundry ownership levels
const OWNER = 3;

describe('computePartyOwnership', () => {
    const gmUser = { id: 'gm1', isGM: true };
    const player1 = { id: 'p1', isGM: false };
    const player2 = { id: 'p2', isGM: false };
    const player3 = { id: 'p3', isGM: false };
    const allUsers = [gmUser, player1, player2, player3];

    it('grants ownership to users who own member actors', () => {
        const memberOwnerships = [
            { p1: OWNER, default: 0 },  // player1 owns member A
            { p2: OWNER, default: 0 },  // player2 owns member B
        ];

        const result = computePartyOwnership(memberOwnerships, allUsers);

        assert.equal(result.gm1, OWNER);
        assert.equal(result.p1, OWNER);
        assert.equal(result.p2, OWNER);
        assert.equal(result.p3, undefined);
    });

    it('removes ownership when a member is removed', () => {
        // player2's member was removed, only player1's member remains
        const memberOwnerships = [
            { p1: OWNER, default: 0 },
        ];

        const result = computePartyOwnership(memberOwnerships, allUsers);

        assert.equal(result.gm1, OWNER);
        assert.equal(result.p1, OWNER);
        assert.equal(result.p2, undefined);
    });

    it('always keeps GM ownership', () => {
        const memberOwnerships = [];  // no members at all

        const result = computePartyOwnership(memberOwnerships, allUsers);

        assert.equal(result.gm1, OWNER);
        assert.equal(result.p1, undefined);
    });

    it('ignores the default ownership key', () => {
        const memberOwnerships = [
            { default: OWNER, p1: OWNER },
        ];

        const result = computePartyOwnership(memberOwnerships, allUsers);

        assert.equal(result.default, 0);
        assert.equal(result.p1, OWNER);
    });

    it('sub-OWNER levels do not grant ownership', () => {
        const OBSERVER = 2;
        const memberOwnerships = [
            { p1: OBSERVER, default: 0 },  // player1 is observer, not owner
        ];

        const result = computePartyOwnership(memberOwnerships, allUsers);

        assert.equal(result.gm1, OWNER);
        assert.equal(result.p1, undefined);
    });

    it('handles multiple members owned by the same user', () => {
        const memberOwnerships = [
            { p1: OWNER, default: 0 },
            { p1: OWNER, default: 0 },  // same user owns both
        ];

        const result = computePartyOwnership(memberOwnerships, allUsers);

        assert.equal(result.p1, OWNER);
        assert.equal(result.p2, undefined);
    });

    it('retains ownership when one of two members from same player is removed', () => {
        // Player1 had two members; one was removed, one remains
        const beforeRemoval = [
            { p1: OWNER, default: 0 },
            { p1: OWNER, default: 0 },
        ];
        const afterRemoval = [
            { p1: OWNER, default: 0 },
        ];

        const before = computePartyOwnership(beforeRemoval, allUsers);
        const after = computePartyOwnership(afterRemoval, allUsers);

        assert.equal(before.p1, OWNER);
        assert.equal(after.p1, OWNER, 'player should retain ownership after removing one of two members');
    });
});
