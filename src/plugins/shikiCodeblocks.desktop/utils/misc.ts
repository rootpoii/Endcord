/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { resolveLang } from "@plugins/shikiCodeblocks.desktop/api/languages";
import { HighlighterProps } from "@plugins/shikiCodeblocks.desktop/components/Highlighter";
import { HljsSetting } from "@plugins/shikiCodeblocks.desktop/types";
import { classNameFactory } from "@utils/css";
import { DefaultExtractAndLoadChunksRegex, extractAndLoadChunksLazy, findByPropsLazy } from "@webpack";

export const cl = classNameFactory("vc-shiki-");

export const hljs: typeof import("highlight.js").default = findByPropsLazy("highlight", "registerLanguage");
export const requireHljs = extractAndLoadChunksLazy(["codeBlock:{react("], new RegExp(`"hljs".+?${DefaultExtractAndLoadChunksRegex.source}`));

export const shouldUseHljs = ({
    lang,
    tryHljs,
}: {
    lang: HighlighterProps["lang"],
    tryHljs: HljsSetting,
}) => {
    const hljsLang = lang ? hljs?.getLanguage?.(lang) : null;
    const shikiLang = lang ? resolveLang(lang) : null;
    const langName = shikiLang?.name;

    switch (tryHljs) {
        case HljsSetting.Always:
            return true;
        case HljsSetting.Primary:
            return !!hljsLang || lang === "";
        case HljsSetting.Secondary:
            return !langName && !!hljsLang;
        case HljsSetting.Never:
            return false;
        default: return false;
    }
};
