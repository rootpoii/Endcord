/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./fixDiscordBadgePadding.css";

import { _getBadges, BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Devs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import definePlugin from "@utils/types";
import { ContextMenuApi, Forms, Menu, Modal, openModal, Toasts, UserStore } from "@webpack/common";

import { fetchAllEndcordProfiles, onEndcordProfile, queueEndcordProfile } from "./endcordProfileSync";

let DonorBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;

onEndcordProfile((uid, prof) => {
    if (!uid || !prof) return;
    const list = Array.isArray(prof) ? prof : (prof.badges || []);
    if (Array.isArray(list) && list.length > 0) DonorBadges[uid] = list;
    else delete DonorBadges[uid];
});

async function loadBadges(noCache = false) {
    const resJson = await fetchAllEndcordProfiles();
    if (!resJson) return;

    const data: Record<string, any> = {};
    for (const [uid, p] of Object.entries(resJson)) {
        data[uid] = Array.isArray(p) ? p : ((p as any)?.badges || []);
    }
    if (Object.keys(data).length > 0 || noCache) {
        DonorBadges = data;
    }
}

let intervalId: any;

function BadgeContextMenu({ badge }: { badge: Omit<ProfileBadge, "id"> & BadgeUserArgs; }) {
    return (
        <Menu.Menu
            navId="vc-badge-context"
            onClose={ContextMenuApi.closeContextMenu}
            aria-label="Badge Options"
        >
            {badge.description && (
                <Menu.MenuItem
                    id="vc-badge-copy-name"
                    label="Copy Badge Name"
                    action={() => copyWithToast(badge.description!)}
                />
            )}
            {badge.iconSrc && (
                <Menu.MenuItem
                    id="vc-badge-copy-link"
                    label="Copy Badge Image Link"
                    action={() => copyWithToast(badge.iconSrc!)}
                />
            )}
        </Menu.Menu>
    );
}

export default definePlugin({
    name: "BadgeAPI",
    description: "API to add badges to users",
    authors: [Devs.Megu, Devs.Ven, Devs.TheSun],
    required: true,
    patches: [
        {
            find: "#{intl::PROFILE_USER_BADGES}",
            replacement: [
                {
                    match: /alt:" ","aria-hidden":!0,src:.{0,50}(\i).iconSrc/,
                    replace: "...$1.props,$&"
                },
                // Path with 2026-04-badge-discovery OFF
                {
                    match: /(?<=forceOpen:.{0,40}?ariaHidden:!0,)children:(?=.{0,50}?(\i)\.id)/,
                    replace: "children:$1.component?$self.renderBadgeComponent({...$1}):"
                },
                // Path with 2026-04-badge-discovery ON
                {
                    match: /(?<=fallbackIconSrc:.{0,50}?)children:(?=.{0,50}?(\i)\.id)/,
                    replace: "children:$1.component?$self.renderBadgeComponent({...$1}):"
                },
                // handle onClick and onContextMenu
                {
                    match: /href:(\i)\.link/,
                    replace: "...$self.getBadgeMouseEventHandlers($1),$&"
                }
            ]
        },
        {
            find: "getLegacyUsername(){",
            replacement: {
                match: /getBadges\(\)\{(.{0,100}?)return\[(.{0,200}?)\]\}/,
                replace: "getBadges(){$1return $self.getFinalBadges(this, [$2])}"
            }
        }
    ],

    // for access from the console or other plugins
    get DonorBadges() {
        return DonorBadges;
    },

    set DonorBadges(val: any) {
        DonorBadges = val;
    },

    toolboxActions: {
        async "Refetch Badges"() {
            await loadBadges(true);
            Toasts.show({
                id: Toasts.genId(),
                message: "Successfully refetched badges!",
                type: Toasts.Type.SUCCESS
            });
        }
    },

    async start() {
        await loadBadges();

        clearInterval(intervalId);
        intervalId = setInterval(loadBadges, 5 * 60 * 1000);
    },

    async stop() {
        clearInterval(intervalId);
    },

    getBadges(profile: { userId: string; guildId: string; }) {
        if (!profile) return [];

        try {
            return _getBadges(profile);
        } catch (e) {
            new Logger("BadgeAPI#getBadges").error(e);
            return [];
        }
    },

    getFinalBadges(profile: any, allBadges: any[]) {
        if (!profile) return allBadges;
        const userId = profile.id || profile.userId || profile.user?.id;
        if (!userId) return allBadges;
        queueEndcordProfile(userId);

        const customBadges = DonorBadges[userId];
        const hasCustom = customBadges && Array.isArray(customBadges) && customBadges.length > 0;

        if (hasCustom) {
            const list = this.getDonorBadges(userId);
            const seen = new Set<string>();
            return list.filter(b => {
                const key = b.iconSrc || b.description;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        return allBadges;
    },

    renderBadgeComponent: ErrorBoundary.wrap((badge: ProfileBadge & BadgeUserArgs) => {
        const Component = badge.component!;
        return <Component {...badge} />;
    }, { noop: true }),


    getBadgeMouseEventHandlers(badge: ProfileBadge & BadgeUserArgs) {
        const handlers = {} as Record<string, (e: React.MouseEvent) => void>;

        if (!badge) return handlers; // sanity check

        const { onClick, onContextMenu } = badge;

        if (onClick) handlers.onClick = e => onClick(e, badge);
        if (onContextMenu) handlers.onContextMenu = e => onContextMenu(e, badge);

        return handlers;
    },

    getDonorBadges(userId: string) {
        if (userId) queueEndcordProfile(userId);
        const userBadges = DonorBadges[userId];
        if (!userBadges) return [];

        const list = Array.isArray(userBadges) ? userBadges : ((userBadges as any)?.badges || []);
        return list.map((badge: any, idx: number) => ({
            id: `endcord_donor_badge_${idx}`,
            iconSrc: badge.badge || badge.icon || badge.iconSrc,
            description: badge.tooltip || badge.description || "Endcord Supporter",
            position: BadgePosition.START,
            props: {
                style: {
                    background: "transparent",
                    backgroundColor: "transparent",
                    transform: "scale(1.05)"
                }
            },
            onContextMenu(event, badge) {
                ContextMenuApi.openContextMenu(event, () => <BadgeContextMenu badge={badge} />);
            }
        } satisfies ProfileBadge));
    }
});
