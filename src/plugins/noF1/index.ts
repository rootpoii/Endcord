/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoF1",
    description: "Disables F1 help bind.",
    tags: ["Utility"],
    authors: [Devs.Cyn],
    patches: [
        {
            find: ',"f1"],comboKeysBindGlobal:',
            replacement: {
                match: ',"f1"],comboKeysBindGlobal:',
                replace: "],comboKeysBindGlobal:",
            },
        },
    ],
});
