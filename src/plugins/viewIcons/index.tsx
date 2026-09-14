/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { ImageIcon } from "@components/Icons";
import type { Channel, Guild, User } from "@endcord/discord-types";
import { Devs } from "@utils/constants";
import { copyWithToast, openImageModal } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { ContextMenuApi, GuildMemberStore, IconUtils, Menu, React, UserProfileStore } from "@webpack/common";

interface UserContextProps {
    channel: Channel;
    guildId?: string;
    user: User;
}

interface GuildContextProps {
    guild?: Guild;
}

interface GroupDMContextProps {
    channel: Channel;
}

const settings = definePluginSettings({
    format: {
        type: OptionType.SELECT,
        description: "Choose the image format to use for non animated images. Animated images will always use .gif",
        options: [
            {
                label: "png",
                value: "png",
                default: true
            },
            {
                label: "webp",
                value: "webp"
            },
            {
                label: "jpg",
                value: "jpg"
            }
        ]
    },
    imgSize: {
        type: OptionType.SELECT,
        displayName: "Image Size",
        description: "The image size to use",
        options: ["256", "512", "1024", "2048", "4096"].map(n => ({ label: n, value: n, default: n === "2048" }))
    }
});

function downloadImage(url: string, name: string) {
    try {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.target = "_blank";
        a.rel = "noreferrer noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch {
        window.open(url, "_blank");
    }
}

function getFullSizeUrl(url: string, defaultExt = "png"): string {
    if (!url) return "";
    try {
        const u = new URL(url, window.location.href);
        const isAnimated = u.searchParams.get("animated") === "true" || u.pathname.includes("/a_");
        const ext = isAnimated ? "gif" : defaultExt;
        u.pathname = u.pathname.replace(/\.(png|jpe?g|webp)$/i, `.${ext}`);
        u.searchParams.set("size", "4096");
        return u.toString();
    } catch {
        return url;
    }
}

function getBannerUrl(user: User, guildId?: string): string | null {
    if (!user) return null;
    const profile = UserProfileStore?.getUserProfile?.(user.id);
    const bannerHash = profile?.banner || (user as any).banner;
    if (bannerHash) {
        if (typeof bannerHash === "string" && (bannerHash.startsWith("http") || bannerHash.startsWith("data:"))) return bannerHash;
        const isAnimated = typeof bannerHash === "string" && bannerHash.startsWith("a_");
        return `https://cdn.discordapp.com/banners/${user.id}/${bannerHash}.${isAnimated ? "gif" : "png"}?size=4096`;
    }
    return null;
}

function getGuildMemberBannerUrl(userId: string, guildId?: string): string | null {
    if (!userId || !guildId) return null;
    const member = GuildMemberStore?.getMember(guildId, userId);
    const bannerHash = (member as any)?.banner;
    if (bannerHash) {
        if (typeof bannerHash === "string" && (bannerHash.startsWith("http") || bannerHash.startsWith("data:"))) return bannerHash;
        const isAnimated = typeof bannerHash === "string" && bannerHash.startsWith("a_");
        return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/banners/${bannerHash}.${isAnimated ? "gif" : "png"}?size=4096`;
    }
    return null;
}

const openAvatar = (url: string) => openImage(url, 512, 512);
const openBanner = (url: string) => openImage(url, 1024);

function openImage(url: string, width: number, height?: number) {
    if (!url) return;
    try {
        const u = new URL(url, window.location.href);

        const format = url.startsWith("/")
            ? "png"
            : u.searchParams.get("animated") === "true"
                ? "gif"
                : settings.store.format;

        u.searchParams.set("size", settings.store.imgSize);
        u.pathname = u.pathname.replace(/\.(png|jpe?g|webp)$/i, `.${format}`);
        const finalUrl = u.toString();

        u.searchParams.set("size", "4096");
        const original = u.toString();

        try {
            openImageModal({
                url: finalUrl,
                original,
                width,
                height
            });
        } catch {
            window.open(original, "_blank");
        }
    } catch {
        window.open(url, "_blank");
    }
}

const UserContext: NavContextMenuPatchCallback = (children, { user, guildId }: UserContextProps) => {
    if (!user) return;
    const avatarUrl = IconUtils.getUserAvatarURL(user, true);
    const memberAvatar = guildId ? GuildMemberStore.getMember(guildId, user.id)?.avatar || null : null;
    const serverAvatarUrl = memberAvatar
        ? IconUtils.getGuildMemberAvatarURLSimple({
            userId: user.id,
            avatar: memberAvatar,
            guildId: guildId!,
            canAnimate: true
        })
        : null;

    const bannerUrl = getBannerUrl(user, guildId);
    const serverBannerUrl = getGuildMemberBannerUrl(user.id, guildId);

    const items = [];

    // Avatar
    items.push(
        <Menu.MenuItem
            id="view-avatar-menu"
            label="Avatar"
            action={() => openAvatar(avatarUrl)}
            icon={ImageIcon}
        >
            <Menu.MenuItem
                id="view-avatar"
                label="View Avatar"
                action={() => openAvatar(avatarUrl)}
            />
            <Menu.MenuItem
                id="copy-avatar-url"
                label="Copy Avatar Link"
                action={() => copyWithToast(getFullSizeUrl(avatarUrl), "Avatar link copied!")}
            />
            <Menu.MenuItem
                id="save-avatar"
                label="Save Avatar"
                action={() => downloadImage(getFullSizeUrl(avatarUrl), `${user.username}_avatar`)}
            />
        </Menu.MenuItem>
    );

    // Server Avatar
    if (serverAvatarUrl) {
        items.push(
            <Menu.MenuItem
                id="view-server-avatar-menu"
                label="Server Avatar"
                action={() => openAvatar(serverAvatarUrl)}
                icon={ImageIcon}
            >
                <Menu.MenuItem
                    id="view-server-avatar"
                    label="View Server Avatar"
                    action={() => openAvatar(serverAvatarUrl)}
                />
                <Menu.MenuItem
                    id="copy-server-avatar-url"
                    label="Copy Server Avatar Link"
                    action={() => copyWithToast(getFullSizeUrl(serverAvatarUrl), "Server avatar link copied!")}
                />
                <Menu.MenuItem
                    id="save-server-avatar"
                    label="Save Server Avatar"
                    action={() => downloadImage(getFullSizeUrl(serverAvatarUrl), `${user.username}_server_avatar`)}
                />
            </Menu.MenuItem>
        );
    }

    // User Banner
    if (bannerUrl) {
        items.push(
            <Menu.MenuItem
                id="view-banner-menu"
                label="Banner"
                action={() => openBanner(bannerUrl)}
                icon={ImageIcon}
            >
                <Menu.MenuItem
                    id="view-banner"
                    label="View Banner"
                    action={() => openBanner(bannerUrl)}
                />
                <Menu.MenuItem
                    id="copy-banner-url"
                    label="Copy Banner Link"
                    action={() => copyWithToast(getFullSizeUrl(bannerUrl), "Banner link copied!")}
                />
                <Menu.MenuItem
                    id="save-banner"
                    label="Save Banner"
                    action={() => downloadImage(getFullSizeUrl(bannerUrl), `${user.username}_banner`)}
                />
            </Menu.MenuItem>
        );
    }

    // Server Banner
    if (serverBannerUrl) {
        items.push(
            <Menu.MenuItem
                id="view-server-banner-menu"
                label="Server Banner"
                action={() => openBanner(serverBannerUrl)}
                icon={ImageIcon}
            >
                <Menu.MenuItem
                    id="view-server-banner"
                    label="View Server Banner"
                    action={() => openBanner(serverBannerUrl)}
                />
                <Menu.MenuItem
                    id="copy-server-banner-url"
                    label="Copy Server Banner Link"
                    action={() => copyWithToast(getFullSizeUrl(serverBannerUrl), "Server banner link copied!")}
                />
                <Menu.MenuItem
                    id="save-server-banner"
                    label="Save Server Banner"
                    action={() => downloadImage(getFullSizeUrl(serverBannerUrl), `${user.username}_server_banner`)}
                />
            </Menu.MenuItem>
        );
    }

    children.splice(-1, 0, <Menu.MenuGroup>{items}</Menu.MenuGroup>);
};

const GuildContext: NavContextMenuPatchCallback = (children, { guild }: GuildContextProps) => {
    if (!guild) return;

    const { id, icon, banner, splash } = guild;
    if (!banner && !icon && !splash) return;

    const items = [];

    if (icon) {
        const iconUrl = IconUtils.getGuildIconURL({ id, icon, canAnimate: true })!;
        items.push(
            <Menu.MenuItem
                id="view-guild-icon-menu"
                label="Server Icon"
                action={() => openAvatar(iconUrl)}
                icon={ImageIcon}
            >
                <Menu.MenuItem
                    id="view-guild-icon"
                    label="View Icon"
                    action={() => openAvatar(iconUrl)}
                />
                <Menu.MenuItem
                    id="copy-guild-icon-url"
                    label="Copy Icon Link"
                    action={() => copyWithToast(getFullSizeUrl(iconUrl), "Server icon link copied!")}
                />
                <Menu.MenuItem
                    id="save-guild-icon"
                    label="Save Icon"
                    action={() => downloadImage(getFullSizeUrl(iconUrl), `${guild.name}_icon`)}
                />
            </Menu.MenuItem>
        );
    }

    if (banner) {
        const bannerUrl = IconUtils.getGuildBannerURL(guild, true)!;
        items.push(
            <Menu.MenuItem
                id="view-guild-banner-menu"
                label="Server Banner"
                action={() => openBanner(bannerUrl)}
                icon={ImageIcon}
            >
                <Menu.MenuItem
                    id="view-guild-banner"
                    label="View Banner"
                    action={() => openBanner(bannerUrl)}
                />
                <Menu.MenuItem
                    id="copy-guild-banner-url"
                    label="Copy Banner Link"
                    action={() => copyWithToast(getFullSizeUrl(bannerUrl), "Server banner link copied!")}
                />
                <Menu.MenuItem
                    id="save-guild-banner"
                    label="Save Banner"
                    action={() => downloadImage(getFullSizeUrl(bannerUrl), `${guild.name}_banner`)}
                />
            </Menu.MenuItem>
        );
    }

    if (splash) {
        const splashUrl = `https://cdn.discordapp.com/splashes/${id}/${splash}.png?size=4096`;
        items.push(
            <Menu.MenuItem
                id="view-guild-splash-menu"
                label="Server Splash"
                action={() => openBanner(splashUrl)}
                icon={ImageIcon}
            >
                <Menu.MenuItem
                    id="view-guild-splash"
                    label="View Splash"
                    action={() => openBanner(splashUrl)}
                />
                <Menu.MenuItem
                    id="copy-guild-splash-url"
                    label="Copy Splash Link"
                    action={() => copyWithToast(splashUrl, "Server splash link copied!")}
                />
                <Menu.MenuItem
                    id="save-guild-splash"
                    label="Save Splash"
                    action={() => downloadImage(splashUrl, `${guild.name}_splash`)}
                />
            </Menu.MenuItem>
        );
    }

    children.splice(-1, 0, <Menu.MenuGroup>{items}</Menu.MenuGroup>);
};

const GroupDMContext: NavContextMenuPatchCallback = (children, { channel }: GroupDMContextProps) => {
    if (!channel) return;
    const iconUrl = IconUtils.getChannelIconURL(channel);
    if (!iconUrl) return;

    children.splice(-1, 0, (
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="view-group-channel-icon-menu"
                label="Group Icon"
                action={() => openAvatar(iconUrl)}
                icon={ImageIcon}
            >
                <Menu.MenuItem
                    id="view-group-icon"
                    label="View Icon"
                    action={() => openAvatar(iconUrl)}
                />
                <Menu.MenuItem
                    id="copy-group-icon-url"
                    label="Copy Icon Link"
                    action={() => copyWithToast(getFullSizeUrl(iconUrl), "Group icon link copied!")}
                />
                <Menu.MenuItem
                    id="save-group-icon"
                    label="Save Icon"
                    action={() => downloadImage(getFullSizeUrl(iconUrl), `${channel.name || "group"}_icon`)}
                />
            </Menu.MenuItem>
        </Menu.MenuGroup>
    ));
};

function openAvatarContextMenu(e: React.MouseEvent, avatarUrl: string) {
    if (!avatarUrl) return;
    e.preventDefault();
    e.stopPropagation();
    const fullUrl = getFullSizeUrl(avatarUrl);
    ContextMenuApi.openContextMenu(e, () => (
        <Menu.Menu navId="vc-viewicons-avatar-context" onClose={ContextMenuApi.closeContextMenu} aria-label="Avatar Options">
            <Menu.MenuItem
                id="viewicons-view-avatar"
                label="View Avatar"
                action={() => openAvatar(avatarUrl)}
            />
            <Menu.MenuItem
                id="viewicons-copy-avatar-url"
                label="Copy Avatar Link"
                action={() => copyWithToast(fullUrl, "Avatar link copied!")}
            />
            <Menu.MenuItem
                id="viewicons-save-avatar"
                label="Save Avatar"
                action={() => downloadImage(fullUrl, "avatar")}
            />
        </Menu.Menu>
    ));
}

function openBannerContextMenu(e: React.MouseEvent, bannerUrl: string) {
    if (!bannerUrl) return;
    e.preventDefault();
    e.stopPropagation();
    const fullUrl = getFullSizeUrl(bannerUrl);
    ContextMenuApi.openContextMenu(e, () => (
        <Menu.Menu navId="vc-viewicons-banner-context" onClose={ContextMenuApi.closeContextMenu} aria-label="Banner Options">
            <Menu.MenuItem
                id="viewicons-view-banner"
                label="View Banner"
                action={() => openBanner(bannerUrl)}
            />
            <Menu.MenuItem
                id="viewicons-copy-banner-url"
                label="Copy Banner Link"
                action={() => copyWithToast(fullUrl, "Banner link copied!")}
            />
            <Menu.MenuItem
                id="viewicons-save-banner"
                label="Save Banner"
                action={() => downloadImage(fullUrl, "banner")}
            />
        </Menu.Menu>
    ));
}

export default definePlugin({
    name: "ViewIcons",
    authors: [Devs.Ven, Devs.TheKodeToad, Devs.Nuckyz, Devs.nyx],
    description: "Makes avatars and banners in user profiles clickable, adds View/Copy/Save Icon and Banner entries in user, server and group channel context menus.",
    tags: ["Media", "Servers", "Appearance"],
    searchTerms: ["ImageUtilities"],
    dependencies: ["DynamicImageModalAPI"],

    settings,

    openAvatar,
    openBanner,
    openAvatarContextMenu,
    openBannerContextMenu,

    contextMenus: {
        "user-context": UserContext,
        "guild-context": GuildContext,
        "gdm-context": GroupDMContext
    },

    patches: [
        // Avatar component used in User DMs "User Profile" popup in the right and User Profile Modal pfp
        {
            find: "return{avatarProps:{",
            replacement: {
                match: /(?<=avatarProps:(\i),eventHandlers:(\i).{0,50}?)return null==/,
                replace: 'Object.assign($2,{style:{cursor:"pointer"},onClick:()=>$self.openAvatar($1.src),onContextMenu:e=>$self.openAvatarContextMenu(e,$1.src)});$&',
            }
        },
        // Banners
        {
            find: 'backgroundColor:"COMPLETE"',
            replacement: {
                match: /(overflow:"visible",.{0,125}?!1\),)style:{(?=.+?backgroundImage:null!=(\i)\?`url\(\$\{\2\}\))/,
                replace: (_, rest, bannerSrc) => `${rest}onClick:()=>${bannerSrc}!=null&&$self.openBanner(${bannerSrc}),onContextMenu:e=>${bannerSrc}!=null&&$self.openBannerContextMenu(e,${bannerSrc}),style:{cursor:${bannerSrc}!=null?"pointer":void 0,`
            }
        },
        // Group DMs top small & large icon
        {
            find: '["aria-hidden"],"aria-label":',
            replacement: {
                match: /null==\i\.icon\?.+?src:(\(0,\i\.\i\).+?\))(?=[,}])/,
                // We have to check that icon is not an unread GDM in the server bar
                replace: (m, iconUrl) => `${m},onClick:()=>arguments[0]?.size!=="SIZE_48"&&$self.openAvatar(${iconUrl})`
            }
        },
        // User DMs top small icon
        {
            find: ".channel.getRecipientId(),",
            replacement: {
                match: /(?=,src:(\i.getAvatarURL\(.+?[)]))/,
                replace: (_, avatarUrl) => `,onClick:()=>$self.openAvatar(${avatarUrl})`
            }
        },
        // User Dms top large icon
        {
            find: ".EMPTY_GROUP_DM)",
            replacement: {
                match: /(?<=SIZE_80,)(?=src:(.+?\))[,}])/,
                replace: (_, avatarUrl) => `onClick:()=>$self.openAvatar(${avatarUrl}),`
            }
        }
    ]
});
