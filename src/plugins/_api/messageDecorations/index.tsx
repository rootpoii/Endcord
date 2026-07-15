/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import managedStyle from "./style.css?managed";

export default definePlugin({
    name: "MessageDecorationsAPI",
    description: "API to add decorations to messages",
    authors: [Devs.TheSun],

    managedStyle,

    patches: [
        {
            find: "#{intl::GUILD_COMMUNICATION_DISABLED_ICON_TOOLTIP_BODY}",
            replacement: {
                match: /#{intl::GUILD_COMMUNICATION_DISABLED_BOTTOM_SHEET_TITLE}.+?renderPopout:.+?(?=\])/,
                replace: "$&,Endcord.Api.MessageDecorations.__addDecorationsToMessage(arguments[0])"
            }
        }
    ]
});
