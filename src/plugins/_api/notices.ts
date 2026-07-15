/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoticesAPI",
    description: "Fixes notices being automatically dismissed",
    authors: [Devs.Ven],
    required: true,
    patches: [
        {
            find: '"NoticeStore"',
            replacement: [
                {
                    match: /(?<=!1;)\i=null;(?=.{0,80}getPremiumSubscription\(\))/g,
                    replace: "if(Endcord.Api.Notices.currentNotice)return false;$&"
                },
                {
                    match: /(?<=,NOTICE_DISMISS:function\(\i\){)return null!=(\i)/,
                    replace: (m, notice) => `if(${notice}?.id=="EndcordNotice")return(${notice}=null,Endcord.Api.Notices.nextNotice(),true);${m}`
                }
            ]
        }
    ],
});
