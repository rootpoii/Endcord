/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";

import PluginNatives from "~pluginNatives";

const PluginIpcMappings = {} as Record<string, Record<string, string>>;
export type PluginIpcMappings = typeof PluginIpcMappings;

for (const [plugin, methods] of Object.entries(PluginNatives)) {
    const entries = Object.entries(methods);
    if (!entries.length) continue;

    const mappings = PluginIpcMappings[plugin] = {};

    for (const [methodName, method] of entries) {
        const key = `EndcordPluginNative_${plugin}_${methodName}`;
        ipcMain.handle(key, method);
        mappings[methodName] = key;
    }
}

ipcMain.on(IpcEvents.GET_PLUGIN_IPC_METHOD_MAP, e => {
    e.returnValue = PluginIpcMappings;
});
