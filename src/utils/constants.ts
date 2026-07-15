/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const REACT_GLOBAL = "Endcord.Webpack.Common.React";
export const VENBOT_USER_ID = "1017176847865352332";
export const ENDCORD_GUILD_ID = "1015060230222131221";
export const DONOR_ROLE_ID = "1042507929485586532";
export const CONTRIB_ROLE_ID = "1026534353167208489";
export const REGULAR_ROLE_ID = "1026504932959977532";
export const SUPPORT_CHANNEL_ID = "1026515880080842772";
export const SUPPORT_CATEGORY_ID = "1108135649699180705";
export const KNOWN_ISSUES_CHANNEL_ID = "1257025907625951423";

const platform = navigator.platform.toLowerCase();
export const IS_WINDOWS = platform.startsWith("win");
export const IS_MAC = platform.startsWith("mac");
export const IS_LINUX = platform.startsWith("linux");
export const IS_MOBILE = navigator.userAgent.includes("Mobi");

export interface Dev {
    name: string;
    id: bigint;
    badge?: boolean;
}

export const Devs: Record<string, Dev> & {
    ewlle: Dev;
    rootpoi: Dev;
    kraethis: Dev;
} = new Proxy({
    ewlle: { name: "ewlle", id: 892408159526858753n },
    rootpoi: { name: "rootpoi", id: 1505905479413530795n },
    kraethis: { name: "kraethis", id: 904384828143706164n }
} as any, {
    get: (target, prop) => {
        if (typeof prop === "string" && prop in target) {
            return target[prop];
        }
        return {
            name: typeof prop === "string" ? prop : String(prop),
            id: 0n
        };
    }
}) as any;

export const DevsById = /* #__PURE__*/ (() =>
    Object.freeze(Object.fromEntries(
        Object.entries({
            ewlle: { name: "ewlle", id: 892408159526858753n },
            rootpoi: { name: "rootpoi", id: 1505905479413530795n },
            kraethis: { name: "kraethis", id: 904384828143706164n }
        })
            .filter(d => d[1].id !== 0n)
            .map(([_, v]) => [v.id, v] as const)
    ))
)() as Record<string, Dev>;

export const EndcordDevs = Devs;

