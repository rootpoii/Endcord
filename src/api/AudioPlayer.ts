/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EndcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findLazy } from "@webpack";

let defaultSounds: null | string[] = null;
const findDefaultSounds: any = findLazy(module => module.resolve && module.id && module.keys?.().some((key: string) => key.endsWith(".mp3")));

export function defaultAudioNames(): string[] {
    defaultSounds ??= (findDefaultSounds?.keys?.() || []).map((key: string) => {
        const match = key.match(/((?:\w|-)+)\.mp3$/);
        return match ? match[1] : null;
    }).filter(Boolean) as string[];

    return defaultSounds;
}

export enum AudioType {
    EXTERNAL = 0,
    DISCORD = 1,
    BASE64 = 2,
    DATA = 3
}

export interface AudioPlayerOptions {
    volume?: number;
    speed?: number;
    persists?: boolean;
    persistent?: boolean;
    preload?: boolean;
    type?: AudioType;
    onEnded?: () => void;
    onError?: (error: any) => void;
}

export interface AudioPlayerInterface {
    _speed: number;
    type: AudioType;
    audio: string;
    volume?: number;
    play: () => void;
    stop: (restart?: boolean) => void;
    delete?: () => void;
    destroyAudio: () => void;
    onEnded?: () => void;
    onError?: (error: any) => void;
}

export type AudioPlayerInternal = AudioPlayerInterface;

export class AudioProcessor {
    static process(data: any) { return data; }
}

export type PreprocessAudioData = any;

export function identifyAudioType(sound: string): AudioType {
    if (sound.startsWith("http://") || sound.startsWith("https://")) return AudioType.EXTERNAL;
    if (sound.startsWith("data:")) return AudioType.DATA;
    return AudioType.DISCORD;
}

export function playAudio(sound: string, options?: AudioPlayerOptions): AudioPlayerInterface {
    const audio = new Audio();
    const type = options?.type ?? identifyAudioType(sound);
    audio.src = sound;

    if (options?.volume != null) audio.volume = options.volume;
    if (options?.speed != null) audio.playbackRate = options.speed;

    audio.play().catch(() => {});

    const player: AudioPlayerInterface = {
        _speed: options?.speed ?? 1,
        type,
        audio: sound,
        volume: options?.volume ?? 1,
        play: () => audio.play().catch(() => {}),
        stop: () => {
            audio.pause();
            audio.currentTime = 0;
        },
        delete: () => {
            audio.pause();
        },
        destroyAudio: () => {
            audio.pause();
        },
        onEnded: options?.onEnded,
        onError: options?.onError
    };

    if (options?.onEnded) {
        audio.onended = () => options.onEnded!();
    }
    if (options?.onError) {
        audio.onerror = (e) => options.onError!(e);
    }

    return player;
}

export function createAudioPlayer(sound: string, options?: AudioPlayerOptions) {
    return playAudio(sound, options);
}

export default definePlugin({
    name: "AudioPlayerAPI",
    description: "API to play internal Discord audio files or external audio links.",
    authors: [EndcordDevs.ewlle, EndcordDevs.rootpoi, EndcordDevs.kraethis],
    playAudio,
    createAudioPlayer
});
