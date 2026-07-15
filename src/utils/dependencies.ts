/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The below code is only used on the Desktop (electron) build of Endcord.
// Browser (extension) builds do not contain these remote imports.

export const shikiWorkerSrc = `https://cdn.jsdelivr.net/npm/@vap/shiki-worker@0.0.8/dist/${IS_DEV ? "index.js" : "index.min.js"}`;
export const shikiOnigasmSrc = "https://cdn.jsdelivr.net/npm/@vap/shiki@0.10.3/dist/onig.wasm";
