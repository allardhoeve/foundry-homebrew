// Pure light & sight computation for the party token — no Foundry dependencies, testable in Node.

export const PA_NO_LIGHT = {
    bright: 0, dim: 0, angle: 360, alpha: 0.5,
    animation: { speed: 0, intensity: 0, type: null },
    color: null, coloration: 1, luminosity: 0.5,
    attenuation: 0.5, contrast: 0, saturation: 0, shadows: 0,
    darkness: { min: 0, max: 1 },
};

/**
 * Compute the party token's light and sight from its members' active lights.
 * Sight is always enabled: a token without sight is no vision source, so it
 * reveals no fog and gives the GM no view when selected. Range 0 still sees
 * lit areas, and Hexploration widens it to a hex on hex scenes.
 * @param {Object[]} lights - Light data of every active member light source
 * @returns {{light: Object, sight: {enabled: boolean, range: number}}}
 */
export function computePartyVision(lights) {
    let maxBright = 0;
    let maxDim = 0;
    let bestLight = null;

    for (const light of lights) {
        if ((light.bright || 0) > maxBright) maxBright = light.bright;
        if ((light.dim || 0) > maxDim) maxDim = light.dim;
        const reach = Math.max(light.bright || 0, light.dim || 0);
        if (!bestLight || reach > Math.max(bestLight.bright || 0, bestLight.dim || 0)) {
            bestLight = light;
        }
    }

    const hasLight = maxBright > 0 || maxDim > 0;
    return {
        light: hasLight ? { ...bestLight, bright: maxBright, dim: maxDim } : PA_NO_LIGHT,
        sight: { enabled: true, range: Math.max(maxBright, maxDim) },
    };
}
