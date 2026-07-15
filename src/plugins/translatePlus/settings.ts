/*
 * Endcord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    target: {
        type: OptionType.SELECT,
        description: "Target language for translations.",
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
        restartNeeded: true
    },
    toki: {
        type: OptionType.BOOLEAN,
        description: "Enable Toki Pona",
        default: true,
        restartNeeded: true
    },
    sitelen: {
        type: OptionType.BOOLEAN,
        description: "Enable Sitelen Pona",
        default: true,
        restartNeeded: true
    },
    shavian: {
        type: OptionType.BOOLEAN,
        description: "Enable Shavian",
        default: true,
        restartNeeded: true
    }
});
