/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, SelectedChannelStore } from "@webpack/common";

const timers = {} as Record<string, {
    timeout?: NodeJS.Timeout;
    i: number;
}>;

export default definePlugin({
    name: "VoiceChatDoubleClick",
    description: "Join voice chats via double click instead of single click",
    tags: ["Voice"],
    authors: [Devs.Ven, Devs.D3SOX],
    patches: [
        // Stage Channels & Voice Channels
        // the find is for stage channels, but it also handles voice
        // channels because they're both in the same concatenated module
        // the find for voice channels was `.handleVoiceStatusClick`
        {
            find: ".handleClickChat",
            // hack: these are not React onClick, it is a custom prop handled by Discord
            // thus, replacing this with onDoubleClick won't work, and you also cannot check
            // e.detail since instead of the event they pass the channel.
            // do this timer workaround instead
            replacement: [
                {
                    match: /onClick:\(\)=>\{this.handleClick\(\)/g,
                    replace: "onClick:()=>{$self.schedule(()=>{this.handleClick()},this)",
                },
            ]
        },
        {
            // channel mentions
            find: 'className:"channelMention",children:[null!=',
            replacement: {
                match: /onClick:(\i)(?=,.{0,30}className:"channelMention".+?(\i)\.inContent)/,
                replace: (_, onClick, props) => ""
                    + `onClick:(vcDoubleClickEvt)=>$self.shouldRunOnClick(vcDoubleClickEvt,${props})&&${onClick}()`,
            }
        }
    ],

    shouldRunOnClick(e: MouseEvent, { channelId }) {
        const channel = ChannelStore.getChannel(channelId);
        if (!channel || ![2, 13].includes(channel.type)) return true;
        return e.detail >= 2;
    },

    schedule(cb: () => void, e: any) {
        const id = e.props.channel.id as string;
        if (SelectedChannelStore.getVoiceChannelId() === id) {
            cb();
            return;
        }
        // use a different counter for each channel
        const data = (timers[id] ??= { timeout: void 0, i: 0 });
        // clear any existing timer
        clearTimeout(data.timeout);

        // if we already have 2 or more clicks, run the callback immediately
        if (++data.i >= 2) {
            cb();
            delete timers[id];
        } else {
            // else reset the counter in 500ms
            data.timeout = setTimeout(() => {
                delete timers[id];
            }, 500);
        }
    }
});
