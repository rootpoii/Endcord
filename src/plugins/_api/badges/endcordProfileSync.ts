/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const ENDCORD_API = "https://api.endcord.com";

type ProfileListener = (userId: string, prof: any) => void;
const listeners = new Set<ProfileListener>();

export function onEndcordProfile(listener: ProfileListener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function emitProfile(userId: string, prof: any) {
    for (const listener of listeners) {
        try { listener(userId, prof); } catch {}
    }
}

const fetchedAt = new Map<string, number>();

// One shared list per open window. 10s polling burned the 5M daily cap in about two hours.

export function markProfileFresh(userId: string) {
    if (userId) fetchedAt.set(userId, Date.now());
}

export async function fetchEndcordProfile(userId: string, _force = false): Promise<any | null> {
    if (!userId) return null;
    const all = await fetchAllEndcordProfiles();
    return all?.[userId] ?? null;
}

export function queueEndcordProfile(_userId: string) {
    // Profiles come from the shared directory fetch. Do not request each user.
}

const DIRECTORY_MS = 5 * 60 * 1000;
const BACKOFF_MS = 30 * 60 * 1000;
let allInflight: Promise<Record<string, any> | null> | null = null;
let directoryCache: Record<string, any> | null = null;
let directoryNextAt = 0;

function windowHidden() {
    return typeof document !== "undefined" && document.hidden;
}

export async function fetchAllEndcordProfiles(): Promise<Record<string, any> | null> {
    if (allInflight) return allInflight;
    if (Date.now() < directoryNextAt) return directoryCache;
    // A minimized client must not spend the daily quota.
    if (windowHidden()) return directoryCache;

    directoryNextAt = Date.now() + DIRECTORY_MS;
    allInflight = (async () => {
        try {
            const res = await fetch(`${ENDCORD_API}/profiles`);
            if (!res.ok) {
                directoryNextAt = Date.now() + (res.status === 429 || res.status === 503 ? BACKOFF_MS : 15 * 60 * 1000);
                return directoryCache;
            }
            const allProfiles = await res.json();
            if (!allProfiles || typeof allProfiles !== "object" || Array.isArray(allProfiles)) {
                directoryNextAt = Date.now() + 15 * 60 * 1000;
                return directoryCache;
            }
            const now = Date.now();
            for (const [uid, prof] of Object.entries(allProfiles)) {
                fetchedAt.set(uid, now);
                emitProfile(uid, prof);
            }
            directoryCache = allProfiles;
            return allProfiles;
        } catch {
            directoryNextAt = Date.now() + 15 * 60 * 1000;
            return directoryCache;
        }
    })().finally(() => {
        allInflight = null;
    });

    return allInflight;
}

if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) void fetchAllEndcordProfiles();
    });
}
