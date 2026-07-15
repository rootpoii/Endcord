/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { EndcordDevs } from "@utils/constants";
import definePlugin, { IconComponent } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, React, useState, useStateFromStores } from "@webpack/common";

const VoiceActionsStore = findByPropsLazy("toggleSelfMute");

let fakeMuteActive = false;
let originalIsSelfMute: (() => boolean) | null = null;

function patchConnections(block: boolean) {
    try {
        const engine = (MediaEngineStore as any).getMediaEngine?.();
        if (!engine) return;
        for (const conn of engine.connections ?? []) {
            if (!conn?.setSelfMute) continue;
            if (block) {
                if (!conn.__fakeMuteOriginal) {
                    conn.__fakeMuteOriginal = conn.setSelfMute.bind(conn);
                    conn.setSelfMute = () => { };
                }
            } else {
                if (conn.__fakeMuteOriginal) {
                    conn.setSelfMute = conn.__fakeMuteOriginal;
                    delete conn.__fakeMuteOriginal;
                }
            }
        }
    } catch { }
}

function setFakeMute(value: boolean) {
    fakeMuteActive = value;

    if (value) {
        if (!originalIsSelfMute) {
            originalIsSelfMute = (MediaEngineStore as any).isSelfMute.bind(MediaEngineStore);
            (MediaEngineStore as any).isSelfMute = () => true;
        }
        const wasMuted = originalIsSelfMute?.() === true;
        if (!wasMuted) {
            patchConnections(true);
            VoiceActionsStore.toggleSelfMute();
            setTimeout(() => patchConnections(false), 200);
        }
    } else {
        if (originalIsSelfMute) {
            (MediaEngineStore as any).isSelfMute = originalIsSelfMute;
            originalIsSelfMute = null;
        }
        const currentlyMuted = (MediaEngineStore as any).isSelfMute();
        if (currentlyMuted) VoiceActionsStore.toggleSelfMute();
    }
}

const MuteIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg width={width} height={height} className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.7 11H5C5 15.08 7.96 18.44 12 18.93V21H9V23H15V21H13V18.93C17.04 18.44 20 15.09 20 11H18.3C18.3 14.48 15.74 17.3 12 17.3C8.26 17.3 5.7 14.48 5.7 11H6.7ZM12 1C9.24 1 7 3.24 7 6V11C7 13.76 9.24 16 12 16C14.76 16 17 13.76 17 11V6C17 3.24 14.76 1 12 1Z" />
        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

const FakeMuteButton: ChatBarButtonFactory = ({ isAnyChat }) => {
    if (!isAnyChat) return null;

    const inVC = useStateFromStores(
        [MediaEngineStore as any],
        () => !!(MediaEngineStore as any).getMediaEngine?.()?.connections?.length
    );
    const [active, setActive] = useState(false);

    if (!inVC) return null;

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
    description: "Appear muted to others in voice channels while keeping your microphone active. Toggle from the chat bar (only shows when in a VC).",
    authors: [EndcordDevs.Sharp],
    tags: ["Voice", "Utility"],
    dependencies: ["ChatInputButtonAPI"],

    chatBarButton: {
        icon: () => <MuteIcon /> as any,
        render: FakeMuteButton as any,
    },

    stop() {
        if (fakeMuteActive) setFakeMute(false);
    },
});
