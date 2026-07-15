/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Message } from "@endcord/discord-types";
import { getIntlMessage } from "@utils/discord";
import { classes } from "@utils/misc";
import { findCssClassesLazy } from "@webpack";
import { Tooltip, UserStore } from "@webpack/common";

import { settings } from "./settings";
import { useFormattedPronouns } from "./utils";

const TimestampClasses = findCssClassesLazy("timestampInline", "timestamp");
const MessageDisplayCompact = getUserSettingLazy("textAndImages", "messageDisplayCompact")!;

const AUTO_MODERATION_ACTION = 24;

function shouldShow(message: Message): boolean {
    if (message.author.bot || message.author.system || message.type === AUTO_MODERATION_ACTION)
        return false;
    if (!settings.store.showSelf && message.author.id === UserStore.getCurrentUser().id)
        return false;

    return true;
}

function PronounsChatComponent({ message }: { message: Message; }) {
    const pronouns = useFormattedPronouns(message.author.id);

    return pronouns && (
        <Tooltip text={getIntlMessage("USER_PROFILE_PRONOUNS")}>
            {tooltipProps => (
                <span
                    {...tooltipProps}
                    className={classes(TimestampClasses.timestampInline, TimestampClasses.timestamp)}
                >• {pronouns}</span>
            )}
        </Tooltip>
    );
}

export const PronounsChatComponentWrapper = ErrorBoundary.wrap(({ message }: { message: Message; }) => {
    return shouldShow(message)
        ? <PronounsChatComponent message={message} />
        : null;
}, { noop: true });

export const CompactPronounsChatComponentWrapper = ErrorBoundary.wrap(({ message }: { message: Message; }) => {
    const compact = MessageDisplayCompact.useSetting();

    if (!compact || !shouldShow(message)) {
        return null;
    }

    return <PronounsChatComponent message={message} />;
}, { noop: true });
