/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Guild, GuildMember, Role } from "@endcord/discord-types";
import { PermissionOverwriteType } from "@endcord/discord-types/enums";
import { classNameFactory } from "@utils/css";
import { extractAndLoadChunksLazy, findByPropsLazy } from "@webpack";
import { GuildRoleStore } from "@webpack/common";

import { PermissionsSortOrder, settings } from ".";

export const loadGetGuildPermissionSpecMap = extractAndLoadChunksLazy([".PRIMARY,badgeTooltipDelay:"]);
export const { getGuildPermissionSpecMap } = findByPropsLazy("getGuildPermissionSpecMap");

export const cl = classNameFactory("vc-permviewer-");

export function getSortedRolesForMember({ id: guildId }: Guild, member: GuildMember) {
    // The guild id is the @everyone role
    return GuildRoleStore
        .getSortedRoles(guildId)
        .filter(role => role.id === guildId || member.roles.includes(role.id));
}

export function sortUserRoles(roles: Role[]) {
    switch (settings.store.permissionsSortOrder) {
        case PermissionsSortOrder.HighestRole:
            return roles.sort((a, b) => b.position - a.position);
        case PermissionsSortOrder.LowestRole:
            return roles.sort((a, b) => a.position - b.position);
        default:
            return roles;
    }
}

export function sortPermissionOverwrites<T extends { id: string; type: number; }>(overwrites: T[], guildId: string) {
    const roles = GuildRoleStore.getRolesSnapshot(guildId);

    return overwrites.sort((a, b) => {
        if (a.type !== PermissionOverwriteType.ROLE || b.type !== PermissionOverwriteType.ROLE) return 0;

        const roleA = roles[a.id];
        const roleB = roles[b.id];

        return roleB.position - roleA.position;
    });
}
