/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "AlwaysAnimate",
    description: "Animates anything that can be animated",
    tags: ["Appearance", "Fun"],
    authors: [Devs.FieryFlames],

    patches: [
        {
            find: "canAnimate:",
            all: true,
            // Some modules match the find but the replacement is returned untouched
            noWarn: true,
            replacement: {
                match: /canAnimate:.+?([,}].*?\))/g,
                replace: (m, rest) => {
                    const destructuringMatch = rest.match(/}=.+/);
                    if (destructuringMatch == null) return `canAnimate:!0${rest}`;
                    return m;
                }
            }
        },
        {
            // Status emojis
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: {
                match: /(\.CUSTOM_STATUS.+?animateEmoji:)\i/,
                replace: "$1!0"
            }
        },
        {
            // Guild Banner
            find: "#{intl::DISCOVERABLE_GUILD_HEADER_PUBLIC_INFO}",
            replacement: {
                match: /(guildBanner:\i,animate:)\i(?=}\):null)/,
                replace: "$1!0"
            }
        },
        {
            // Gradient roles in chat
            find: "=!1,contentOnly:",
            replacement: {
                match: /animate:\i/,
                replace: "animate:!0"
            }
        },
        {
            // Gradient roles in member list
            find: '="left",className:',
            replacement: {
                match: /,animateGradient:/,
                replace: ",animateGradient:!0,_oldAnimateGradient:"
            }
        },
        {
            // Nameplates
            find: ".MINI_PREVIEW,[",
            replacement: {
                match: /animate:\i,loop:/,
                replace: "animate:true,loop:true,_loop:"
            }
        }
    ]
});
