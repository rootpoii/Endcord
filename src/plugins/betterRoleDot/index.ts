/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    bothStyles: {
        type: OptionType.BOOLEAN,
        description: "Show both role dot and coloured names",
        restartNeeded: true,
        default: false,
    },
    copyRoleColorInProfilePopout: {
        type: OptionType.BOOLEAN,
        description: "Allow click on role dot in profile popout to copy role color",
        restartNeeded: true,
        default: false
    }
});

export default definePlugin({
    name: "BetterRoleDot",
    authors: [Devs.Ven, Devs.AutumnVN],
    description:
        "Copy role colour on RoleDot (accessibility setting) click. Also allows using both RoleDot and coloured names simultaneously",
    tags: ["Roles", "Appearance"],
    settings,

    patches: [
        {
            // Class used in this module is dotBorderBase
            find: "M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z",
            replacement: {
                match: /,viewBox:"0 0 20 20"/,
                replace: "$&,onClick:()=>$self.copyToClipBoard(arguments[0].color),style:{cursor:'pointer'}",
            },
        },
        {
            find: '"dot"===',
            all: true,
            noWarn: true,
            predicate: () => settings.store.bothStyles,
            replacement: {
                match: /"(?:username|dot)"===\i(?!\.\i)/g,
                replace: "true",
            },
        },

        {
            find: "#{intl::ADD_ROLE_A11Y_LABEL}",
            all: true,
            predicate: () => settings.store.copyRoleColorInProfilePopout && !settings.store.bothStyles,
            noWarn: true,
            replacement: {
                match: /"dot"===\i/,
                replace: "true"
            }
        },
        {
            find: ".roleVerifiedIcon",
            all: true,
            predicate: () => settings.store.copyRoleColorInProfilePopout && !settings.store.bothStyles,
            noWarn: true,
            replacement: {
                match: /"dot"===\i/,
                replace: "true"
            }
        }
    ],

    copyToClipBoard(color: string) {
        copyWithToast(color);
    },
});
