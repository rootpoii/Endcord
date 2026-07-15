/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { debounce } from "@shared/debounce";
import { IpcEvents } from "@shared/IpcEvents";
import { contextBridge, webFrame } from "electron/renderer";

import EndcordNative, { invoke, sendSync } from "./EndcordNative";

contextBridge.exposeInMainWorld("EndcordNative", EndcordNative);

// Discord
if (location.protocol !== "data:") {
    invoke(IpcEvents.INIT_FILE_WATCHERS);

    if (IS_DISCORD_DESKTOP) {
        webFrame.executeJavaScript(sendSync<string>(IpcEvents.PRELOAD_GET_RENDERER_JS));
        // Not supported in sandboxed preload scripts but Discord doesn't support it either so who cares
        require(process.env.DISCORD_PRELOAD!);
    }
} // Monaco popout
else {
    contextBridge.exposeInMainWorld("setCss", debounce(EndcordNative.quickCss.set));
    contextBridge.exposeInMainWorld("getCurrentCss", EndcordNative.quickCss.get);
    contextBridge.exposeInMainWorld("getTheme", EndcordNative.quickCss.getEditorTheme);
}
