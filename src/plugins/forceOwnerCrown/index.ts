/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Channel, User } from "@endcord/discord-types";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { GuildStore } from "@webpack/common";

export default definePlugin({
    name: "ForceOwnerCrown",
    description: "Force the owner crown next to usernames even if the server is large.",
    authors: [Devs.D3SOX, Devs.Nickyux],
    tags: ["Roles", "Appearance", "Servers"],
    patches: [
        {
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: {
                match: /(?<=decorators:.{0,200}?isOwner:)\i/,
                replace: "$self.isGuildOwner(arguments[0])"
            }
        }
    ],
    isGuildOwner(props: { user: User, channel: Channel, isOwner: boolean, guildId?: string; }) {
        if (!props?.user?.id) return props.isOwner;
        if (props.channel?.type === 3 /* GROUP_DM */)
            return props.isOwner;

        // guild id is in props twice, fallback if the first is undefined
        const guildId = props.guildId ?? props.channel?.guild_id;
        const userId = props.user.id;

        return GuildStore.getGuild(guildId)?.ownerId === userId;
    },
});
