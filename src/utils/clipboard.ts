/*
 * Endcord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function copyToClipboard(text: string): Promise<void> {
    return IS_DISCORD_DESKTOP ? DiscordNative.clipboard.copy(text) : navigator.clipboard.writeText(text);
}


export async function readClipboard(): Promise<string> {
    try {
        if (typeof DiscordNative !== "undefined" && DiscordNative?.clipboard?.read) {
            return DiscordNative.clipboard.read();
        }
        return await navigator.clipboard.readText();
    } catch {
        return "";
    }
}
