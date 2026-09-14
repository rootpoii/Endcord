/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { Devs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

const logger = new Logger("VoiceSettings");

const NoiseModule = findByPropsLazy("setNoiseCancellation");

let _origGUM: (typeof navigator.mediaDevices.getUserMedia) | null = null;

function applyGUMPatch() {
    if (_origGUM) return;
    _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    navigator.mediaDevices.getUserMedia = async function (constraints) {
        if (constraints?.audio && typeof constraints.audio === "object") {
            const s = settings.store;
            if (s.forceStereo) {
                (constraints.audio as MediaTrackConstraints).channelCount = { ideal: 2 };
            }
            if (!s.echoCancellation) {
                (constraints.audio as MediaTrackConstraints).echoCancellation = false;
            }
            if (!s.autoGainControl) {
                (constraints.audio as MediaTrackConstraints).autoGainControl = false;
            }
            if (s.noiseSuppression === "none") {
                (constraints.audio as MediaTrackConstraints).noiseSuppression = false;
            }
        }
        return _origGUM!(constraints);
    };
}

function removeGUMPatch() {
    if (_origGUM) {
        navigator.mediaDevices.getUserMedia = _origGUM;
        _origGUM = null;
    }
}

function applyNoiseSuppression() {
    try {
        const mode = settings.store.noiseSuppression;

        const enableKrisp = mode === "krisp";
        NoiseModule.setNoiseCancellation(enableKrisp, {});
    } catch (e) {
        logger.warn("setNoiseCancellation failed:", e);
    }
}

const settings = definePluginSettings({
    voiceBitrateKbps: {
        type: OptionType.SLIDER,
        description: "Opus voice bitrate in kbps. Discord defaults to 64 kbps. Raise for better call quality (uses more bandwidth).",
        markers: [32, 64, 96, 128, 192, 256, 320, 510],
        default: 128,
        stickToMarkers: true,
    },
    forceStereo: {
        type: OptionType.BOOLEAN,
        description: "Capture microphone in stereo instead of mono. Rejoin voice for the change to take effect.",
        default: false,
    },
    noiseSuppression: {
        type: OptionType.SELECT,
        description: "Noise suppression mode for your microphone input. Changing this re-applies immediately.",
        options: [
            { label: "Krisp AI (default)", value: "krisp", default: true },
            { label: "Standard (browser-level)", value: "standard" },
            { label: "None (raw mic, best for music/instruments)", value: "none" },
        ],
    },
    echoCancellation: {
        type: OptionType.BOOLEAN,
        description: "Enable browser-level echo cancellation. Disable for music or instruments (Krisp handles this on its own). Rejoin voice to apply.",
        default: true,
    },
    autoGainControl: {
        type: OptionType.BOOLEAN,
        description: "Enable browser-level automatic gain control (normalises mic volume). Disable if you use hardware gain or prefer manual control. Rejoin voice to apply.",
        default: true,
    },
    pttDelayMax: {
        type: OptionType.SLIDER,
        description: "Maximum push-to-talk release delay in milliseconds. Discord caps this at 2 000 ms by default.",
        markers: makeRange(2000, 10000, 1000),
        default: 5000,
        stickToMarkers: true,
    },
});

export default definePlugin({
    name: "VoiceSettings",
    description: "Fine-grained voice audio controls: Opus bitrate, stereo capture, noise suppression mode, echo cancellation, auto gain control, and extended PTT delay.",
    tags: ["Voice", "Utility"],
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    settings,

    patches: [

        {
            find: "mediaBitrate:",
            replacement: {
                match: /(?<=mediaBitrate:)\d+/,
                replace: "$self.settings.store.voiceBitrateKbps*1000",
            },
            noWarn: true,
        },

        {
            find: "pttReleaseDelay",
            replacement: {
                match: /(?<=pttReleaseDelay.{0,200})maxValue:2000/,
                replace: "maxValue:$self.settings.store.pttDelayMax",
            },
            noWarn: true,
        },

        {
            find: ";usedtx=",
            replacement: {
                match: /;usedtx=\$\{(\i)\?"0":"1"\}/,
                replace: '$&${$self.settings.store.forceStereo?";stereo=1;sprop-stereo=1":""}',
            },
            noWarn: true,
        },
    ],

    start() {
        applyGUMPatch();
        applyNoiseSuppression();

        FluxDispatcher.subscribe("VOICE_CHANNEL_SELECT", applyNoiseSuppression);
    },

    stop() {
        removeGUMPatch();
        FluxDispatcher.unsubscribe("VOICE_CHANNEL_SELECT", applyNoiseSuppression);
    },
});
