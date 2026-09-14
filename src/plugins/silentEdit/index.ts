/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const edited = new Set<string>();

function onMessageUpdate({ message }: any) {
    if (!message?.id || !message?.edited_timestamp) return;
    const me = (Endcord as any).Webpack?.findByStoreName?.("UserStore")?.getCurrentUser?.();
    if (me && message.author?.id === me.id) {
        edited.add(message.id);
        if (edited.size > 500) {
            const first = edited.values().next().value;
            if (first) edited.delete(first);
        }
    }
}

export default definePlugin({
    name: "SilentEdit",
    description: "Hides the '(edited)' label on your own edited messages. The message stays — nothing is deleted or resent.",
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    tags: ["Chat", "Utility"],

    patches: [
        {
            find: "#{intl::MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL}",
            replacement: {
                match: /(\i)\.edited_timestamp(?=.{0,300}MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL)/,
                replace: "($self.shouldHide(arguments[0]?.id) ? null : $1.edited_timestamp)",
            },
            noWarn: true,
        },
    ],

    start() {
        FluxDispatcher.subscribe("MESSAGE_UPDATE", onMessageUpdate);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_UPDATE", onMessageUpdate);
        edited.clear();
    },

    shouldHide(id: string): boolean {
        return edited.has(id);
    },
});
