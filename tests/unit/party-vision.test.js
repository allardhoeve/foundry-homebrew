import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePartyVision, PA_NO_LIGHT } from '../../module/src/party-vision.js';

describe('computePartyVision', () => {
    const torch = { bright: 20, dim: 40, color: '#d1c846', animation: { type: 'torch' } };
    const lantern = { bright: 30, dim: 60, color: '#ffaa00', animation: { type: 'flame' } };

    it('keeps sight enabled when no member carries a lit light', () => {
        // Regression: sight followed the light, so an unlit party at sea or
        // overland had no vision source at all and revealed no fog.
        const { sight } = computePartyVision([]);

        assert.equal(sight.enabled, true);
        assert.equal(sight.range, 0);
    });

    it('emits no light when no member carries a lit light', () => {
        const { light } = computePartyVision([]);

        assert.deepEqual(light, PA_NO_LIGHT);
    });

    it('uses the light with the furthest reach and its radii', () => {
        const { light, sight } = computePartyVision([torch, lantern]);

        assert.equal(light.color, '#ffaa00');
        assert.equal(light.bright, 30);
        assert.equal(light.dim, 60);
        assert.equal(sight.enabled, true);
        assert.equal(sight.range, 60);
    });

    it('takes the largest bright and dim radius across lights', () => {
        const wideDim = { bright: 5, dim: 80 };
        const { light, sight } = computePartyVision([torch, wideDim]);

        assert.equal(light.bright, 20);
        assert.equal(light.dim, 80);
        assert.equal(sight.range, 80);
    });
});
