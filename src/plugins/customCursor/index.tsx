/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const STYLE_ID = "ec-custom-cursor-style";

type CursorPreset = {
    label: string;
    value: string;
    svg: string;
    hotspotX: number;
    hotspotY: number;
};

const PRESETS: CursorPreset[] = [
    {
        label: "Dot",
        value: "dot",
        hotspotX: 8,
        hotspotY: 8,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="#fff" stroke="#111" stroke-width="3"/></svg>`
    },
    {
        label: "Ring",
        value: "ring",
        hotspotX: 16,
        hotspotY: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="none" stroke="#fff" stroke-width="3"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>`
    },
    {
        label: "Crosshair",
        value: "crosshair",
        hotspotX: 16,
        hotspotY: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 2v8M16 22v8M2 16h8M22 16h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#5865F2"/></svg>`
    },
    {
        label: "Heart",
        value: "heart",
        hotspotX: 16,
        hotspotY: 14,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 27s-9-5.8-12.3-11C1.6 12.2 3 8 7.2 8c2.6 0 4.3 1.6 5.3 3.2C13.5 9.6 15.2 8 17.8 8c4.2 0 5.6 4.2 3.5 8C25 21.2 16 27 16 27z" fill="#ED4245" stroke="#111" stroke-width="2"/></svg>`
    },
    {
        label: "Sword",
        value: "sword",
        hotspotX: 5,
        hotspotY: 5,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M4 4l16 16" stroke="#e6edf3" stroke-width="4" stroke-linecap="round"/><path d="M17 21l4-4 3 3-4 4z" fill="#F0B232"/><path d="M14 24l-6-6" stroke="#8B5A2B" stroke-width="4" stroke-linecap="round"/><circle cx="6" cy="26" r="3" fill="#F0B232"/></svg>`
    },
    {
        label: "Paw",
        value: "paw",
        hotspotX: 16,
        hotspotY: 18,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><ellipse cx="16" cy="20" rx="8" ry="6.5" fill="#f4d7b5" stroke="#111" stroke-width="2"/><circle cx="8" cy="12" r="3.2" fill="#f4d7b5" stroke="#111" stroke-width="2"/><circle cx="13" cy="8.5" r="3.2" fill="#f4d7b5" stroke="#111" stroke-width="2"/><circle cx="19" cy="8.5" r="3.2" fill="#f4d7b5" stroke="#111" stroke-width="2"/><circle cx="24" cy="12" r="3.2" fill="#f4d7b5" stroke="#111" stroke-width="2"/></svg>`
    },
    {
        label: "Pixel",
        value: "pixel",
        hotspotX: 2,
        hotspotY: 2,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#fff" d="M2 2h6v2H4v16h2v2H4v2H2z"/><path fill="#111" d="M8 2h2v2H8zM4 4h2v16H4zM6 20h2v2H6zM4 22h2v2H4zM2 24h2v2H2z"/><path fill="#5865F2" d="M8 8h8v8H8z"/></svg>`
    },
];

const settings = definePluginSettings({
    preset: {
        type: OptionType.SELECT,
        description: "Built-in cursor style",
        options: PRESETS.map((preset, index) => ({
            label: preset.label,
            value: preset.value,
            default: index === 0
        })),
        onChange: applyCursor,
    },
    customUrl: {
        type: OptionType.STRING,
        description: "Custom cursor image URL. Overrides the preset when set. Use a PNG/GIF/CUR (GitHub or Discord CDN works best).",
        default: "",
        placeholder: "https://...",
        onChange: applyCursor,
    },
    size: {
        type: OptionType.SLIDER,
        description: "Cursor size",
        markers: [16, 24, 32, 48, 64],
        default: 32,
        stickToMarkers: false,
        onChange: applyCursor,
    },
    applyToTextFields: {
        type: OptionType.BOOLEAN,
        description: "Also replace the I-beam cursor in text boxes",
        default: false,
        onChange: applyCursor,
    },
});

function svgCursor(svg: string, size: number) {
    const scaled = svg.replace(/width="32"/, `width="${size}"`).replace(/height="32"/, `height="${size}"`);
    return `url("data:image/svg+xml,${encodeURIComponent(scaled)}")`;
}

function applyCursor() {
    document.getElementById(STYLE_ID)?.remove();

    const size = Math.max(16, Math.min(64, Number(settings.store.size) || 32));
    const customUrl = String(settings.store.customUrl ?? "").trim();
    const preset = PRESETS.find(item => item.value === settings.store.preset) ?? PRESETS[0];
    const scale = size / 32;
    const hotspotX = Math.round(preset.hotspotX * scale);
    const hotspotY = Math.round(preset.hotspotY * scale);
    const image = customUrl
        ? `url("${customUrl.replace(/"/g, "")}")`
        : svgCursor(preset.svg, size);
    const fallback = customUrl ? "auto" : "auto";
    const cursor = `${image} ${hotspotX} ${hotspotY}, ${fallback}`;
    const textCursor = settings.store.applyToTextFields
        ? cursor
        : "text";

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        html, body, #app-mount, #app-mount * {
            cursor: ${cursor} !important;
        }
        input, textarea, [contenteditable="true"], [role="textbox"] {
            cursor: ${textCursor} !important;
        }
    `;
    document.documentElement.appendChild(style);
}

function removeCursor() {
    document.getElementById(STYLE_ID)?.remove();
}

export default definePlugin({
    name: "CustomCursor",
    description: "Replace Discord's cursor with a custom image or a built-in style.",
    tags: ["Appearance", "Customisation", "Fun"],
    authors: [Devs.ewlle, Devs.rootpoi],
    settings,
    searchTerms: ["cursor", "imlec", "mouse", "pointer"],

    start() {
        applyCursor();
    },

    stop() {
        removeCursor();
    },
});
