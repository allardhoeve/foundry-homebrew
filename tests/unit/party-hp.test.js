import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeHpClass } from '../../module/src/party-hp.js';

describe('computeHpClass', () => {
    it('HP at zero without dead status → damaged, not dead', () => {
        const result = computeHpClass(0, 10, new Set());
        assert.equal(result, 'pa-hp--damaged');
    });

    it('dead status present → dead regardless of HP', () => {
        const result = computeHpClass(10, 10, new Set(['dead']));
        assert.equal(result, 'pa-hp--dead');
    });

    it('HP below half, no statuses → damaged', () => {
        const result = computeHpClass(4, 10, new Set());
        assert.equal(result, 'pa-hp--damaged');
    });

    it('HP at or above half, no statuses → healthy', () => {
        const result = computeHpClass(5, 10, new Set());
        assert.equal(result, '');
    });
});
