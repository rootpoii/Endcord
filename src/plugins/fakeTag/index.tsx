/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { EndcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, React, UserStore } from "@webpack/common";

const DS_BADGE_KEY = "FakeTag_badgeDataUrl";

let originalGetCurrentUser: (() => ReturnType<typeof UserStore.getCurrentUser>) | null = null;
let originalGetUser: ((id: string) => ReturnType<typeof UserStore.getUser>) | null = null;
let cachedBadgeUrl: string = "";

async function loadBadge() {
    const stored = await dsGet<string>(DS_BADGE_KEY);
    cachedBadgeUrl = stored ?? "";
}

async function saveBadge(url: string) {
    cachedBadgeUrl = url;
    await dsSet(DS_BADGE_KEY, url);
}

function buildFakePrimaryGuild() {
    const { tag } = settings.store;
    if (!tag.trim()) return null;
    const badge = cachedBadgeUrl || settings.store.badgeUrl.trim() || null;
    return {
        tag: tag.trim().slice(0, 5).toUpperCase(),
        badge,
        identityEnabled: true,
        identityGuildId: "0",
    };
}

function wrapUser(user: any) {
    const fake = buildFakePrimaryGuild();
    if (!fake) return user;
    const wrapped = Object.create(Object.getPrototypeOf(user));
    for (const key of Object.getOwnPropertyNames(user)) {
        const desc = Object.getOwnPropertyDescriptor(user, key);
        if (desc) Object.defineProperty(wrapped, key, desc);
    }
    wrapped.primaryGuild = fake;
    return wrapped;
}

function getMyId() {
    return originalGetCurrentUser?.()?.id ?? UserStore.getCurrentUser()?.id;
}

function applyPatch() {
    if (originalGetCurrentUser) return;
    originalGetCurrentUser = UserStore.getCurrentUser.bind(UserStore);
    originalGetUser = (UserStore as any).getUser.bind(UserStore);

    (UserStore as any).getCurrentUser = function () {
        const user = originalGetCurrentUser!();
        if (!user) return user;
        return wrapUser(user);
    };

    (UserStore as any).getUser = function (id: string) {
        const user = originalGetUser!(id);
        if (!user || id !== getMyId()) return user;
        return wrapUser(user);
    };

    notifyUpdate();
}

function removePatch() {
    if (!originalGetCurrentUser) return;
    (UserStore as any).getCurrentUser = originalGetCurrentUser;
    (UserStore as any).getUser = originalGetUser;
    originalGetCurrentUser = null;
    originalGetUser = null;
    notifyUpdate();
}

function notifyUpdate() {
    try {
        const me = originalGetCurrentUser?.() ?? UserStore.getCurrentUser();
        if (me) FluxDispatcher.dispatch({ type: "USER_UPDATE", user: me });
    } catch { }
}

function BadgeUploader() {
    const [preview, setPreview] = React.useState<string>(cachedBadgeUrl);
    const inputRef = React.useRef<HTMLInputElement>(null);

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            const dataUrl = ev.target?.result as string;
            await saveBadge(dataUrl);
            setPreview(dataUrl);
            if (settings.store.enabled) notifyUpdate();
        };
        reader.readAsDataURL(file);
    }

    async function clear() {
        await saveBadge("");
        setPreview("");
        if (inputRef.current) inputRef.current.value = "";
        if (settings.store.enabled) notifyUpdate();
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--header-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Badge Image
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {preview && (
                    <img
                        src={preview}
                        alt="badge preview"
                        style={{ width: 32, height: 32, borderRadius: 4, objectFit: "contain", background: "var(--background-secondary)", flexShrink: 0 }}
                    />
                )}
                <button
                    style={{
                        padding: "6px 14px", borderRadius: 4, border: "none", cursor: "pointer",
                        background: "var(--brand-500)", color: "#fff", fontSize: 13, fontWeight: 600,
                    }}
                    onClick={() => inputRef.current?.click()}
                >
                    {preview ? "Change image" : "Upload image"}
                </button>
                {preview && (
                    <button
                        style={{
                            padding: "6px 14px", borderRadius: 4, border: "none", cursor: "pointer",
                            background: "var(--background-secondary)", color: "var(--text-normal)", fontSize: 13,
                        }}
                        onClick={clear}
                    >
                        Remove
                    </button>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFile}
                />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Or paste a URL in the field below — uploaded image takes priority.
            </div>
        </div>
    );
}

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Show the fake tag next to your name.",
        default: false,
        onChange(v: boolean) {
            if (v) applyPatch(); else removePatch();
        },
    },
    tag: {
        type: OptionType.STRING,
        description: "Tag text (up to 5 chars, auto-uppercased).",
        default: "MALL",
        onChange() {
            if (settings.store.enabled) notifyUpdate();
        },
    },
    _badgeUploader: {
        type: OptionType.COMPONENT,
        description: "",
        component: BadgeUploader,
    },
    badgeUrl: {
        type: OptionType.STRING,
        description: "Badge image URL (e.g. https://cdn.discordapp.com/emojis/ID.png). Ignored if an image is uploaded above.",
        default: "",
        onChange() {
            if (settings.store.enabled) notifyUpdate();
        },
    },
});

export default definePlugin({
    name: "FakeTag",
    description: "Adds a fake clan tag and badge emoji next to your username. Client-side only.",
    tags: ["Customisation", "Fun"],
    authors: [EndcordDevs.Sharp],
    settings,

    async start() {
        await loadBadge();
        if (settings.store.enabled) applyPatch();
    },

    stop() {
        removePatch();
    },
});
