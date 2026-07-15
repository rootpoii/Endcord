/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoDevtoolsWarning",
    description: "Disables the 'HOLD UP' banner in the console. As a side effect, also prevents Discord from hiding your token, which prevents random logouts.",
    authors: [Devs.Ven],
    tags: ["Developers", "Console"],
    patches: [{
        find: "setDevtoolsCallbacks",
        replacement: {
            match: /if\(null!=\i&&"0.0.0"===\i\.app\.getVersion\(\)\)/,
            replace: "if(true)"
        }
    }]
});
