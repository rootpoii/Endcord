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
    readonly type: AudioType;
    audio: string;
    /** The volume of the audio between 0 and 100. */
    volume: number;
    /** The playback speed of the audio between 0.0625 and 16. */
    speed: number;
    /** Whether the audio element is persistent and not recreated for every playback. */
    persistent: boolean;
    /** Whether to load the audio immediately. */
    preload: boolean;
    /** The duration of the audio in seconds, or null if not yet loaded. */
    readonly duration: Promise<number> | null;
    /** The current time of the audio in seconds, or null if not yet loaded. */
    get time(): Promise<number> | null;
    set time(value: number);
    /** The paused state of the audio, or null if not yet loaded. */
    get paused(): Promise<boolean> | null;
    set paused(value: boolean);
    /** The muted state of the audio, or null if not yet loaded. */
    get muted(): Promise<boolean> | null;
    set muted(value: boolean);
    /** Preloads the audio before playback. */
    load(): void;
    /** Sets the audio to loop until paused or stopped. */
    loop(): void;
    play(): void;
    pause(): void;
    stop(restart?: boolean): void;
    /** Plays the audio from the beginning. */
    restart(): void;
    /** Seeks to a specific time in seconds. */
    seek(time: number): void;
    mute(): void;
    unmute(): void;
    /** Deletes the audio element. Necessary if persistent is true. */
    delete(): void;
    destroyAudio(): void;
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

class AudioPlayer implements AudioPlayerInterface {
    private element: HTMLAudioElement | null = null;

    readonly type: AudioType;
    audio: string;
    persistent: boolean;
    onEnded?: () => void;
    onError?: (error: any) => void;

    _speed: number;
    private _volume: number;
    private _preload: boolean;

    constructor(sound: string, options: AudioPlayerOptions = {}) {
        this.audio = sound;
        this.type = options.type ?? identifyAudioType(sound);
        this.persistent = options.persistent ?? options.persists ?? false;
        this.onEnded = options.onEnded;
        this.onError = options.onError;

        this._volume = clamp(options.volume ?? 100, 0, 100);
        this._speed = clamp(options.speed ?? 1, 0.0625, 16);
        this._preload = options.preload ?? false;

        if (this._preload || this.persistent) this.ensureAudio();
    }

    private ensureAudio(): HTMLAudioElement {
        if (this.element) return this.element;

        const element = this.element = new Audio(this.audio);
        element.volume = this._volume / 100;
        element.playbackRate = this._speed;
        element.onended = () => {
            if (!this.persistent) this.destroyAudio();
            this.onEnded?.();
        };
        element.onerror = event => this.onError?.(event);

        return element;
    }

    get volume() { return this._volume; }
    set volume(value: number) {
        this._volume = clamp(value, 0, 100);
        if (this.element) this.element.volume = this._volume / 100;
    }

    get speed() { return this._speed; }
    set speed(value: number) {
        this._speed = clamp(value, 0.0625, 16);
        if (this.element) this.element.playbackRate = this._speed;
    }

    get preload() { return this._preload; }
    set preload(value: boolean) {
        this._preload = value;
        if (value) this.ensureAudio();
    }

    get duration() { return this.element && Promise.resolve(this.element.duration); }

    get time() { return this.element && Promise.resolve(this.element.currentTime); }
    set time(value: number) { this.ensureAudio().currentTime = value; }

    get paused() { return this.element && Promise.resolve(this.element.paused); }
    set paused(value: boolean) { value ? this.pause() : this.play(); }

    get muted() { return this.element && Promise.resolve(this.element.muted); }
    set muted(value: boolean) { this.ensureAudio().muted = value; }

    load() { this.ensureAudio(); }
    loop() { this.ensureAudio().loop = true; }
    play() { void this.ensureAudio().play().catch(error => this.onError?.(error)); }
    pause() { this.element?.pause(); }
    seek(time: number) { this.ensureAudio().currentTime = time; }
    mute() { this.ensureAudio().muted = true; }
    unmute() { this.ensureAudio().muted = false; }
    restart() { this.stop(true); }

    stop(restart = false) {
        const element = this.ensureAudio();
        element.pause();
        element.currentTime = 0;
        if (restart) this.play();
    }

    delete() { this.destroyAudio(); }

    destroyAudio() {
        if (!this.element) return;
        this.element.pause();
        this.element.onended = null;
        this.element.onerror = null;
        this.element.src = "";
        this.element = null;
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function createAudioPlayer(sound: string, options?: AudioPlayerOptions): AudioPlayerInterface {
    return new AudioPlayer(sound, options);
}

export function playAudio(sound: string, options?: AudioPlayerOptions): AudioPlayerInterface {
    const player = createAudioPlayer(sound, options);
    player.play();
    return player;
}

export default definePlugin({
    name: "AudioPlayerAPI",
    description: "API to play internal Discord audio files or external audio links.",
    authors: [EndcordDevs.ewlle, EndcordDevs.rootpoi, EndcordDevs.kraethis],
    playAudio,
    createAudioPlayer
});
