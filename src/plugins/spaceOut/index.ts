/*
 * Endcord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 unfamiliardev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findOption, RequiredMessageOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SpaceOut",
    description: "/spaceout p u t s   s p a c e s   between every letter.",
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "spaceout",
            description: "Space out every letter",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "").split("").join(" ")
            })
        }
    ]
});
