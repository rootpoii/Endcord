/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { MessageActions, MessageStore, SelectedChannelStore, UserStore } from "@webpack/common";

function onDoubleClick(e: MouseEvent) {
    const target = e.target as Element;

    // Don't trigger on interactive elements
    if (target.closest("a, button, [role='button'], input, textarea, [contenteditable]")) return;

    const messageEl = target.closest("[data-message-id]") as HTMLElement | null;
    if (!messageEl) return;

    const messageId = messageEl.dataset.messageId;
    if (!messageId) return;

    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;

    const me = UserStore.getCurrentUser()?.id;
    if (!me) return;

    const message = MessageStore.getMessage(channelId, messageId);
    if (!message || message.author.id !== me || !message.content) return;

    e.preventDefault();
    (MessageActions as any).startEditMessage(channelId, messageId, message.content);
}

export default definePlugin({
    name: "DoubleClickEdit",
    description: "Double-click your own messages to edit them instantly.",
    tags: ["Chat", "Utility"],
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],

    start() {
        document.addEventListener("dblclick", onDoubleClick);
    },

    stop() {
        document.removeEventListener("dblclick", onDoubleClick);
    },
});
