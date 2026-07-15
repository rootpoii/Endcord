/*
 * Endcord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
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

export const Devs = /* #__PURE__*/ Object.freeze({
    ewlle: { name: "ewlle", id: 892408159526858753n },
    rootpoi: { name: "rootpoi", id: 1505905479413530795n },
    kraethis: { name: "kraethis", id: 904384828143706164n }
} satisfies Record<string, Dev>);

export const DevsById = /* #__PURE__*/ (() =>
    Object.freeze(Object.fromEntries(
        Object.entries(Devs)
            .filter(d => d[1].id !== 0n)
            .map(([_, v]) => [v.id, v] as const)
    ))
)() as Record<string, Dev>;

export const EndcordDevs = new Proxy({} as Record<string, Dev>, {
    get: (target, prop) => {
        return {
            name: String(prop),
            id: 0n
        };
    }
}) as any;
