/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { EndcordDevs } from "@utils/constants";
import definePlugin, { IconComponent } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, React, useState } from "@webpack/common";

const VoiceActionsStore = findByPropsLazy("toggleSelfMute");

let fakeMuteActive = false;

/**
 * Patch all active WebRTC connections so setSelfMute is a no-op.
 * This means Discord will NEVER actually mute the local microphone stream,
 * even though gateway sends self_mute: true.
 */
function patchConnections() {
    try {
        const engine = (MediaEngineStore as any).getMediaEngine?.();
        if (!engine) return;
        for (const conn of engine.connections ?? []) {
            if (!conn?.setSelfMute) continue;
            if (!conn.__fakeMuteOriginal) {
                conn.__fakeMuteOriginal = conn.setSelfMute.bind(conn);
                conn.setSelfMute = () => { /* blocked by FakeMute */ };
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
            if (!conn?.__fakeMuteOriginal) continue;
            conn.setSelfMute = conn.__fakeMuteOriginal;
            delete conn.__fakeMuteOriginal;
        }
    } catch { }
}

function setFakeMute(value: boolean) {
    fakeMuteActive = value;

    if (value) {
        // First: block the WebRTC engine from muting the local mic stream.
        // Then: send the gateway voice state update (self_mute: true).
        // Result: Discord server + others see you as muted; your local mic is unaffected.
        patchConnections();
        const isMuted = (MediaEngineStore as any).isSelfMute?.() ?? false;
        if (!isMuted) {
            VoiceActionsStore.toggleSelfMute();
        }
    } else {
        // Remove patch first so the upcoming toggleSelfMute actually works.
        unpatchConnections();
        const isMuted = (MediaEngineStore as any).isSelfMute?.() ?? false;
        if (isMuted) {
            VoiceActionsStore.toggleSelfMute();
        }
    }
}

const MuteIcon: IconComponent = ({ height = 20, width = 20, className, style }) => (
    <svg width={width} height={height} className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.7 11H5C5 15.08 7.96 18.44 12 18.93V21H9V23H15V21H13V18.93C17.04 18.44 20 15.09 20 11H18.3C18.3 14.48 15.74 17.3 12 17.3C8.26 17.3 5.7 14.48 5.7 11H6.7ZM12 1C9.24 1 7 3.24 7 6V11C7 13.76 9.24 16 12 16C14.76 16 17 13.76 17 11V6C17 3.24 14.76 1 12 1Z" />
        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

function FakeMuteUserAreaButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [active, setActive] = useState(fakeMuteActive);

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : active ? "Disable Fake Mute" : "Enable Fake Mute (appear muted)"}
            icon={<MuteIcon className={iconForeground} style={{ color: active ? "var(--status-danger)" : "currentColor" }} />}
            role="switch"
            aria-checked={active}
            redGlow={active}
            plated={nameplate != null}
            onClick={() => {
                const next = !active;
                setActive(next);
                setFakeMute(next);
            }}
        />
    );
}

const FakeMuteButton: ChatBarButtonFactory = () => {
    const [active, setActive] = useState(fakeMuteActive);

    return (
        <ChatBarButton
            tooltip={active ? "Fake Mute: ON (click to disable)" : "Fake Mute: OFF (appear muted without muting)"}
            onClick={() => {
                const next = !active;
                setActive(next);
                setFakeMute(next);
            }}
        >
            <MuteIcon style={{ color: active ? "var(--status-danger)" : "currentColor" }} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "FakeMute",
    description: "Appear muted to others in voice channels while keeping your microphone active. Toggle from user panel or chat bar.",
    authors: [EndcordDevs.ewlle, EndcordDevs.rootpoi, EndcordDevs.kraethis],
    tags: ["Voice", "Utility"],
    dependencies: ["ChatInputButtonAPI", "UserAreaAPI"],

    userAreaButton: {
        icon: (props: { className?: string; }) => <MuteIcon {...props} />,
        render: FakeMuteUserAreaButton
    },

    chatBarButton: {
        icon: () => <MuteIcon /> as any,
        render: FakeMuteButton as any,
    },

    stop() {
        if (fakeMuteActive) setFakeMute(false);
        // Safety: always clean up patches even if state was inconsistent
        unpatchConnections();
    },
});
