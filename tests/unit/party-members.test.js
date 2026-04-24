import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    countRations,
    countLightSources,
    computeSlotStatus,
    collectEffects,
    isMemberOf,
} from '../../module/src/party-members.js';

// --- countRations ---

describe('countRations', () => {
    it('sums carried rations', () => {
        const items = [
            { name: 'Rations', system: { stashed: false, quantity: 3 } },
            { name: 'Rations', system: { stashed: false, quantity: 2 } },
        ];
        assert.equal(countRations(items), 5);
    });

    it('excludes stashed rations', () => {
        const items = [
            { name: 'Rations', system: { stashed: true, quantity: 10 } },
            { name: 'Rations', system: { stashed: false, quantity: 1 } },
        ];
        assert.equal(countRations(items), 1);
    });

    it('excludes non-ration items', () => {
        const items = [
            { name: 'Sword', system: { stashed: false, quantity: 1 } },
            { name: 'Rations', system: { stashed: false, quantity: 4 } },
        ];
        assert.equal(countRations(items), 4);
    });

    it('returns 0 for empty items', () => {
        assert.equal(countRations([]), 0);
    });

    it('handles zero quantity', () => {
        const items = [
            { name: 'Rations', system: { stashed: false, quantity: 0 } },
        ];
        assert.equal(countRations(items), 0);
    });

    it('matches rations case-insensitively', () => {
        const items = [
            { name: 'RATIONS', system: { stashed: false, quantity: 2 } },
            { name: 'rations', system: { stashed: false, quantity: 3 } },
        ];
        assert.equal(countRations(items), 5);
    });
});

// --- countLightSources ---

describe('countLightSources', () => {
    it('sums carried light sources', () => {
        const items = [
            { system: { light: { isSource: true }, stashed: false, quantity: 2 } },
            { system: { light: { isSource: true }, stashed: false, quantity: 1 } },
        ];
        assert.equal(countLightSources(items), 3);
    });

    it('excludes non-light items', () => {
        const items = [
            { system: { light: { isSource: false }, stashed: false, quantity: 5 } },
            { system: { light: null, stashed: false, quantity: 3 } },
            { system: { stashed: false, quantity: 1 } },
        ];
        assert.equal(countLightSources(items), 0);
    });

    it('excludes stashed light sources', () => {
        const items = [
            { system: { light: { isSource: true }, stashed: true, quantity: 10 } },
        ];
        assert.equal(countLightSources(items), 0);
    });

    it('returns 0 for empty items', () => {
        assert.equal(countLightSources([]), 0);
    });
});

// --- computeSlotStatus ---

describe('computeSlotStatus', () => {
    const makeSystem = (total, slots) => ({
        getSlotUsage: () => ({ total }),
        slots,
    });

    it('under limit', () => {
        const result = computeSlotStatus(makeSystem(5, 10));
        assert.deepEqual(result, { used: 5, max: 10, over: false });
    });

    it('at limit', () => {
        const result = computeSlotStatus(makeSystem(10, 10));
        assert.deepEqual(result, { used: 10, max: 10, over: false });
    });

    it('over limit', () => {
        const result = computeSlotStatus(makeSystem(12, 10));
        assert.deepEqual(result, { used: 12, max: 10, over: true });
    });
});

// --- collectEffects ---

describe('collectEffects', () => {
    const makeActor = (effects) => ({
        allApplicableEffects: function* () { yield* effects; },
    });

    it('collects active non-suppressed effects with statuses', () => {
        const actor = makeActor([
            { isSuppressed: false, statuses: new Set(['poisoned']), name: 'Poison', icon: 'poison.png' },
            { isSuppressed: false, statuses: new Set(['blinded']), name: 'Blind', icon: 'blind.png' },
        ]);
        const result = collectEffects(actor);
        assert.deepEqual(result.statuses, new Set(['poisoned', 'blinded']));
        assert.equal(result.effects.length, 2);
        assert.equal(result.effects[0].name, 'Poison');
    });

    it('excludes suppressed effects', () => {
        const actor = makeActor([
            { isSuppressed: true, statuses: new Set(['poisoned']), name: 'Poison', icon: 'poison.png' },
            { isSuppressed: false, statuses: new Set(['blinded']), name: 'Blind', icon: 'blind.png' },
        ]);
        const result = collectEffects(actor);
        assert.deepEqual(result.statuses, new Set(['blinded']));
        assert.equal(result.effects.length, 1);
    });

    it('excludes effects with empty statuses', () => {
        const actor = makeActor([
            { isSuppressed: false, statuses: new Set(), name: 'Buff', icon: 'buff.png' },
        ]);
        const result = collectEffects(actor);
        assert.deepEqual(result.statuses, new Set());
        assert.equal(result.effects.length, 0);
    });

    it('merges multiple statuses from one effect', () => {
        const actor = makeActor([
            { isSuppressed: false, statuses: new Set(['poisoned', 'prone']), name: 'Multi', icon: 'multi.png' },
        ]);
        const result = collectEffects(actor);
        assert.deepEqual(result.statuses, new Set(['poisoned', 'prone']));
    });

    it('falls back icon from img when icon is missing', () => {
        const actor = makeActor([
            { isSuppressed: false, statuses: new Set(['dead']), name: 'Dead', icon: undefined, img: 'dead.png' },
        ]);
        const result = collectEffects(actor);
        assert.equal(result.effects[0].icon, 'dead.png');
    });
});

// --- isMemberOf ---

describe('isMemberOf', () => {
    it('returns true when actorId matches a member UUID', () => {
        assert.equal(isMemberOf(['Actor.abc123', 'Actor.def456'], 'abc123'), true);
    });

    it('returns false when actorId does not match', () => {
        assert.equal(isMemberOf(['Actor.abc123'], 'xyz789'), false);
    });

    it('returns false for empty members list', () => {
        assert.equal(isMemberOf([], 'abc123'), false);
    });

    it('does not match partial IDs', () => {
        assert.equal(isMemberOf(['Actor.abc123def'], 'abc123'), false);
    });
});
