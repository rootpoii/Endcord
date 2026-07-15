/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "MessageEventsAPI",
    description: "Api required by anything using message events.",
    authors: [Devs.Arjix, Devs.hunt, Devs.Ven],
    patches: [
        {
            find: "#{intl::EDIT_TEXTAREA_HELP}",
            replacement: {
                match: /(?<=,channel:\i,message:\i\}\)\.then\().+?(?=\i\.content!==this\.props\.message\.content&&\i\((.+?)\)\})/,
                replace: (match, args) => "" +
                    `async ${match}` +
                    `if(await Endcord.Api.MessageEvents._handlePreEdit(${args}))` +
                    "return Promise.resolve({shouldClear:false,shouldRefocus:true});"
            }
        },
        {
            find: ".handleSendMessage,onResize:",
            replacement: {
                // https://regex101.com/r/7iswuk/1
                match: /let (\i)=\i\.\i\.parse\((\i),.+?\.getSendMessageOptions\(\{.+?\}\)?;(?=.+?(\i)\.flags=)(?<=\)\(({.+?})\)\.then.+?)/,
                replace: (m, parsedMessage, channel, options, props) => m +
                    `if(await Endcord.Api.MessageEvents._handlePreSend(${channel}.id,${parsedMessage},${options},${props}))` +
                    "return{shouldClear:false,shouldRefocus:true};"
            }
        },
        {
            find: '("interactionUsernameProfile',
            replacement: {
                match: /let\{id:\i}=(\i),{id:\i}=(\i);return \i\.useCallback\((\i)=>\{/,
                replace: (m, message, channel, event) =>
                    `const vcMsg=${message},vcChan=${channel};${m}Endcord.Api.MessageEvents._handleClick(vcMsg,vcChan,${event});`
            }
        }
    ]
});
