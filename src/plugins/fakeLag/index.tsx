/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const ROOT_ID = "ec-fake-lag-root";

const CLYDE_PATH = "M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.06 72.06 0 0 0 45.64 0 105.69 105.69 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21h0A105.73 105.73 0 0 0 32.71 96.36 77.7 77.7 0 0 0 39.6 85.25a68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1A105.25 105.25 0 0 0 126.6 80.22h0C129.24 52.84 122.09 29.11 107.7 8.07ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53 91.08 65.69 84.69 65.69Z";

const settings = definePluginSettings({
    keybind: {
        type: OptionType.SELECT,
        description: "Toggle the fake connecting screen",
        options: [
            { label: "F7", value: "F7", default: true },
            { label: "F6", value: "F6" },
            { label: "F9", value: "F9" },
            { label: "F10", value: "F10" },
        ],
    },
    title: {
        type: OptionType.SELECT,
        description: "Overlay title",
        options: [
            { label: "Connecting", value: "Connecting", default: true },
            { label: "Reconnecting", value: "Reconnecting" },
            { label: "Starting", value: "Starting" },
        ],
    },
    autoHideSeconds: {
        type: OptionType.SLIDER,
        description: "Hide automatically after this many seconds. 0 means stay until you press the key again.",
        markers: [0, 3, 5, 10, 15, 30],
        default: 0,
        stickToMarkers: false,
    },
});

let active = false;
let hideTimer: number | undefined;

function isToggleKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.repeat) return false;
    return event.key === settings.store.keybind;
}

function showOverlay() {
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "ec-fake-lag-root";
    root.innerHTML = `
        <svg class="ec-fake-lag-logo" viewBox="0 0 127.14 96.36" aria-hidden="true">
            <path fill="currentColor" d="${CLYDE_PATH}"/>
        </svg>
        <p class="ec-fake-lag-title">${settings.store.title}</p>
        <div class="ec-fake-lag-track"><div class="ec-fake-lag-track-fill"></div></div>
    `;
    document.body.appendChild(root);

    const autoHide = Number(settings.store.autoHideSeconds) || 0;
    if (autoHide > 0) {
        hideTimer = window.setTimeout(() => setActive(false), autoHide * 1000);
    }
}

function hideOverlay() {
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
    document.getElementById(ROOT_ID)?.remove();
}

function setActive(next: boolean) {
    active = next;
    if (active) showOverlay();
    else hideOverlay();
}

function onKeyDown(event: KeyboardEvent) {
    if (!isToggleKey(event)) return;
    event.preventDefault();
    setActive(!active);
}

export default definePlugin({
    name: "FakeLag",
    description: "Press F7 to show Discord's connecting screen. Press again to hide it.",
    tags: ["Fun"],
    authors: [Devs.ewlle, Devs.rootpoi],
    settings,
    searchTerms: ["lag", "connecting", "reconnect", "f7"],

    start() {
        document.addEventListener("keydown", onKeyDown, true);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown, true);
        setActive(false);
    },
});
