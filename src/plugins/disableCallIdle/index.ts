/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "DisableCallIdle",
    description: "Disables automatically getting kicked from a DM voice call after 3 minutes and being moved to an AFK voice channel.",
    tags: ["Voice", "Utility"],
    authors: [Devs.Nuckyz],
    patches: [
        {
            find: "this.idleTimeout.start(",
            replacement: {
                match: /this\.idleTimeout\.(start|stop)/g,
                replace: "$self.noop"
            }
        },
        {
            find: "handleIdleUpdate(){",
            replacement: {
                match: "handleIdleUpdate(){",
                replace: "handleIdleUpdate(){return;"
            }
        }
    ],

    noop() { }
});
