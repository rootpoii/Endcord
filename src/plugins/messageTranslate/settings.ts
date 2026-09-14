/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    targetLanguage: {
        type: OptionType.SELECT,
        description: "Target language for auto-translations.",
        options: [
            { label: "English", value: "en", default: true },
            { label: "German", value: "de" },
            { label: "Japanese", value: "ja" },
            { label: "Spanish", value: "es" },
            { label: "Chinese (Simplified)", value: "zh-CN" },
            { label: "Chinese (Traditional)", value: "zh-TW" },
            { label: "Korean", value: "ko" },
            { label: "Portuguese", value: "pt" },
            { label: "Russian", value: "ru" },
            { label: "Italian", value: "it" },
            { label: "Dutch", value: "nl" },
            { label: "Polish", value: "pl" },
            { label: "Turkish", value: "tr" },
            { label: "Arabic", value: "ar" },
            { label: "Hindi", value: "hi" },
            { label: "Vietnamese", value: "vi" },
            { label: "Thai", value: "th" },
            { label: "Swedish", value: "sv" },
            { label: "Norwegian", value: "no" },
            { label: "Danish", value: "da" },
            { label: "Finnish", value: "fi" },
            { label: "Ukrainian", value: "uk" },
        ],
    },
    confidenceRequirement: {
        type: OptionType.NUMBER,
        description: "Minimum confidence (0 to 1) required to show a translation.",
        default: 0.8,
    },
    autoTranslate: {
        type: OptionType.BOOLEAN,
        description: "Automatically translate messages as they appear.",
        default: true,
    },
    skipOwnMessages: {
        type: OptionType.BOOLEAN,
        description: "Do not translate your own messages.",
        default: true,
    },
    skipBotMessages: {
        type: OptionType.BOOLEAN,
        description: "Do not translate bot messages.",
        default: false,
    },
    ignoredGuilds: {
        type: OptionType.STRING,
        description: "Comma-separated list of server IDs to not translate in.",
        default: "",
    },
    ignoredChannels: {
        type: OptionType.STRING,
        description: "Comma-separated list of channel IDs to not translate in.",
        default: "",
    },
    ignoredUsers: {
        type: OptionType.STRING,
        description: "Comma-separated list of user IDs to not translate.",
        default: "",
    },
    showIndicator: {
        type: OptionType.BOOLEAN,
        description: "Append a small (translated) indicator to translated messages.",
        default: true,
    },
});

function parseIdList(value: string): Set<string> {
    return new Set(value.split(",").map(s => s.trim()).filter(Boolean));
}

export function getIgnoredGuilds(): Set<string> {
    return parseIdList(settings.store.ignoredGuilds);
}

export function getIgnoredChannels(): Set<string> {
    return parseIdList(settings.store.ignoredChannels);
}

export function getIgnoredUsers(): Set<string> {
    return parseIdList(settings.store.ignoredUsers);
}
