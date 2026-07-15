/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel, CustomEmoji, Message } from "@endcord/discord-types";
import { Logger } from "@utils/Logger";
import { MessageStore } from "@webpack/common";
import type { Promisable } from "type-fest";

const MessageEventsLogger = new Logger("MessageEvents", "#e5c890");

export interface MessageObject {
    content: string,
    validNonShortcutEmojis: CustomEmoji[];
    invalidEmojis: any[];
    tts: boolean;
}

export interface SendMessageOptions {
    messageReference?: Message["messageReference"];
    allowedMentions?: {
        parse: string[];
        repliedUser: boolean;
    };
    location: string;
    stickerIds?: string[];
    alsoForwardToChannelId?: string;

    // If you end up using these, update their type
    scheduledTimestamp?: unknown;
    mediaMention?: unknown;
}

export interface SendMessageProps {
    hasStickers: boolean;
    hasAttachments: boolean;
    content: string;
    channel: Channel;
    type?: any;
    openWarningPopout: (props: any) => any;
}

export type MessageSendListener = (channelId: string, messageObj: MessageObject, options: SendMessageOptions, props: SendMessageProps) => Promisable<void | { cancel: boolean; }>;
export type MessageEditListener = (channelId: string, messageId: string, messageObj: MessageObject) => Promisable<void | { cancel: boolean; }>;

const sendListeners = new Set<MessageSendListener>();
const editListeners = new Set<MessageEditListener>();

export async function _handlePreSend(channelId: string, messageObj: MessageObject, options: SendMessageOptions, props: SendMessageProps) {
    for (const listener of sendListeners) {
        try {
            const result = await listener(channelId, messageObj, options, props);
            if (result?.cancel) {
                return true;
            }
        } catch (e) {
            MessageEventsLogger.error("MessageSendHandler: Listener encountered an unknown error\n", e);
        }
    }
    return false;
}

export async function _handlePreEdit(channelId: string, messageId: string, messageObj: MessageObject) {
    for (const listener of editListeners) {
        try {
            const result = await listener(channelId, messageId, messageObj);
            if (result?.cancel) {
                return true;
            }
        } catch (e) {
            MessageEventsLogger.error("MessageEditHandler: Listener encountered an unknown error\n", e);
        }
    }
    return false;
}

/**
 * Note: This event fires off before a message is sent, allowing you to edit the message.
 */
export function addMessagePreSendListener(listener: MessageSendListener) {
    sendListeners.add(listener);
    return listener;
}
/**
 * Note: This event fires off before a message's edit is applied, allowing you to further edit the message.
 */
export function addMessagePreEditListener(listener: MessageEditListener) {
    editListeners.add(listener);
    return listener;
}
export function removeMessagePreSendListener(listener: MessageSendListener) {
    return sendListeners.delete(listener);
}
export function removeMessagePreEditListener(listener: MessageEditListener) {
    return editListeners.delete(listener);
}


// Message clicks
export type MessageClickListener = (message: Message, channel: Channel, event: MouseEvent) => void;

const listeners = new Set<MessageClickListener>();

export function _handleClick(message: Message, channel: Channel, event: MouseEvent) {
    // message object may be outdated, so (try to) fetch latest one
    message = MessageStore.getMessage(channel.id, message.id) ?? message;
    for (const listener of listeners) {
        try {
            listener(message, channel, event);
        } catch (e) {
            MessageEventsLogger.error("MessageClickHandler: Listener encountered an unknown error\n", e);
        }
    }
}

export function addMessageClickListener(listener: MessageClickListener) {
    listeners.add(listener);
    return listener;
}

export function removeMessageClickListener(listener: MessageClickListener) {
    return listeners.delete(listener);
}
