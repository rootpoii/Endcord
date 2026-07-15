/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const ENDCORD_FILES = [
    IS_DISCORD_DESKTOP ? "patcher.js" : "endcordDesktopMain.js",
    IS_DISCORD_DESKTOP ? "preload.js" : "endcordDesktopPreload.js",
    IS_DISCORD_DESKTOP ? "renderer.js" : "endcordDesktopRenderer.js",
    IS_DISCORD_DESKTOP ? "renderer.css" : "endcordDesktopRenderer.css",
];

export function serializeErrors(func: (...args: any[]) => any) {
    return async function () {
        try {
            return {
                ok: true,
                value: await func(...arguments)
            };
        } catch (e: any) {
            return {
                ok: false,
                error: e instanceof Error ? {
                    // prototypes get lost, so turn error into plain object
                    ...e,
                    message: e.message,
                    name: e.name,
                    stack: e.stack
                } : e
            };
        }
    };
}
