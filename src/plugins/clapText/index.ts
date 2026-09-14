/*
 * Endcord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 unfamiliardev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findOption, RequiredMessageOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ClapText",
    description: "Adds /clap to 👏 put 👏 claps 👏 between 👏 your 👏 words.",
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "clap",
            description: "Put 👏 claps 👏 between 👏 words",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .join(" 👏 ")
            })
        }
    ]
});
