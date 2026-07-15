/*
 * Endcord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 Dann
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findOption, RequiredMessageOption, sendBotMessage } from "@api/Commands";
import { EndcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "Calculator",
    description: "/calc does quick maths right in the chat box.",
    authors: [EndcordDevs.Dann],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "calc",
            description: "Evaluate a maths expression (+ - * / % and parentheses)",
            options: [RequiredMessageOption],
            execute: (opts, ctx) => {
                const expr = findOption(opts, "message", "");
                if (!/^[\d\s+\-*/().%]+$/.test(expr)) {
                    sendBotMessage(ctx.channel.id, { content: "Only numbers and + - * / % ( ) are allowed." });
                    return;
                }
                try {
                    // expression is whitelisted to maths characters above
                    const result = Function(`"use strict";return(${expr})`)();
                    if (typeof result !== "number" || !isFinite(result)) throw new Error();
                    return { content: `\`${expr.trim()}\` = **${result}**` };
                } catch {
                    sendBotMessage(ctx.channel.id, { content: "Couldn't work that one out." });
                }
            }
        }
    ]
});
