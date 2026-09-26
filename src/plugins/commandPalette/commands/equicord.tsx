/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PaletteCommand } from "../api/types";
import { BoltIcon, GearIcon, PaintIcon, RestartIcon } from "../ui/icons";
import { openSettingsPage } from "./openSettings";

const SECTION = "Endcord";

export const equicordCommands: PaletteCommand[] = [
    {
        id: "equicord.settings",
        title: "Open Endcord Settings",
        section: SECTION,
        keywords: ["endcord", "equicord", "vencord", "settings"],
        icon: GearIcon,
        actions: [{
            id: "run",
            label: "Open Endcord Settings",
            run: () => void openSettingsPage("endcord_main")
        }]
    },
    {
        id: "equicord.quickCss",
        title: "Open QuickCSS",
        section: SECTION,
        keywords: ["css", "quickcss", "editor", "style"],
        icon: PaintIcon,
        actions: [{
            id: "run",
            label: "Open QuickCSS",
            run: () => EndcordNative.quickCss.openEditor()
        }]
    },
    {
        id: "equicord.updater",
        title: "Open Updater",
        section: SECTION,
        keywords: ["update", "updater", "version"],
        icon: BoltIcon,
        predicate: () => !IS_UPDATER_DISABLED,
        actions: [{
            id: "run",
            label: "Open Updater",
            run: () => void openSettingsPage("endcord_updater")
        }]
    },
    {
        id: "equicord.changelog",
        title: "Open Changelog",
        section: SECTION,
        keywords: ["changelog", "news", "whats new"],
        icon: BoltIcon,
        actions: [{
            id: "run",
            label: "Open Changelog",
            run: () => void openSettingsPage("endcord_changelog")
        }]
    },
    {
        id: "equicord.restart",
        title: "Restart Discord",
        section: SECTION,
        keywords: ["restart", "reload", "refresh"],
        icon: RestartIcon,
        actions: [{
            id: "run",
            label: "Restart Discord",
            run: () => window.location.reload()
        }]
    }
];
