/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, registerCommand, sendBotMessage } from "@api/Commands";
import { migratePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import { FluxDispatcher, MessageActions, PendingReplyStore } from "@webpack/common";

import { openCreateTagModal } from "./CreateTagModal";
import { getTag, getTags, removeTag, settings, Tag } from "./settings";

const CustomCommandsMarker = Symbol("CustomCommands");
const ArgumentRegex = /{{(.+?)}}/g;

export function parseTagArguments(message: string) {
    const args = [] as { name: string, defaultValue: string | null; }[];

    for (const [, value] of message.matchAll(ArgumentRegex)) {
        const [name, defaultValue] = value.split("=").map(s => s.trim());

        if (!name) continue;
        if (args.some(arg => arg.name === name)) continue;

        args.push({ name: name.toLowerCase(), defaultValue: defaultValue ?? null });
    }

    return args;
}

export function registerTagCommand(tag: Tag) {
    const tagArguments = parseTagArguments(tag.message);

    registerCommand({
        name: tag.name,
        description: tag.name,
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [
            ...tagArguments.map(arg => ({
                name: arg.name,
                description: arg.name,
                type: ApplicationCommandOptionType.STRING,
                required: arg.defaultValue === null
            })),
            {
                name: "ephemeral",
                description: "Whether the response should only be visible to you",
                type: ApplicationCommandOptionType.BOOLEAN,
                required: false
            }
        ],

        execute: async (args, { channel }) => {
            const ephemeral = findOption(args, "ephemeral", false);

            const response = tag.message
                .replace(ArgumentRegex, (fullMatch, value: string) => {
                    const [argName, defaultValue] = value.split("=").map(s => s.trim());
                    return findOption(args, argName, null) ?? defaultValue ?? fullMatch;
                })
                .replaceAll("\\n", "\n");

            const doSend = ephemeral ? sendBotMessage : sendMessage;
            doSend(channel.id, { content: response }, false, MessageActions.getSendMessageOptionsForReply(PendingReplyStore.getPendingReply(channel.id)));
            FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId: channel.id });
        },
        [CustomCommandsMarker]: true,
    }, "CustomCommands");
}


migratePluginSettings("CustomCommands", "MessageTags");
export default definePlugin({
    name: "CustomCommands",
    description: "Allows you to create custom slash commands / tags",
    searchTerms: ["MessageTags"],
    authors: [Devs.Ven, Devs.Luna,],
    tags: ["Commands", "Customisation", "Utility"],
    settings,

    async start() {
        const tags = getTags();
        for (const tagName in tags) {
            registerTagCommand(tags[tagName]);
        }
    },

    commands: [
        {
            name: "tags",
            description: "Manage all custom commands",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "create",
                    description: "Create a new tag",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                },
                {
                    name: "list",
                    description: "List all your tags",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: []
                },
                {
                    name: "delete",
                    description: "Remove a tag by name",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "tag-name",
                            description: "The name of the tag",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                },
            ],

            async execute(args, ctx) {
                switch (args[0].name) {
                    case "create": {
                        openCreateTagModal();
                        break;
                    }

                    case "delete": {
                        const name: string = findOption(args[0].options, "tag-name", "");

                        if (!getTag(name))
                            return sendBotMessage(ctx.channel.id, {
                                content: `A Tag with the name **${name}** does not exist!`
                            });

                        removeTag(name);

                        sendBotMessage(ctx.channel.id, {
                            content: `Successfully deleted the tag **${name}**!`
                        });

                        break;
                    }

                    case "list": {
                        const content = Object.values(getTags())
                            .map(tag => `\`${tag.name}\`: ${tag.message.slice(0, 72).replaceAll("\\n", " ")}${tag.message.length > 72 ? "..." : ""}`)
                            .join("\n");

                        sendBotMessage(ctx.channel.id, {
                            content: content || "Woops! There are no tags yet, use `/tags create` to create one!",
                        });

                        break;
                    }
                }
            }
        }
    ]
});
