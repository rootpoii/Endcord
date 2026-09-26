/*
 * Endcord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import SettingsPlugin from "@plugins/_core/settings";
import { detectClient } from "@plugins/_core/supportHelper";
import { gitHashShort } from "@shared/vencordUserAgent";
import { React } from "@webpack/common";
import { JSX } from "react";

import { ChromiumIcon, ClientIcon, DevBannerIcon, DiscordIcon, ElectronIcon, EquicordIcon, names, settings } from ".";

function getPlatformLabel() {
    if (IS_DEV) return "Dev";
    if (IS_WEB) return "Web";
    if (IS_VESKTOP) return "Vesktop";
    if (IS_STANDALONE) return "Standalone";
    return "Desktop";
}

export function makeDevBanner(state?: string): string | JSX.Element {
    try {
        return renderDevBanner(state);
    } catch (error) {
        console.error("[DiscordDevBanner] Failed to render banner", error);
        return "Endcord";
    }
}

function renderDevBanner(state?: string): string | JSX.Element {
    const env = window.GLOBAL_ENV ?? {};
    const releaseChannel = String(env.RELEASE_CHANNEL || "stable");
    const buildChannel = names[releaseChannel] || releaseChannel.charAt(0).toUpperCase() + releaseChannel.slice(1);
    const { chromiumVersion, electronVersion } = SettingsPlugin;
    const format = settings.store.format ?? "{devbannerIcon} {buildChannel} {buildNumber} ({buildHash}) | {endcordIcon} {endcordName} {endcordVersion} ({endcordHash})";
    const baseFormat = (state ?? format).replace(/\bEquicord\b/g, "Endcord");

    const clientInfo = detectClient();

    const replaced = baseFormat
        .replace(/{buildChannel}/g, buildChannel)
        .replace(/{buildNumber}/g, String(env.BUILD_NUMBER ?? ""))
        .replace(/{buildHash}/g, String(env.VERSION_HASH ?? "").slice(0, 9))
        .replace(/{endcordName}|{equicordName}/g, "Endcord")
        .replace(/{endcordVersion}|{equicordVersion}/g, VERSION)
        .replace(/{endcordHash}|{equicordHash}/g, gitHashShort)
        .replace(/{endcordPlatform}|{equicordPlatform}/g, getPlatformLabel())
        .replace(/{electronVersion}/g, electronVersion ?? "")
        .replace(/{chromiumVersion}/g, chromiumVersion ?? "")
        .replace(/{clientName}/g, clientInfo.name)
        .replace(/{clientVersion}/g, `v${clientInfo?.version ?? "0.0.0"}`)
        .replace(/{equibopHash}/g, clientInfo.shortHash ?? "Not Supported")
        .replace(/{equibopPlatform}/g, `v${clientInfo?.dev ? "Dev Build" : "Standalone"}`)
        .replace(/\\n|{newline}/g, "__NEWLINE__");

    if (!replaced.includes("__NEWLINE__") && !/{.*Icon}/.test(baseFormat)) {
        return replaced;
    }

    const parts = replaced.split(/({.*?}|__NEWLINE__)/).filter(Boolean).map((part, i) => {
        switch (part) {
            case "{discordIcon}":
                return <span key={`icon-discord-${i}`} className="vc-discord-dev-banner-icons"><DiscordIcon /></span>;
            case "{endcordIcon}":
            case "{equicordIcon}":
                return <span key={`icon-endcord-${i}`} className="vc-discord-dev-banner-icons"><EquicordIcon /></span>;
            case "{electronIcon}":
                return <span key={`icon-electron-${i}`} className="vc-discord-dev-banner-icons"><ElectronIcon /></span>;
            case "{chromiumIcon}":
                return <span key={`icon-chromium-${i}`} className="vc-discord-dev-banner-icons"><ChromiumIcon /></span>;
            case "{devbannerIcon}":
                return <span key={`icon-dev-${i}`} className="vc-discord-dev-banner-icons"><DevBannerIcon /></span>;
            case "{clientIcon}":
                return <span key={`icon-dev-${i}`} className="vc-discord-dev-banner-icons"><ClientIcon /></span>;
            case "__NEWLINE__":
                return <br key={`br-${i}`} />;
            default:
                return <React.Fragment key={`text-${i}`}>{part}</React.Fragment>;
        }
    });

    return <div style={{ display: "inline" }}>{parts}</div>;
}
