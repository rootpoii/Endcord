/*
 * Endcord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to Endcord from Nightcord (coll, viciouscal); see https://git.nightcord.su/nightcord/nightcord

import { definePluginSettings } from "@api/Settings";
import { EndcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Forms } from "@webpack/common";

const STYLE_ID = "vc-smoothtype";

const settings = definePluginSettings({
    transitionDelay: {
        type: OptionType.NUMBER,
        description: "Transition Delay (ms)",
        default: 60,
        onChange: () => applyCSS(),
    },
    animationType: {
        type: OptionType.SELECT,
        description: "Animation Type",
        options: [
            { label: "Ease", value: "ease", default: true },
            { label: "Linear", value: "linear" },
            { label: "Ease-in", value: "ease-in" },
            { label: "Ease-out", value: "ease-out" },
            { label: "Ease-in-out", value: "ease-in-out" },
        ],
        onChange: () => applyCSS(),
    },
    caretColor: {
        type: OptionType.COMPONENT,
        description: "Caret color",
        default: 0xffffff,
        component: () => {
            const hex = "#" + ((settings.store.caretColor ?? 0xffffff).toString(16).padStart(6, "0"));
            return (
                <div>
                    <Forms.FormTitle tag="h3">Caret Color</Forms.FormTitle>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                            type="color"
                            value={hex}
                            onChange={e => {
                                const n = parseInt(e.target.value.replace("#", ""), 16);
                                if (!isNaN(n)) { settings.store.caretColor = n; applyCSS(); }
                            }}
                            style={{ width: 40, height: 32, padding: 2, border: "none", borderRadius: 4, cursor: "pointer", background: "none" }}
                        />
                        <input
                            type="text"
                            value={hex}
                            onChange={e => {
                                const h = e.target.value.replace("#", "");
                                const n = parseInt(h, 16);
                                if (!isNaN(n) && h.length === 6) { settings.store.caretColor = n; applyCSS(); }
                            }}
                            style={{ width: 90, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--background-modifier-accent)", background: "var(--background-secondary)", color: "var(--text-normal)", fontSize: 13 }}
                        />
                    </div>
                </div>
            );
        },
    },
});

function toHex(n: number) {
    return `#${n.toString(16).padStart(6, "0")}`;
}

function buildCSS(): string {
    const color = toHex(settings.store.caretColor ?? 0xffffff);
    const ms = settings.store.transitionDelay ?? 60;
    const easing = settings.store.animationType ?? "ease";
    return `
@keyframes vc-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
}
#vc-smoothtype-caret.is-blinking {
    animation: vc-blink 1s ease-in-out infinite;
}
#vc-smoothtype-caret {
    position: fixed;
    top: 0; left: 0;
    width: 2px;
    border-radius: 2px;
    background: ${color};
    pointer-events: none;
    z-index: 99999;
    display: none;
    transition: left ${ms}ms ${easing}, top ${ms}ms ${easing}, height ${ms}ms ${easing};
}
[data-slate-editor] { caret-color: transparent !important; }
`;
}

function getCaret(): HTMLDivElement {
    let el = document.getElementById("vc-smoothtype-caret") as HTMLDivElement | null;
    if (!el) {
        el = document.createElement("div");
        el.id = "vc-smoothtype-caret";
        document.body.appendChild(el);
    }
    return el;
}

let blinkTimer: ReturnType<typeof setTimeout> | null = null;

function startBlink() { getCaret().classList.add("is-blinking"); }

function stopBlink() {
    getCaret().classList.remove("is-blinking");
    if (blinkTimer) clearTimeout(blinkTimer);
    blinkTimer = setTimeout(startBlink, 1000);
}

// Track RAF to prevent stacking multiple RAF calls
let rafPending = false;

function scheduleCaretUpdate() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        applyCaretPosition();
    });
}

// Flag to prevent mutation observer from re-triggering on our own caret style changes
let updatingCaret = false;

function applyCaretPosition() {
    const el = getCaret();
    if (!document.activeElement?.closest("[data-slate-editor]")) {
        updatingCaret = true;
        el.style.display = "none";
        updatingCaret = false;
        return;
    }
    const sel = window.getSelection();
    if (!sel?.rangeCount) {
        updatingCaret = true;
        el.style.display = "none";
        updatingCaret = false;
        return;
    }
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(false);
    const rects = range.getClientRects();
    let rect: DOMRect | null = rects.length > 0 ? rects[0] : null;
    if (!rect || rect.height === 0) {
        const node = range.startContainer;
        const parent = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null;
        if (parent) rect = parent.getBoundingClientRect();
    }
    if (!rect || rect.height === 0) {
        updatingCaret = true;
        el.style.display = "none";
        updatingCaret = false;
        return;
    }
    const newLeft = rect.right + "px";
    const newTop = rect.top + "px";
    const newHeight = rect.height + "px";
    updatingCaret = true;
    if (el.style.left !== newLeft || el.style.top !== newTop) {
        if (el.style.display !== "none") stopBlink();
    }
    el.style.display = "block";
    el.style.left = newLeft;
    el.style.top = newTop;
    el.style.height = newHeight;
    updatingCaret = false;
}

// Observe only the active Slate editor container, not the whole document.body.
// This avoids the infinite mutation loop caused by updating caret element styles.
let observer: MutationObserver | null = null;
let observedEditor: Element | null = null;

function getActiveSlateEditor(): Element | null {
    return document.activeElement?.closest("[data-slate-editor]") ?? null;
}

function startObserver() {
    observer = new MutationObserver(() => {
        // Skip if we are the ones making the DOM change (caret style update)
        if (updatingCaret) return;
        scheduleCaretUpdate();
    });
}

function observeEditor(editor: Element) {
    if (observedEditor === editor) return;
    observer?.disconnect();
    observedEditor = editor;
    observer?.observe(editor, { childList: true, subtree: true, characterData: true });
}

function stopObserver() {
    observer?.disconnect();
    observer = null;
    observedEditor = null;
}

const handlers = {
    sel: () => {
        const editor = getActiveSlateEditor();
        if (editor) observeEditor(editor);
        scheduleCaretUpdate();
    },
    focus: () => {
        const editor = getActiveSlateEditor();
        if (editor) observeEditor(editor);
        scheduleCaretUpdate();
    },
    blur: () => {
        observer?.disconnect();
        observedEditor = null;
        updatingCaret = true;
        getCaret().style.display = "none";
        updatingCaret = false;
    },
    key: () => scheduleCaretUpdate(),
    click: () => scheduleCaretUpdate(),
};

function startListeners() {
    document.addEventListener("selectionchange", handlers.sel);
    document.addEventListener("focusin", handlers.focus);
    document.addEventListener("focusout", handlers.blur);
    document.addEventListener("keyup", handlers.key, true);
    document.addEventListener("click", handlers.click, true);
}

function stopListeners() {
    document.removeEventListener("selectionchange", handlers.sel);
    document.removeEventListener("focusin", handlers.focus);
    document.removeEventListener("focusout", handlers.blur);
    document.removeEventListener("keyup", handlers.key, true);
    document.removeEventListener("click", handlers.click, true);
}

function applyCSS() {
    document.getElementById(STYLE_ID)?.remove();
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = buildCSS();
    document.head.appendChild(s);
}

function removeCSS() {
    document.getElementById(STYLE_ID)?.remove();
}

export default definePlugin({
    name: "SmoothType",
    description: "Fully customize the cursor caret — transition delay, easing, and color — for a smooth typing animation.",
    authors: [EndcordDevs.Sharp],
    settings,

    start() {
        applyCSS();
        getCaret();
        startObserver();
        startListeners();
    },

    stop() {
        stopObserver();
        stopListeners();
        removeCSS();
        if (blinkTimer) clearTimeout(blinkTimer);
        document.getElementById("vc-smoothtype-caret")?.remove();
        rafPending = false;
    },
});
