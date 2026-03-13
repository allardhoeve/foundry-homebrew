// Player Light Tracker
// Shows the player's active light source with immersive, thematic feedback.
// No exact timers — just vague descriptions of how their light is doing.

const PLT_MODULE_PATH = "modules/foundry-homebrew";
const PLT_MODULE_ID = "foundry-homebrew";
const PLT_SETTING_BW_MODE = "plt-bw-mode";
const PLT_SETTING_COMPACT = "plt-compact-mode";

// Light remaining-fraction thresholds for state changes
const PLT_BRIGHT_THRESHOLD = 0.5;   // above this → bright
const PLT_GOOD_THRESHOLD = 0.25;    // above this → good, below → fading

// How long to wait (ms) before re-rendering after a hook fires
const PLT_DEBOUNCE_MS = 250;

// Default window width in pixels
const PLT_WINDOW_WIDTH = 320;

// Show character selector when more than one actor is available
const PLT_MIN_ACTORS_FOR_SELECTOR = 2;

// Normal video playback rate (used after transitions)
const PLT_NORMAL_PLAYBACK_RATE = 1.0;

const PLT_ASSETS = {
    torch: {
        bright: "yellow.mp4",
        good: "orange.mp4",
        fading: "red.mp4",
        darkness: null,
        ignite: "ignite.mp4",
        extinguish: "extinguish.mp4",
    },
    spell: {
        bright: "staff.mp4",
        good: "staff.mp4",
        fading: "staff.mp4",
        darkness: null,
        ignite: "staffIgnite.mp4",
        extinguish: "staffExtinguish.mp4",
    },
    party: {
        "party-bright": "party_torch.png",
        "party-good": "party_torch.png",
        "party-fading": "party_torch.png",
    },
};

const STATES = {
    DARKNESS: "darkness",
    BRIGHT: "bright",
    GOOD: "good",
    FADING: "fading",
    PARTY_BRIGHT: "party-bright",
    PARTY_GOOD: "party-good",
    PARTY_FADING: "party-fading",
};

const DARKNESS_DATA = {
    stateKey: STATES.DARKNESS,
    statusText: "The darkness engulfs you",
    lightType: "torch",
};

const PARTY_BRIGHT_DATA = {
    stateKey: STATES.PARTY_BRIGHT,
    statusText: "Your party has strong light<br/>Don't stray",
    compactText: "Your party has strong light",
    lightType: "party",
};

const PARTY_GOOD_DATA = {
    stateKey: STATES.PARTY_GOOD,
    statusText: "The party has weak light<br/>Stay close",
    compactText: "Your party has weak light",
    lightType: "party",
};

const PARTY_FADING_DATA = {
    stateKey: STATES.PARTY_FADING,
    statusText: "The party's light is fading",
    compactText: "Your light is fading",
    lightType: "party",
};

function getLightState(item) {
    const remaining = item.system.light.remainingSecs;
    const total = item.system.light.longevityMins * 60;
    if (total <= 0) return { key: STATES.BRIGHT, text: "Your light shines brightly" };
    const fraction = remaining / total;
    if (fraction > PLT_BRIGHT_THRESHOLD) return { key: STATES.BRIGHT, text: "Your light shines brightly" };
    if (fraction > PLT_GOOD_THRESHOLD) return { key: STATES.GOOD, text: "Your light shines well" };
    return { key: STATES.FADING, text: "Your light starts to fade" };
}

function getLightType(item) {
    if (!item) return "torch";
    const type = item.type?.toLowerCase();
    if (type === "spell" || type === "effect") return "spell";
    if (item.name?.toLowerCase().includes("spell")) return "spell";
    return "torch";
}

function getAssetPath(filename) {
    const folder = filename.endsWith(".mp4") ? "video" : "images";
    return `${PLT_MODULE_PATH}/assets/${folder}/${filename}`;
}

class PlayerLightTrackerApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "player-light-tracker",
        window: {
            title: "Player Light Tracker",
            resizable: false,
            minimizable: false,
        },
        position: {
            width: PLT_WINDOW_WIDTH,
        },
    }, { inplace: false });

    constructor(options = {}) {
        super(options);
        this._hookIds = [];
        this._viewedActorId = null;
        this._bwMode = game.settings.get(PLT_MODULE_ID, PLT_SETTING_BW_MODE);
        this._compact = game.settings.get(PLT_MODULE_ID, PLT_SETTING_COMPACT);
    }

    toggleInterface() {
        if (this.rendered) {
            this.close();
        } else {
            this.render({ force: true });
        }
    }

    get actor() {
        // Use the explicitly selected actor from the character selector
        if (this._viewedActorId) {
            const viewed = game.actors.get(this._viewedActorId);
            if (viewed) return viewed;
        }
        // Prefer the explicitly assigned character, fall back to first owned PC
        return game.user.character
            ?? game.actors.find(a => a.isOwner && a.type === "Player");
    }

    get _rootElement() {
        return this.element instanceof HTMLElement ? this.element : this.element?.[0];
    }

    async _renderHTML(_context, _options) {
        const container = document.createElement("div");

        const lightData = await this._getLightData();
        const { stateKey, lightType } = lightData;
        const statusText = this._compact && lightData.compactText ? lightData.compactText : lightData.statusText;
        const assetFile = PLT_ASSETS[lightType]?.[stateKey];

        // Build character selector: GMs see all PCs, players see only owned PCs
        const selectableActors = game.user.isGM
            ? game.actors.filter(a => a.type === "Player")
            : game.actors.filter(a => a.isOwner && a.type === "Player");
        const currentId = this.actor?._id ?? "";
        const showSelector = selectableActors.length >= PLT_MIN_ACTORS_FOR_SELECTOR;

        // Full mode: character selector in header
        let characterSelectorHTML = "";
        if (showSelector) {
            const buttons = selectableActors.map(a =>
                `<button type="button" class="plt-character-btn ${a._id === currentId ? "plt-character-active" : ""}"
                        data-actor-id="${a._id}" title="${a.name}">
                    <img src="${a.img}" alt="${a.name}">
                </button>`
            ).join("");
            characterSelectorHTML = `<div class="plt-character-selector">${buttons}</div>`;
        }

        // Compact mode: active portrait with popup overlay
        const activeActor = this.actor;
        let compactPortraitHTML = "";
        if (activeActor) {
            let popupHTML = "";
            if (showSelector) {
                const popupButtons = selectableActors.map(a =>
                    `<button type="button" class="plt-popup-btn ${a._id === currentId ? "plt-popup-btn-active" : ""}"
                            data-actor-id="${a._id}" title="${a.name}">
                        <img src="${a.img}" alt="${a.name}">
                    </button>`
                ).join("");
                popupHTML = `<div class="plt-popup">${popupButtons}</div>`;
            }
            compactPortraitHTML = `
                <div class="plt-compact-portrait-wrap">
                    <img class="plt-compact-portrait" src="${activeActor.img}" alt="${activeActor.name}">
                    ${popupHTML}
                </div>`;
        }

        container.innerHTML = `
            <div class="plt-window plt-state-${stateKey}" data-state="${stateKey}" data-light-type="${lightType}">
                <div class="plt-header">
                    <div class="plt-header-title">Light Tracker</div>
                    ${characterSelectorHTML}
                </div>
                ${compactPortraitHTML}
                <div class="plt-status-text">${statusText}</div>
                <div class="plt-animation">
                    ${assetFile?.endsWith(".mp4")
                        ? `<video class="plt-video" autoplay loop muted playsinline
                               src="${getAssetPath(assetFile)}"></video>`
                        : assetFile
                            ? `<img class="plt-image" src="${getAssetPath(assetFile)}" alt="">`
                            : ""}
                </div>
            </div>
        `;
        return container;
    }

    _replaceHTML(result, content, _options) {
        content.replaceChildren(result);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        const root = this._rootElement;
        if (!root?.querySelector) return;

        // Add header buttons (resize, B&W)
        this._injectHeaderButtons(root);

        // Apply persisted B&W mode
        const pltWindow = root.querySelector(".plt-window");
        if (pltWindow && this._bwMode) pltWindow.classList.add("plt-bw");

        // Apply persisted compact mode
        const appEl = root.closest("#player-light-tracker");
        if (appEl && this._compact) appEl.classList.add("plt-compact");

        // Wire character selector (full mode)
        for (const btn of root.querySelectorAll(".plt-character-btn")) {
            btn.addEventListener("click", () => {
                this._viewedActorId = btn.dataset.actorId;
                this._prevStateKey = null;
                this._lastStateKey = null;
                this.render({ force: true });
            });
        }

        // Wire compact portrait popup (hover + click for tablet support)
        const portraitWrap = root.querySelector(".plt-compact-portrait-wrap");
        if (portraitWrap) {
            portraitWrap.addEventListener("click", (e) => {
                // Don't toggle if clicking a popup button
                if (e.target.closest(".plt-popup-btn")) return;
                portraitWrap.classList.toggle("plt-popup-open");
            });

            for (const btn of portraitWrap.querySelectorAll(".plt-popup-btn")) {
                btn.addEventListener("click", () => {
                    this._viewedActorId = btn.dataset.actorId;
                    this._prevStateKey = null;
                    this._lastStateKey = null;
                    portraitWrap.classList.remove("plt-popup-open");
                    this.render({ force: true });
                });
            }

            // Close popup when clicking outside
            this._closePopupHandler = (e) => {
                if (!portraitWrap.contains(e.target)) {
                    portraitWrap.classList.remove("plt-popup-open");
                }
            };
            document.addEventListener("click", this._closePopupHandler);
        }

        // Handle video transitions
        this._handleVideoTransition(root);

        // Register hooks (only on first render)
        if (this._hookIds.length === 0) {
            this._registerHooks();
        }
    }

    _createHeaderButton(title, iconClass, isActive, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `plt-header-btn ${isActive ? "plt-active" : ""}`;
        btn.innerHTML = `<i class="fas ${iconClass}"></i>`;
        btn.title = title;
        btn.addEventListener("click", onClick);
        return btn;
    }

    _injectHeaderButtons(root) {
        const header = root.closest("#player-light-tracker")?.querySelector(".window-header");
        if (!header || header.querySelector(".plt-header-right")) return;

        const rightGroup = document.createElement("div");
        rightGroup.className = "plt-header-right";

        const resizeBtn = this._createHeaderButton("Toggle size", "fa-expand-alt", this._compact, () => {
            this._compact = !this._compact;
            resizeBtn.classList.toggle("plt-active", this._compact);
            const appEl = document.getElementById("player-light-tracker");
            if (appEl) appEl.classList.toggle("plt-compact", this._compact);
            game.settings.set(PLT_MODULE_ID, PLT_SETTING_COMPACT, this._compact);
            this.setPosition({ height: "auto" });
        });

        const bwBtn = this._createHeaderButton("Black & White", "fa-adjust", this._bwMode, () => {
            this._bwMode = !this._bwMode;
            const pltWindow = root.querySelector(".plt-window");
            if (pltWindow) pltWindow.classList.toggle("plt-bw", this._bwMode);
            game.settings.set(PLT_MODULE_ID, PLT_SETTING_BW_MODE, this._bwMode);
        });

        rightGroup.appendChild(resizeBtn);
        rightGroup.appendChild(bwBtn);
        header.appendChild(rightGroup);
    }

    _handleVideoTransition(root) {
        const pltWindow = root.querySelector(".plt-window");
        if (!pltWindow) return;

        const currentState = pltWindow.dataset.state;
        const lightType = pltWindow.dataset.lightType;
        const prevState = this._prevStateKey;
        const video = root.querySelector(".plt-video");

        if (!video) return;

        // First render or no state change — just play the loop
        if (!prevState) {
            this._prevStateKey = currentState;
            return;
        }

        this._prevStateKey = currentState;
    }


    async _onClose(options) {
        await super._onClose(options);
        this._unregisterHooks();
        this._lastStateKey = null;
        this._prevStateKey = null;
        if (this._closePopupHandler) {
            document.removeEventListener("click", this._closePopupHandler);
            this._closePopupHandler = null;
        }
    }

    async _getLightData() {
        const actor = this.actor;
        if (!actor) return DARKNESS_DATA;

        // 1. Personal light (existing logic)
        const activeLights = await actor.getActiveLightSources();
        if (activeLights && activeLights.length > 0) {
            const sorted = [...activeLights].sort(
                (a, b) => a.system.light.remainingSecs - b.system.light.remainingSecs
            );
            const item = sorted[0];
            const state = getLightState(item);

            return {
                stateKey: state.key,
                statusText: state.text,
                lightType: getLightType(item),
            };
        }

        // 2. Party light — check other party members
        const partyActors = game.actors.filter(
            a => a.type === "Player" && a._id !== actor._id
        );

        let bestRemaining = -1;
        let bestItem = null;

        for (const partyActor of partyActors) {
            const lights = await partyActor.getActiveLightSources();
            if (!lights) continue;
            for (const light of lights) {
                const remaining = light.system.light.remainingSecs;
                if (remaining > bestRemaining) {
                    bestRemaining = remaining;
                    bestItem = light;
                }
            }
        }

        if (bestItem) {
            const state = getLightState(bestItem);
            if (state.key === STATES.BRIGHT) return PARTY_BRIGHT_DATA;
            if (state.key === STATES.GOOD) return PARTY_GOOD_DATA;
            return PARTY_FADING_DATA;
        }

        // 3. No light at all
        return DARKNESS_DATA;
    }

    _registerHooks() {
        const refresh = foundry.utils.debounce(async () => {
            if (!this.rendered) return;
            const { stateKey } = await this._getLightData();
            if (stateKey === this._lastStateKey) return;
            this._lastStateKey = stateKey;
            this.render({ force: false });
        }, PLT_DEBOUNCE_MS);

        const partyIds = new Set(
            game.actors.filter(a => a.type === "Player").map(a => a._id)
        );
        if (partyIds.size === 0) return;

        const register = (name, fn) => {
            const id = Hooks.on(name, fn);
            this._hookIds.push({ name, id });
        };

        register("updateItem", (item) => {
            if (partyIds.has(item.parent?._id)) refresh();
        });
        register("createItem", (item) => {
            if (partyIds.has(item.parent?._id)) refresh();
        });
        register("deleteItem", (item) => {
            if (partyIds.has(item.parent?._id)) refresh();
        });

        // Also refresh on world time changes (light timers updated by GM)
        register("updateWorldTime", () => refresh());
    }

    _unregisterHooks() {
        for (const { name, id } of this._hookIds) {
            Hooks.off(name, id);
        }
        this._hookIds = [];
    }
}

Hooks.once("init", () => {
    // Register client settings for persisted preferences
    game.settings.register(PLT_MODULE_ID, PLT_SETTING_BW_MODE, {
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
    });
    game.settings.register(PLT_MODULE_ID, PLT_SETTING_COMPACT, {
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
    });

    const module = game.modules.get("foundry-homebrew");
    module.api ??= {};
    module.api.lightTracker = new PlayerLightTrackerApp();
});
