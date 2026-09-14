/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings, Settings } from "@api/Settings";
import fakeNitro from "@plugins/fakeNitro";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

interface StreamQualityOpts {
    bitrateMin?: number;
    bitrateMax?: number;
    bitrateTarget?: number;
    capture?: { width?: number; height?: number; framerate?: number; pixelCount?: number; };
    encode?: { width?: number; height?: number; framerate?: number; pixelCount?: number; };
}

const settings = definePluginSettings({
    frameRate: {
        description: "Stream frame rate.",
        type: OptionType.SLIDER,
        markers: [15, 20, 24, 30, 45, 60],
        default: 60,
        stickToMarkers: true,
        restartNeeded: true,
    },
    resolution: {
        description: "Stream resolution (height in pixels).",
        type: OptionType.SLIDER,
        markers: [480, 720, 1080, 1440],
        default: 1080,
        stickToMarkers: true,
        restartNeeded: true,
    },
    targetBitrateKbps: {
        description: "Target stream bitrate in kbps.",
        type: OptionType.SLIDER,
        markers: [2500, 5000, 10000, 20000, 40000],
        default: 10000,
        stickToMarkers: false,
        restartNeeded: true,
    },
    unlockQualityOptions: {
        description: "Unlock 1080p60 and higher resolution options regardless of Nitro or server boost level.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
    preventFramerateReduction: {
        description: "Prevent Discord from reducing stream framerate when you stop speaking.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
});

export default definePlugin({
    name: "BetterScreenShare",
    description: "Unlock higher stream bitrates, custom frame rates, and resolutions for screen share on Discord Desktop, without requiring Nitro.",
    tags: ["Voice", "Utility"],
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    settings,

    patches: [
        // Apply configured quality when a stream starts or quality changes
        {
            find: "this.getDefaultGoliveQuality()",
            replacement: [
                {
                    match: /(this\.goliveMaxQuality)=(this\.getDefaultGoliveQuality\(\))/,
                    replace: "$1=$self.patchStreamQuality($2)",
                },
                {
                    match: /setGoliveQuality\((\i)\)\{/,
                    replace: "setGoliveQuality($1){$1=$self.patchGoliveArgs($1);",
                },
                {
                    match: /(\i)\.encodingVideoMinBitRate=\i\.bitrateMin,\i\.encodingVideoMaxBitRate=\i\.bitrateMax/,
                    replace: "$1.encodingVideoMinBitRate=$self.getMinBitrate(),$1.encodingVideoMaxBitRate=$self.getMaxBitrate()",
                },
            ],
        },
        // Unlock quality options for all users regardless of Nitro
        {
            find: "canUseCustomStickersEverywhere:",
            replacement: [
                {
                    match: /(?<=canUseHighVideoUploadQuality:function\(\i\)\{)/,
                    replace: "return true;",
                },
                {
                    match: /(?<=canStreamQuality:function\(\i,\i\)\{)/,
                    replace: "return true;",
                },
            ],
            predicate: () => settings.store.unlockQualityOptions && !isPluginEnabled(fakeNitro.name) && !Settings.plugins[fakeNitro.name].enableStreamQualityBypass,
            noWarn: true,
        },
        // Remove guild boost tier restriction from stream FPS options
        {
            find: "#{intl::STREAM_FPS_OPTION}",
            replacement: {
                match: /guildPremiumTier:\i\.\i\.TIER_\d,?/g,
                replace: "",
            },
            predicate: () => settings.store.unlockQualityOptions && !isPluginEnabled(fakeNitro.name),
            noWarn: true,
        },
        // Allow 1080p and above at 60fps (Discord normally blocks this without Nitro)
        {
            find: ",setIsForceShowSharingPopout:",
            replacement: {
                match: /\i!==\i\.\i\.RESOLUTION_720\|\|\i===\i\.\i\.FPS_60/,
                replace: "true",
            },
            predicate: () => settings.store.unlockQualityOptions,
        },
        // Force the encoder to use the configured resolution and FPS
        {
            find: "}setDesktopEncodingOptions(",
            replacement: [
                {
                    match: /setDesktopEncodingOptions\((\i),(\i),(\i)\)\{/,
                    replace: "setDesktopEncodingOptions($1,$2,$3){$1=$self.getWidth();$2=$self.getHeight();$3=$self.getFps();",
                },
                {
                    match: /keyframeInterval=0/,
                    replace: "keyframeInterval=5000",
                },
            ],
        },
        // Raise default desktop bitrate caps (Discord default: 600kbps target, 3.5Mbps max)
        {
            find: "desktopBitrate:{",
            replacement: {
                match: /desktopBitrate:\{min:5e5,max:35e5,target:6e5\}/,
                replace: "desktopBitrate:{min:5e5,max:4e7,target:1e7}",
            },
        },
        // Prevent Discord from halving stream FPS when you stop speaking
        {
            find: "Reduced framerate after",
            replacement: {
                match: /this\.framerateReductionTimeout=setTimeout/,
                replace: "this.framerateReductionTimeout=void 0&&setTimeout",
            },
            predicate: () => settings.store.preventFramerateReduction,
        },
    ],

    getStreamConfig() {
        const fps = settings.store.frameRate ?? 60;
        const height = settings.store.resolution ?? 1080;
        const width = Math.round(height * (16 / 9));
        const pixelCount = width * height;
        const bitrateTarget = (settings.store.targetBitrateKbps ?? 10000) * 1000;
        const bitrateMax = Math.min(40_000_000, bitrateTarget * 2);
        return { fps, height, width, pixelCount, bitrateTarget, bitrateMax };
    },

    getWidth() { return this.getStreamConfig().width; },
    getHeight() { return this.getStreamConfig().height; },
    getFps() { return this.getStreamConfig().fps; },
    getMinBitrate() { return 500_000; },
    getMaxBitrate() { return this.getStreamConfig().bitrateMax; },

    patchGoliveArgs(opts: StreamQualityOpts) {
        const c = this.getStreamConfig();
        return {
            ...opts,
            bitrateTarget: c.bitrateTarget,
            capture: { ...opts.capture, width: c.width, height: c.height, framerate: c.fps },
            encode: { ...opts.encode, width: c.width, height: c.height, framerate: c.fps, pixelCount: c.pixelCount },
        };
    },

    patchStreamQuality(opts: StreamQualityOpts) {
        const c = this.getStreamConfig();
        Object.assign(opts, {
            bitrateMin: this.getMinBitrate(),
            bitrateMax: c.bitrateMax,
            bitrateTarget: c.bitrateTarget,
        });
        if (opts.encode) {
            Object.assign(opts.encode, {
                framerate: c.fps, width: c.width, height: c.height, pixelCount: c.pixelCount,
            });
        }
        Object.assign((opts.capture ??= {}), {
            framerate: c.fps, width: c.width, height: c.height, pixelCount: c.pixelCount,
        });
        return opts;
    },
});
