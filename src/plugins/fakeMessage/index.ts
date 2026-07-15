/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { EndcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

export default definePlugin({
    name: "FakeMessage",
    description: "Send a client-side fake message posed as any user via /fakemsg. Only you can see it.",
    tags: ["Chat", "Fun"],
    authors: [EndcordDevs.Sharp],
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "fakemsg",
            description: "Locally display a fake message as another user. Only you can see it.",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "user",
                    description: "The user to pose the message as.",
                    type: ApplicationCommandOptionType.USER,
                    required: true,
                },
                {
                    name: "message",
                    description: "The message content to display.",
                    type: ApplicationCommandOptionType.STRING,
                    required: true,
                },
            ],
            execute(args, ctx) {
                const userId: string = findOption(args, "user", "");
                const content: string = findOption(args, "message", "");
                const user = UserStore.getUser(userId);
                if (!user) {
                    sendBotMessage(ctx.channel.id, { content: "Could not find that user." });
                    return;
                }
                sendBotMessage(ctx.channel.id, { content, author: user });
            },
        },
    ],
});
