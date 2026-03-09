// Player Light Tracker
// Shows the player's active light source with immersive, thematic feedback.
// No exact timers — just vague descriptions of how their light is doing.

const PLT_MODULE_PATH = "modules/foundry-homebrew";


// Light remaining-fraction thresholds for state changes
const PLT_BRIGHT_THRESHOLD = 0.5;   // above this → bright
const PLT_GOOD_THRESHOLD = 0.25;    // above this → good, below → fading

// How long to wait (ms) before re-rendering after a hook fires
const PLT_DEBOUNCE_MS = 250;

// Default window width in pixels
const PLT_WINDOW_WIDTH = 320;

// ID for the injected <style> element
const PLT_STYLES_ID = "plt-styles";

// Show character selector when more than one actor is available
const PLT_MIN_ACTORS_FOR_SELECTOR = 2;

// Normal video playback rate (used after transitions)
const PLT_NORMAL_PLAYBACK_RATE = 1.0;

const PLT_VIDEOS = {
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
};

const PLT_STYLES = `
    /* Override Foundry window chrome */
    #player-light-tracker {
        background: #000000;
        border: 1px solid #333;
        border-radius: 4px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
    }

    #player-light-tracker .window-header {
        background: transparent;
        border: none;
        padding: 2px 4px;
        min-height: 0;
        display: flex;
        justify-content: space-between;
    }

    /* Move close button to the left */
    #player-light-tracker .window-header [data-action="close"] {
        order: -1;
    }



    #player-light-tracker .window-title {
        display: none;
    }

    .plt-window {
        background: #000000;
        color: #e8dcc8;
        text-align: center;
        padding: 24px 20px;
        min-width: 280px;
        min-height: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
    }

    .plt-status-text {
        font-family: "JSL Blackletter", serif;
        font-size: 28px;
        line-height: 1.3;
        color: #e8dcc8;
        transition: color 0.8s ease, text-shadow 0.8s ease;
    }

    .plt-light-name {
        font-size: 13px;
        color: #888;
        font-style: italic;
    }

    .plt-animation {
        width: 100%;
        aspect-ratio: 750 / 1334;
        position: relative;
        overflow: hidden;
    }

    .plt-video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        transition: opacity 0.8s ease;
    }

    .plt-video-hidden {
        opacity: 0;
    }

    /* State: darkness */
    .plt-state-darkness .plt-status-text {
        color: #888;
    }

    /* State: bright */
    .plt-state-bright .plt-status-text {
        color: #f5c542;
        text-shadow: 0 0 20px rgba(245, 197, 66, 0.4);
    }

    /* State: good */
    .plt-state-good .plt-status-text {
        color: #d4a843;
        text-shadow: 0 0 12px rgba(212, 168, 67, 0.25);
    }

    /* State: fading */
    .plt-state-fading .plt-status-text {
        color: #a07030;
        text-shadow: 0 0 6px rgba(160, 112, 48, 0.2);
        animation: plt-flicker 2s ease-in-out infinite;
    }

    @keyframes plt-flicker {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }

    /* Spell light: purple-blue gradient */
    .plt-window[data-light-type="spell"].plt-state-bright .plt-status-text {
        color: #b4a0f5;
        text-shadow: 0 0 20px rgba(180, 160, 245, 0.4);
    }

    .plt-window[data-light-type="spell"].plt-state-good .plt-status-text {
        color: #9585d4;
        text-shadow: 0 0 12px rgba(149, 133, 212, 0.25);
    }

    .plt-window[data-light-type="spell"].plt-state-fading .plt-status-text {
        color: #7068a0;
        text-shadow: 0 0 6px rgba(112, 104, 160, 0.2);
    }

    /* State: party-bright */
    .plt-state-party-bright .plt-status-text {
        color: #8a9aaa;
        font-size: 24px;
        text-shadow: 0 0 10px rgba(138, 154, 170, 0.2);
    }

    /* State: party-good */
    .plt-state-party-good .plt-status-text {
        color: #7a8a9a;
        font-size: 24px;
        text-shadow: 0 0 8px rgba(122, 138, 154, 0.15);
    }

    /* State: party-fading */
    .plt-state-party-fading .plt-status-text {
        color: #6a7a8a;
        font-size: 24px;
        text-shadow: 0 0 6px rgba(106, 122, 138, 0.1);
    }

    .plt-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding-bottom: 8px;
    }

    .plt-header-title {
        font-family: "JSL Blackletter", serif;
        font-size: 24px;
        color: #ffffff;
        letter-spacing: 1px;
    }

    .plt-header-character {
        font-size: 11px;
        color: #999;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    .plt-character-selector {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 6px 0 2px;
    }

    .plt-character-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid #444;
        padding: 0;
        cursor: pointer;
        overflow: hidden;
        background: #111;
        transition: border-color 0.3s, box-shadow 0.3s;
    }

    .plt-character-btn img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .plt-character-btn:hover {
        border-color: #d4a843;
    }

    .plt-character-btn.plt-character-active {
        border-color: #f5c542;
        box-shadow: 0 0 8px rgba(245, 197, 66, 0.4);
    }

    .plt-douse-btn {
        background: transparent;
        border: 1px solid #555;
        color: #999;
        padding: 6px 16px;
        cursor: pointer;
        font-size: 12px;
        transition: border-color 0.3s, color 0.3s;
    }

    .plt-douse-btn:hover {
        border-color: #a07030;
        color: #e8dcc8;
    }

    .plt-douse-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    /* Header toolbar buttons */
    #player-light-tracker .window-header .plt-header-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #999;
        font-size: 12px;
        padding: 2px 4px;
        transition: color 0.3s;
    }

    #player-light-tracker .window-header .plt-header-btn:hover {
        color: #e8dcc8;
    }

    #player-light-tracker .window-header .plt-header-btn.plt-active {
        color: #e8dcc8;
    }

    .plt-header-right {
        display: flex;
        gap: 4px;
    }

    /* Compact mode: shrink the animation */
    .plt-compact .plt-animation {
        aspect-ratio: auto;
        height: 0;
        overflow: hidden;
        transition: height 0.4s ease;
    }

    .plt-compact .plt-window {
        min-height: 0;
        padding: 12px 12px;
        gap: 8px;
    }

    .plt-compact .plt-status-text {
        font-size: 18px;
    }

    .plt-compact .plt-header-title {
        font-size: 18px;
    }

    .plt-douse-confirm {
        text-align: center;
        font-style: italic;
    }

    /* B&W filter */
    .plt-bw .plt-video {
        filter: grayscale(1);
    }

    .plt-bw .plt-status-text {
        filter: grayscale(1);
    }
`;

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
    lightName: null,
    lightItem: null,
    lightType: "torch",
};

const PARTY_BRIGHT_DATA = {
    stateKey: STATES.PARTY_BRIGHT,
    statusText: "The party has strong light. Don't stray.",
    lightName: null,
    lightItem: null,
    lightType: "torch",
};

const PARTY_GOOD_DATA = {
    stateKey: STATES.PARTY_GOOD,
    statusText: "The party has weak light. Stay close.",
    lightName: null,
    lightItem: null,
    lightType: "torch",
};

const PARTY_FADING_DATA = {
    stateKey: STATES.PARTY_FADING,
    statusText: "The party's light is fading.",
    lightName: null,
    lightItem: null,
    lightType: "torch",
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

function getVideoPath(filename) {
    return `${PLT_MODULE_PATH}/assets/video/${filename}`;
}

class PlayerLightTrackerApp extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "player-light-tracker",
        window: {
            title: "Light",
            resizable: false,
            minimizable: false,
        },
        position: {
            width: PLT_WINDOW_WIDTH,
        },
    });

    constructor(options = {}) {
        super(options);
        this._hookIds = [];
        this._viewedActorId = null;
        this._bwMode = false;
        this._compact = false;
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

        // Inject styles once
        if (!document.getElementById("plt-styles")) {
            const style = document.createElement("style");
            style.id = "plt-styles";
            style.textContent = PLT_STYLES;
            document.head.appendChild(style);
        }

        const { stateKey, statusText, lightName, lightItem, lightType } = await this._getLightData();
        const videos = PLT_VIDEOS[lightType];
        const videoFile = videos[stateKey];

        // Build character selector: GMs see all PCs, players see only owned PCs
        let characterSelectorHTML = "";
        const selectableActors = game.user.isGM
            ? game.actors.filter(a => a.type === "Player")
            : game.actors.filter(a => a.isOwner && a.type === "Player");
        if (selectableActors.length > 1) {
            const currentId = this.actor?._id ?? "";
            const buttons = selectableActors.map(a =>
                `<button type="button" class="plt-character-btn ${a._id === currentId ? "plt-character-active" : ""}"
                        data-actor-id="${a._id}" title="${a.name}">
                    <img src="${a.img}" alt="${a.name}">
                </button>`
            ).join("");
            characterSelectorHTML = `<div class="plt-character-selector">${buttons}</div>`;
        }

        const characterName = this.actor?.name ?? "Unknown";

        container.innerHTML = `
            <div class="plt-window plt-state-${stateKey}" data-state="${stateKey}" data-light-type="${lightType}">
                <div class="plt-header">
                    <div class="plt-header-title">Light Tracker</div>
                    <div class="plt-header-character">${characterName}</div>
                    ${characterSelectorHTML}
                </div>
                <div class="plt-animation">
                    ${videoFile ? `<video class="plt-video" autoplay loop muted playsinline
                           src="${getVideoPath(videoFile)}"></video>` : ""}
                </div>
                <div class="plt-status-text">${statusText}</div>
                ${lightName ? `<div class="plt-light-name">${lightName}</div>` : ""}
                ${lightItem ? `<button type="button" class="plt-douse-btn">Douse my flame</button>` : ""}
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

        // Wire character selector
        for (const btn of root.querySelectorAll(".plt-character-btn")) {
            btn.addEventListener("click", () => {
                this._viewedActorId = btn.dataset.actorId;
                this._prevStateKey = null;
                this._lastStateKey = null;
                this.render({ force: true });
            });
        }

        const douseBtn = root.querySelector(".plt-douse-btn");
        if (douseBtn) {
            douseBtn.addEventListener("click", async (event) => {
                event.preventDefault();
                await this._onDouse();
            });
        }

        // Handle video transitions
        this._handleVideoTransition(root);

        // Register hooks (only on first render)
        if (this._hookIds.length === 0) {
            this._registerHooks();
        }
    }

    _injectHeaderButtons(root) {
        const header = root.closest("#player-light-tracker")?.querySelector(".window-header");
        if (!header || header.querySelector(".plt-header-right")) return;

        const rightGroup = document.createElement("div");
        rightGroup.className = "plt-header-right";

        // Resize toggle
        const resizeBtn = document.createElement("button");
        resizeBtn.type = "button";
        resizeBtn.className = `plt-header-btn ${this._compact ? "plt-active" : ""}`;
        resizeBtn.innerHTML = `<i class="fas fa-expand-alt"></i>`;
        resizeBtn.title = "Toggle size";
        resizeBtn.addEventListener("click", () => {
            this._compact = !this._compact;
            resizeBtn.classList.toggle("plt-active", this._compact);
            const appEl = root.closest("#player-light-tracker");
            if (appEl) appEl.classList.toggle("plt-compact", this._compact);
        });

        // B&W toggle
        const bwBtn = document.createElement("button");
        bwBtn.type = "button";
        bwBtn.className = `plt-header-btn ${this._bwMode ? "plt-active" : ""}`;
        bwBtn.innerHTML = `<i class="fas fa-adjust"></i>`;
        bwBtn.title = "Black & White";
        bwBtn.addEventListener("click", () => {
            this._bwMode = !this._bwMode;
            const pltWindow = root.querySelector(".plt-window");
            if (pltWindow) pltWindow.classList.toggle("plt-bw", this._bwMode);
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
        document.getElementById("plt-styles")?.remove();
        this._lastStateKey = null;
        this._prevStateKey = null;
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
                lightName: item.name,
                lightItem: item,
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

    async _onDouse() {
        const { lightItem } = await this._getLightData();
        if (!lightItem) return;

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Douse Light" },
            content: `<p style="text-align: center; font-style: italic;">Extinguish your ${lightItem.name}?<br>The darkness waits...</p>`,
            yes: { label: "Douse my flame" },
            no: { label: "Not yet" },
        });

        if (!confirmed) return;

        // Re-check that the light still exists (it may have expired)
        const { lightItem: currentLight } = await this._getLightData();
        if (!currentLight) {
            ui.notifications.warn("Your light has already gone out.");
            return;
        }

        const actor = this.actor;
        await actor.yourLightWentOut(currentLight._id);
        if (currentLight.type === "Effect") {
            await actor.deleteEmbeddedDocuments("Item", [currentLight._id]);
        } else {
            await actor.updateEmbeddedDocuments("Item", [{
                "_id": currentLight._id,
                "system.light.active": false,
            }]);
        }
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

// Singleton pattern — toggle on repeated macro execution
if (!game.playerLightTrackerApp) {
    game.playerLightTrackerApp = new PlayerLightTrackerApp();
}

if (game.playerLightTrackerApp.rendered) {
    game.playerLightTrackerApp.close();
} else {
    game.playerLightTrackerApp.render({ force: true });
}
