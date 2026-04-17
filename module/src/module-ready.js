/**
 * Module readiness signal.
 *
 * Foundry's lifecycle hooks (init, ready) fire asynchronously after the browser
 * page loads. DOM elements like #sidebar can appear before these hooks complete,
 * so DOM visibility is not a reliable readiness signal.
 *
 * This file fires an explicit "foundry-homebrew.ready" hook and sets module.ready
 * after Foundry's "ready" hook, guaranteeing all module APIs are registered and
 * world data is loaded.
 *
 * Listed last in module.json esmodules so it loads after all feature modules.
 *
 * See docs/foundry-api.md for the full initialization lifecycle.
 */
Hooks.once("init", () => {
    CONFIG.fontDefinitions["JSL Blackletter"] = {
        editor: true,
        fonts: [],
    };
});

Hooks.once("ready", () => {
    const module = game.modules.get("foundry-homebrew");
    module.ready = true;
    Hooks.callAll("foundry-homebrew.ready");
});
