/*
 * Endcord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 unfamiliardev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findOption, RequiredMessageOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ReverseText",
    description: "/reverse flips your message backwards.",
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "reverse",
            description: "Reverse your text",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: [...findOption(opts, "message", "")].reverse().join("")
            })
        }
    ]
});
