/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function relaunch() {
    if (IS_DISCORD_DESKTOP)
        window.DiscordNative.app.relaunch();
    else if (IS_VESKTOP)
        window.VesktopNative.app.relaunch();
    else
        location.reload();
}


export function showItemInFolder(path: string) {
    if (typeof DiscordNative !== "undefined" && DiscordNative?.fileManager?.showItemInFolder) {
        DiscordNative.fileManager.showItemInFolder(path);
    } else if (typeof EndcordNative !== "undefined" && (EndcordNative as any)?.showItemInFolder) {
        (EndcordNative as any).showItemInFolder(path);
    }
}
