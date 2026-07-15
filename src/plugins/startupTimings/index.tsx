/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ClockIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";

import StartupTimingPage from "./StartupTimingPage";

export default definePlugin({
    name: "StartupTimings",
    description: "Adds Startup Timings to the Settings menu",
    tags: ["Developers"],
    authors: [Devs.Megu],
    start() {
        SettingsPlugin.customEntries.push({
            key: "endcord_startup_timings",
            title: "Startup Timings",
            Component: StartupTimingPage,
            Icon: ClockIcon
        });
    },
    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "endcord_startup_timings");
    },
});
