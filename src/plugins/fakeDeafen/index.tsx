/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { Devs } from "@utils/constants";
import definePlugin, { IconComponent } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, React, useState } from "@webpack/common";

const VoiceActions = findByPropsLazy("toggleSelfDeaf", "selectVoiceChannel");

let fakeDeafActive = false;

/**
 * Patch all active WebRTC connections so setSelfDeaf is a no-op.
 * This means Discord will NEVER actually cut local audio output,
 * even though gateway sends self_deaf: true.
 */
function patchConnections() {
    try {
        const engine = (MediaEngineStore as any).getMediaEngine?.();
        if (!engine) return;
        for (const conn of engine.connections ?? []) {
            if (!conn?.setSelfDeaf) continue;
            if (!conn.__fakeDeafOriginal) {
                conn.__fakeDeafOriginal = conn.setSelfDeaf.bind(conn);
                conn.setSelfDeaf = () => { /* blocked by FakeDeafen */ };
            }
        }
    } catch { }
}

/**
 * Restore all patched WebRTC connections.
 */
function unpatchConnections() {
    try {
        const engine = (MediaEngineStore as any).getMediaEngine?.();
        if (!engine) return;
        for (const conn of engine.connections ?? []) {
            if (!conn?.__fakeDeafOriginal) continue;
            conn.setSelfDeaf = conn.__fakeDeafOriginal;
            delete conn.__fakeDeafOriginal;
        }
    } catch { }
}

function setFakeDeaf(value: boolean) {
    fakeDeafActive = value;

    if (value) {
        // First: block the WebRTC engine from applying the deafen locally.
        // Then: send the gateway voice state update (self_deaf: true).
        // Result: Discord server + others see you as deafened; your local audio is unaffected.
        patchConnections();
        const isDeaf = (MediaEngineStore as any).isSelfDeaf?.() ?? false;
        if (!isDeaf) {
            VoiceActions.toggleSelfDeaf();
        }
    } else {
        // Remove patch first so the upcoming toggleSelfDeaf actually works.
        unpatchConnections();
        const isDeaf = (MediaEngineStore as any).isSelfDeaf?.() ?? false;
        if (isDeaf) {
            VoiceActions.toggleSelfDeaf();
        }
    }
}

const DeafenIcon: IconComponent = ({ height = 20, width = 20, className, style }) => (
    <svg width={width} height={height} className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.7 11H5C5 15.08 7.96 18.44 12 18.93V21H9V23H15V21H13V18.93C17.04 18.44 20 15.09 20 11H18.3C18.3 14.48 15.74 17.3 12 17.3C8.26 17.3 5.7 14.48 5.7 11H6.7Z" />
        <path d="M12 3C10.07 3 8.5 4.57 8.5 6.5V11C8.5 12.93 10.07 14.5 12 14.5C13.93 14.5 15.5 12.93 15.5 11V6.5C15.5 4.57 13.93 3 12 3Z" />
        <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

function FakeDeafenUserAreaButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [active, setActive] = useState(fakeDeafActive);

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : active ? "Disable Fake Deafen" : "Enable Fake Deafen (appear deafened)"}
            icon={<DeafenIcon className={iconForeground} style={{ color: active ? "var(--status-danger)" : "currentColor" }} />}
            role="switch"
            aria-checked={active}
            redGlow={active}
            plated={nameplate != null}
            onClick={() => {
                const next = !active;
                setFakeDeaf(next);
                setActive(next);
            }}
        />
    );
}

const FakeDeafenButton: ChatBarButtonFactory = () => {
    const [active, setActive] = useState(fakeDeafActive);

    return (
        <ChatBarButton
            tooltip={active ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            onClick={() => {
                const next = !active;
                setFakeDeaf(next);
                setActive(next);
            }}
            buttonProps={{
                style: { color: active ? "var(--status-danger)" : undefined }
            }}
        >
            <DeafenIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "FakeDeafen",
    description: "Makes others see you as deafened while you can still hear everything. Sends a real voice state update so the icon shows for everyone.",
    tags: ["Voice", "Fun"],
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    dependencies: ["ChatInputButtonAPI", "UserAreaAPI"],

    userAreaButton: {
        icon: (props: { className?: string; }) => <DeafenIcon {...props} />,
        render: FakeDeafenUserAreaButton
    },

    chatBarButton: {
        icon: DeafenIcon,
        render: FakeDeafenButton,
    },

    stop() {
        if (fakeDeafActive) setFakeDeaf(false);
        // Safety: always clean up patches even if state was inconsistent
        unpatchConnections();
    },
});
