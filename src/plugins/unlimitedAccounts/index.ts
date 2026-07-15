/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    maxAccounts: {
        description: "Number of accounts that can be added, or 0 for no limit",
        default: 0,
        type: OptionType.NUMBER,
        restartNeeded: true,
    },
});

export default definePlugin({
    name: "UnlimitedAccounts",
    description: "Increases the amount of accounts you can add.",
    tags: ["Utility"],
    authors: [Devs.thororen],
    settings,
    patches: [
        {
            find: "pushSyncToken:null}),",
            replacement: [
                {
                    match: /(\).length>)5/,
                    replace: "$1$self.getMaxAccounts()",
                },
                {
                    match: /(\i.splice\()5/,
                    replace: "$1$self.getMaxAccounts()",
                },
            ]
        },
        {
            find: "getCurrentUser(),multiAccountUsers",
            replacement: [
                {
                    match: /(maxNumAccounts:)5/,
                    replace: "$1$self.getMaxAccounts()",
                },
                {
                    match: /(\i.length(<|>=))5/g,
                    replace: "$1$self.getMaxAccounts()",
                },
            ]
        },
    ],
    getMaxAccounts() { return settings.store.maxAccounts === 0 ? Infinity : settings.store.maxAccounts; },
});
