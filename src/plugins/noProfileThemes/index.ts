/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

export default definePlugin({
    name: "NoProfileThemes",
    description: "Completely removes Nitro profile themes from everyone but yourself",
    tags: ["Appearance"],
    authors: [Devs.TheKodeToad],
    patches: [
        {
            find: "hasThemeColors(){",
            replacement: {
                match: /get canUsePremiumProfileCustomization\(\){return /,
                replace: "$&$self.isCurrentUser(this?.userId)&&"
            }
        },
    ],

    isCurrentUser: (userId: string) => userId === UserStore.getCurrentUser()?.id,
});
