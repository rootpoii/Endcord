/*
 * Endcord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, IS_LINUX } from "@utils/constants";
import definePlugin from "@utils/types";

const EDITABLE = "[data-slate-editor],[contenteditable='true'],input,textarea,[role='textbox']";

function eventElement(e: Event): Element | null {
    const t = e.target;
    if (t instanceof Element) return t;
    if (t instanceof Node) return t.parentElement;
    return null;
}

function preventMiddleClick(e: MouseEvent) {
    if (e.button !== 1) return;
    if (!eventElement(e)?.closest(EDITABLE)) return;
    e.preventDefault();
    e.stopPropagation();
}

function disarmSpellcheck(node: Node) {
    if (!(node instanceof HTMLElement)) return;
    const editors: HTMLElement[] = [];
    if (node.matches(EDITABLE)) editors.push(node);
    node.querySelectorAll(EDITABLE).forEach(el => editors.push(el as HTMLElement));
    for (const el of editors) {
        if (el.getAttribute("spellcheck") !== "false") el.setAttribute("spellcheck", "false");
    }
}

let spellObserver: MutationObserver | null = null;

export default definePlugin({
    name: "NoMiddleClickPaste",
    description: "Stops Linux middle-click paste and spellcheck from scrambling the chat box",
    authors: [Devs.Darxoon],
    hidden: !IS_LINUX,
    required: IS_LINUX,

    start() {
        const opts = { capture: true };
        window.addEventListener("mousedown", preventMiddleClick, opts);
        window.addEventListener("mouseup", preventMiddleClick, opts);
        window.addEventListener("auxclick", preventMiddleClick, opts);
        window.addEventListener("pointerdown", preventMiddleClick, opts);
        window.addEventListener("pointerup", preventMiddleClick, opts);

        disarmSpellcheck(document.body);
        spellObserver = new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) disarmSpellcheck(node);
            }
        });
        spellObserver.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        const opts = { capture: true };
        window.removeEventListener("mousedown", preventMiddleClick, opts);
        window.removeEventListener("mouseup", preventMiddleClick, opts);
        window.removeEventListener("auxclick", preventMiddleClick, opts);
        window.removeEventListener("pointerdown", preventMiddleClick, opts);
        window.removeEventListener("pointerup", preventMiddleClick, opts);
        spellObserver?.disconnect();
        spellObserver = null;
    },
});
