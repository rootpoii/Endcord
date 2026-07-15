/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import managedStyle from "./style.css?managed";

export default definePlugin({
    name: "MemberListDecoratorsAPI",
    description: "API to add decorators to member list (both in servers and DMs)",
    authors: [Devs.TheSun, Devs.Ven],

    managedStyle,

    patches: [
        {
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: [
                {
                    match: /children:\[(?=.{0,300},lostPermissionTooltipText:)/,
                    replace: "children:[Endcord.Api.MemberListDecorators.__getDecorators(arguments[0],'guild'),"
                }
            ]
        },
        {
            find: "PrivateChannel.renderAvatar",
            replacement: {
                match: /decorators:(\i\.isSystemDM\(\)\?.+?:null)/,
                replace: "decorators:[Endcord.Api.MemberListDecorators.__getDecorators(arguments[0],'dm'),$1]"
            }
        }
    ]
});
