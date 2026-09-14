/*
 * Endcord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 unfamiliardev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

interface Reminder {
    text: string;
    time: number;
    channelId: string;
}

const KEY = "Endcord_reminders";
const UNITS: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
};

const timers = new Set<ReturnType<typeof setTimeout>>();

function fire(r: Reminder) {
    showNotification({
        title: "⏰ Reminder",
        body: r.text,
        onClick: () => { }
    });
}

async function schedule(r: Reminder) {
    const delay = r.time - Date.now();
    if (delay <= 0) { fire(r); return; }
    const id = setTimeout(async () => {
        fire(r);
        timers.delete(id);
        const list = (await DataStore.get<Reminder[]>(KEY)) ?? [];
        await DataStore.set(KEY, list.filter(x => x.time !== r.time || x.text !== r.text));
    }, delay);
    timers.add(id);
}

export default definePlugin({
    name: "RemindMe",
    description: "/remindme <amount> <m|h|d> <text> pings you with a desktop notification later. Survives restarts.",
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    dependencies: ["CommandsAPI"],

    async start() {
        const list = (await DataStore.get<Reminder[]>(KEY)) ?? [];
        const live = list.filter(r => r.time > Date.now() - 60_000);
        if (live.length !== list.length) await DataStore.set(KEY, live);
        live.forEach(schedule);
    },

    stop() {
        timers.forEach(clearTimeout);
        timers.clear();
    },

    commands: [
        {
            name: "remindme",
            description: "Set a reminder",
            inputType: ApplicationCommandInputType.BOT,
            options: [
                { name: "amount", description: "How many units from now", type: ApplicationCommandOptionType.INTEGER, required: true },
                {
                    name: "unit", description: "Unit of time", type: ApplicationCommandOptionType.STRING, required: true,
                    choices: [
                        { name: "minutes", value: "m", label: "minutes" },
                        { name: "hours", value: "h", label: "hours" },
                        { name: "days", value: "d", label: "days" }
                    ]
                },
                { name: "text", description: "What to remind you about", type: ApplicationCommandOptionType.STRING, required: true }
            ],
            execute: async (opts, ctx) => {
                const amount = findOption(opts, "amount", 0);
                const unit = findOption(opts, "unit", "m");
                const text = findOption(opts, "text", "");
                if (amount <= 0) {
                    sendBotMessage(ctx.channel.id, { content: "Give me a positive amount of time." });
                    return;
                }
                const reminder: Reminder = { text, time: Date.now() + amount * (UNITS[unit] ?? UNITS.m), channelId: ctx.channel.id };
                const list = (await DataStore.get<Reminder[]>(KEY)) ?? [];
                list.push(reminder);
                await DataStore.set(KEY, list);
                schedule(reminder);
                sendBotMessage(ctx.channel.id, { content: `⏰ Okay! I'll remind you about **${text}** <t:${Math.floor(reminder.time / 1000)}:R>.` });
            }
        }
    ]
});
