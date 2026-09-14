/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { ENDCORD_USER_AGENT } from "@shared/endcordUserAgent";
import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";
import { writeFile } from "fs/promises";
import { join } from "path";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { ENDCORD_FILES,serializeErrors } from "./common";

const API_BASE = "https://api.github.com/repos/plaiboiewlle/endcord-api";
let PendingUpdates = [] as [string, string][];

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": ENDCORD_USER_AGENT
        }
    });
}

async function calculateGitChanges() {
    const isOutdated = await fetchUpdates();
    if (!isOutdated) return [];

    try {
        const data = await githubGet(`/compare/${gitHash}...HEAD`);

        return data.commits.map((c: any) => ({
            // github api only sends the long sha
            hash: c.sha.slice(0, 7),
            author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
            message: c.commit.message.split("\n")[0]
        }));
    } catch {
        return [{
            hash: "new",
            author: "GitHub",
            message: "New update available on GitHub"
        }];
    }
}

async function fetchUpdates() {
    try {
        const cacheBust = `?t=${Date.now()}`;
        const apiData = await fetchJson<any>(`https://raw.githubusercontent.com/plaiboiewlle/endcord-api/main/version.json${cacheBust}`);
        if (apiData && apiData.assets && Array.isArray(apiData.assets) && apiData.assets.length > 0) {
            const remoteTs = Number(apiData.updatedAt || 0);
            const localTs = typeof BUILD_TIMESTAMP === "number" ? BUILD_TIMESTAMP : 0;

            // Only consider it an update if the remote release timestamp is strictly greater than our build timestamp!
            if (remoteTs > localTs && apiData.hash !== gitHash) {
                PendingUpdates = apiData.assets.map((a: any) => [a.name, a.url]);
                return true;
            }
        }
    } catch { }

    return false;
}

async function applyUpdates() {
    const fileContents = await Promise.all(PendingUpdates.map(async ([name, url]) => {
        const contents = await fetchBuffer(url);
        return [join(__dirname, name), contents] as const;
    }));

    await Promise.all(fileContents.map(async ([filename, contents]) =>
        writeFile(filename, contents))
    );

    PendingUpdates = [];
    return true;
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(() => "https://github.com/plaiboiewlle/endcord-api"));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(calculateGitChanges));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(fetchUpdates));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(applyUpdates));
