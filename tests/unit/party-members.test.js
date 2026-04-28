import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    countRations,
    countLightSources,
    computeSlotStatus,
    computeSlotUsage,
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

// --- computeSlotUsage ---

describe('computeSlotUsage', () => {
    // Builders for clarity in slot-math tests.
    const gear = (name, { quantity = 1, perSlot = 1, slotsUsed = 1, freeCarry = 0, stashed = false, treasure = false } = {}) => ({
        name,
        type: 'Basic',
        system: {
            isPhysical: true,
            quantity,
            stashed,
            treasure,
            slots: { per_slot: perSlot, slots_used: slotsUsed, free_carry: freeCarry },
        },
    });

    const gem = ({ stashed = false } = {}) => ({
        name: 'Ruby',
        type: 'Gem',
        system: { isPhysical: true, isGem: true, stashed },
    });

    it('returns zeros for empty inventory and no coins', () => {
        const usage = computeSlotUsage({}, []);
        assert.deepEqual(usage, { coins: 0, gear: 0, gems: 0, treasure: 0, total: 0 });
    });

    it('counts a single non-stashed gear item', () => {
        const usage = computeSlotUsage({}, [gear('Sword', { slotsUsed: 1 })]);
        assert.equal(usage.gear, 1);
        assert.equal(usage.total, 1);
    });

    it('separates treasure from gear', () => {
        const items = [
            gear('Sword', { slotsUsed: 2 }),
            gear('Crown', { slotsUsed: 1, treasure: true }),
        ];
        const usage = computeSlotUsage({}, items);
        assert.equal(usage.gear, 2);
        assert.equal(usage.treasure, 1);
        assert.equal(usage.total, 3);
    });

    it('skips stashed gear', () => {
        const items = [
            gear('Sword', { slotsUsed: 1 }),
            gear('Backup Sword', { slotsUsed: 1, stashed: true }),
        ];
        assert.equal(computeSlotUsage({}, items).gear, 1);
    });

    it('honors per_slot bundling', () => {
        // Arrows: 20-per-slot, quantity 25 => ceil(25/20) * 1 = 2 slots
        const items = [gear('Arrows', { quantity: 25, perSlot: 20, slotsUsed: 1 })];
        assert.equal(computeSlotUsage({}, items).gear, 2);
    });

    it('honors free_carry on first stack of a name', () => {
        // Torch with free_carry 2, quantity 3 => 3 - 2 = 1 slot
        const items = [gear('Torch', { quantity: 3, freeCarry: 2 })];
        assert.equal(computeSlotUsage({}, items).gear, 1);
    });

    it('does not double-apply free_carry across same-named stacks', () => {
        // First stack consumes the free_carry budget; second pays full price.
        const items = [
            gear('Torch', { quantity: 2, freeCarry: 2 }),
            gear('Torch', { quantity: 2, freeCarry: 2 }),
        ];
        // First: 2 - 2 = 0; second: 2 - 0 = 2.
        assert.equal(computeSlotUsage({}, items).gear, 2);
    });

    it('groups gems at 10-per-slot, including stashed', () => {
        const items = [...Array(15)].map(() => gem());
        const usage = computeSlotUsage({}, items);
        assert.equal(usage.gems, 2);
    });

    it('counts coin slots above 100 free-carry', () => {
        const usage = computeSlotUsage({ coins: { gp: 250, sp: 0, cp: 0 } }, []);
        // ceil((250 - 100) / 100) = 2
        assert.equal(usage.coins, 2);
    });

    it('charges no slot for coins under the free-carry limit', () => {
        const usage = computeSlotUsage({ coins: { gp: 50, sp: 30, cp: 20 } }, []);
        assert.equal(usage.coins, 0);
    });
});

// --- computeSlotStatus ---

describe('computeSlotStatus', () => {
    const lightItem = (slotsUsed) => ({
        name: 'Item',
        type: 'Basic',
        system: { isPhysical: true, quantity: 1, slots: { per_slot: 1, slots_used: slotsUsed, free_carry: 0 } },
    });

    it('under limit', () => {
        const result = computeSlotStatus({ slots: 10 }, [lightItem(5)]);
        assert.deepEqual(result, { used: 5, max: 10, over: false });
    });

    it('at limit', () => {
        const result = computeSlotStatus({ slots: 10 }, [lightItem(10)]);
        assert.deepEqual(result, { used: 10, max: 10, over: false });
    });

    it('over limit', () => {
        const result = computeSlotStatus({ slots: 10 }, [lightItem(12)]);
        assert.deepEqual(result, { used: 12, max: 10, over: true });
    });

    it('returns safe zeros for systems without slots field', () => {
        assert.deepEqual(computeSlotStatus({}, []), { used: 0, max: 0, over: false });
        assert.deepEqual(computeSlotStatus(null, []), { used: 0, max: 0, over: false });
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
