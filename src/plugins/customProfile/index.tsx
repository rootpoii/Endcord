/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BadgePosition, ProfileBadge } from "@api/Badges";
import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { EndcordDevs } from "@utils/constants";
import {
    ModalCloseButton as ModalCloseButton_,
    ModalContent as ModalContent_,
    ModalFooter as ModalFooter_,
    ModalHeader as ModalHeader_,
    ModalRoot as ModalRoot_,
    openModal
} from "@utils/modal";
import definePlugin from "@utils/types";
import { AuthenticationStore, Button, FluxDispatcher, IconUtils, Menu, React, RestAPI, Select, SnowflakeUtils, UserStore } from "@webpack/common";
import virtualMerge from "virtual-merge";

const t = (s: string) => s;

const ModalRoot = ModalRoot_ as React.ComponentType<any>;
const ModalHeader = ModalHeader_ as React.ComponentType<any>;
const ModalContent = ModalContent_ as React.ComponentType<any>;
const ModalFooter = ModalFooter_ as React.ComponentType<any>;
const ModalCloseButton = ModalCloseButton_ as React.ComponentType<any>;

const DS_KEY = "customProfile_data";
const DS_ENABLED = "customProfile_enabled";

const FLAG = {
    STAFF: 1,
    PARTNER: 2,
    HYPESQUAD: 4,
    BUG_HUNTER_1: 8,
    BRAVERY: 64,
    BRILLIANCE: 128,
    BALANCE: 256,
    EARLY_SUPPORTER: 512,
    BUG_HUNTER_2: 16384,
    DEV_VERIFIED: 131072,
    MOD_ALUMNI: 262144,
    ACTIVE_DEVELOPER: 4194304,
};

const BADGES = [
    { label: t("Discord Staff"), flag: FLAG.STAFF, icon: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png" },
    { label: t("Partnered Server Owner"), flag: FLAG.PARTNER, icon: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png" },
    { label: t("HypeSquad Events"), flag: FLAG.HYPESQUAD, icon: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png" },
    { label: t("Bug Hunter Level 1"), flag: FLAG.BUG_HUNTER_1, icon: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png" },
    { label: t("HypeSquad Bravery"), flag: FLAG.BRAVERY, icon: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png" },
    { label: t("HypeSquad Brilliance"), flag: FLAG.BRILLIANCE, icon: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png" },
    { label: t("HypeSquad Balance"), flag: FLAG.BALANCE, icon: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png" },
    { label: t("Early Supporter"), flag: FLAG.EARLY_SUPPORTER, icon: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png" },
    { label: t("Moderator Programs Alumni"), flag: FLAG.MOD_ALUMNI, icon: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png" },
    { label: t("Bug Hunter Level 2"), flag: FLAG.BUG_HUNTER_2, icon: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png" },
    { label: t("Early Verified Bot Developer"), flag: FLAG.DEV_VERIFIED, icon: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png" },
    { label: t("Active Developer"), flag: FLAG.ACTIVE_DEVELOPER, icon: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png" },
];

const OLD_NAME_BADGE_ICON = "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png";

const NITRO_LEVELS = [
    { label: t("Nitro (0 months)"), icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png" },
    { label: t("Bronze (1 month)"), icon: "https://cdn.discordapp.com/badge-icons/4f33c4a9c64ce221936bd256c356f91f.png" },
    { label: t("Silver (2 months)"), icon: "https://cdn.discordapp.com/badge-icons/4514fab914bdbfb4ad2fa23df76121a6.png" },
    { label: t("Gold (3 months)"), icon: "https://cdn.discordapp.com/badge-icons/2895086c18d5531d499862e41d1155a6.png" },
    { label: t("Platinum (6 months)"), icon: "https://cdn.discordapp.com/badge-icons/0334688279c8359120922938dcb1d6f8.png" },
    { label: t("Diamond (12 months)"), icon: "https://cdn.discordapp.com/badge-icons/0d61871f72bb9a33a7ae568c1fb4f20a.png" },
    { label: t("Emerald (24 months)"), icon: "https://cdn.discordapp.com/badge-icons/11e2d339068b55d3a506cff34d3780f3.png" },
    { label: t("Ruby (36 months)"), icon: "https://cdn.discordapp.com/badge-icons/cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4.png" },
    { label: t("Opal (72 months)"), icon: "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png" },
];

const BOOST_LABELS_RAW = [
    "1 Month", "2 Months", "3 Months", "6 Months",
    "9 Months", "12 Months", "15 Months", "18 Months", "24 Months"
];
const BOOST_LABELS = BOOST_LABELS_RAW.map(l => t(l));
const BOOST_MONTHS = [1, 2, 3, 6, 9, 12, 15, 18, 24];
const BOOST_ICONS = [
    "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png",
    "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png",
    "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png",
    "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png",
    "https://cdn.discordapp.com/badge-icons/996b3e870e8a22ce519b3a50e6bdd52f.png",
    "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png",
    "https://cdn.discordapp.com/badge-icons/cb3ae83c15e970e8f3d410bc62cb8b99.png",
    "https://cdn.discordapp.com/badge-icons/7142225d31238f6387d9f09efaa02759.png",
    "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png",
];

const AVATAR_DECORATIONS = [
    { id: "1144307957425778779", label: "Hearts" },
    { id: "1144308196723408958", label: "Hearts Animated" },
    { id: "1212569433839636530", label: "Lofi Cafe" },
    { id: "1481387347642810480", label: "Winter" },
    { id: "1343751617362661526", label: "Magic Orb" },
    { id: "1373015260465987705", label: "Dragon" },
    { id: "1333866045303423026", label: "Ghost" },
    { id: "1144308439720394944", label: "Sakura Drift" },
    { id: "1432550258126229565", label: "Neon" },
    { id: "1462116613632426014", label: "Cyber City" },
    { id: "1462116613682757888", label: "Retro" },
    { id: "1144307629225672846", label: "Fire" },
    { id: "1341506443718688768", label: "Void" },
    { id: "1447654090640330763", label: "Celestial" },
    { id: "1483857762890022923", label: "Snowy" },
    { id: "1479561706672885811", label: "Ice" },
    { id: "1212569856189407352", label: "Cozy" },
    { id: "1485784028710830242", label: "New Year" },
    { id: "1341506444150702080", label: "Abyss" },
    { id: "1232071712695386162", label: "Spring" },
    { id: "1220514048068812901", label: "Summer" },
    { id: "1427463138634109026", label: "Autumn" },
    { id: "1341506443865489408", label: "Darkness" },
    { id: "1144003752978829455", label: "Flaming Sword" },
    { id: "1144006094134456352", label: "Magical Potion" },
    { id: "1144046002110738634", label: "Fairy Sprites" },
    { id: "1144048390594908212", label: "Wizard's Staff" },
    { id: "1144048977138946230", label: "Glowing Runes" },
    { id: "1144049316009353338", label: "Defensive Shield" },
    { id: "1144049603109470370", label: "Skull Medallion" },
    { id: "1144049924397334651", label: "Treasure and Key" },
    { id: "1207047014769234001", label: "Fire Element" },
    { id: "1207047597294886923", label: "Water" },
    { id: "1207047808838799410", label: "Air" },
    { id: "1207048049571139584", label: "Earth" },
    { id: "1207048289610899526", label: "Lightning" },
    { id: "1207048656289534022", label: "Balance" },
    { id: "1232070870093008937", label: "Stardust" },
    { id: "1232071157746765906", label: "Black Hole" },
    { id: "1232071712695386162", label: "Constellations" },
    { id: "1232072121950146560", label: "Solar Orbit" },
    { id: "1232072520249643028", label: "UFO" },
    { id: "1232072859485208687", label: "Astronaut Helmet" },
    { id: "1197344326133502032", label: "Glitch" },
    { id: "1197344396983664670", label: "Cybernetic" },
    { id: "1197344575832981605", label: "Digital Sunrise" },
    { id: "1197344636558114986", label: "Implant" },
];

function getDecorationUrl(assetId: string, animated = false): string {
    return `https://cdn.discordapp.com/media/v1/collectibles-shop/${assetId}/${animated ? "animated" : "static"}`;
}

const PROFILE_EFFECTS = [
    { id: "1139323092645183591", label: "Hydro Blast" },
    { id: "1139323093991575696", label: "Sakura Dreams" },
    { id: "1139323099251232828", label: "Mystic Vines" },
    { id: "1139323099687436419", label: "Pixie Dust" },
    { id: "1212582298893946880", label: "Dreamy" },
    { id: "1212582372877541427", label: "Ki Detonate" },
    { id: "1212582452640350238", label: "Sushi Mania" },
    { id: "1139323100568244355", label: "Magic Hearts" },
    { id: "1139323093551165533", label: "Shatter" },
    { id: "1139323101008642101", label: "Shuriken Strike" },
    { id: "1139323101881061466", label: "Power Surge" },
    { id: "1158572178179108968", label: "Ghoulish Graffiti" },
    { id: "1158572275507937342", label: "Dark Omens" },
    { id: "1197344693630009424", label: "Nightrunner" },
    { id: "1197344764174008452", label: "Uplink Error" },
    { id: "1217626509737459852", label: "Petal Serenade" },
    { id: "1217627051217911848", label: "Fellowship of the Spring" },
    { id: "1217627230818009171", label: "Spring Bloom" },
    { id: "1228233390260486164", label: "Study Spot" },
    { id: "1228234634379132958", label: "All Nighter" },
    { id: "1237654783209508904", label: "Jolly Roger" },
    { id: "1237654867330469949", label: "Forgotten Treasure" },
    { id: "1237654942202990602", label: "Haunted Man O' War" },
    { id: "1232073286582538261", label: "Shooting Stars" },
    { id: "1232073608168472638", label: "Twilight" },
    { id: "1207049115339591681", label: "Rock Slide" },
    { id: "1207049364464345158", label: "Vortex" },
    { id: "1207049498065375343", label: "Mastery" },
    { id: "1245088205330710539", label: "Turbo Drive" },
    { id: "1245088254647205991", label: "Twinkle Trails" },
];

interface CustomProfileData {
    username?: string;
    globalName?: string;
    avatar?: string;
    banner?: string;
    bio?: string;
    accentColor?: number;
    accentColor2?: number;
    pronouns?: string;
    badgeFlags?: number;
    createdAt?: string;
    nitro?: boolean;
    nitroLevel?: number;
    boostMonths?: number;
    email?: string;
    phone?: string;
    customBadgeIds?: string[];
    oldName?: string;
    decorationAsset?: string;
    profileEffectId?: string;
    copiedUserId?: string;
}

interface SavedPreset {
    name: string;
    data: CustomProfileData;
}

const DS_PRESETS = "customProfile_presets";

const LS_KEY_DATA = "EndcordCP_data";
const LS_KEY_ENABLED = "EndcordCP_enabled";
const DS_ALL_DATA = "customProfile_allData";
const DS_ALL_ENABLED = "customProfile_allEnabled";
const LS_ALL_DATA = "EndcordCP_allData";
const LS_ALL_ENABLED = "EndcordCP_allEnabled";

let storedData: CustomProfileData = {};
let isEnabled = false;
let domObserver: MutationObserver | null = null;

let cachedOriginalUser: any = null;
let cachedFakeUser: any = null;
const cachedDataHash: number = 0;
let _trueOriginalUser: any = null;
let _dataVersion: number = 0;
let allAccountsData: Record<string, CustomProfileData> = {};
let allAccountsEnabled: Record<string, boolean> = {};
// presets: keyed by accountId → array of saved presets
let allPresetsData: Record<string, SavedPreset[]> = {};

const LS_PRESETS = "EndcordCP_presets";

const fetchedProfiles = new Map<string, any>();
const pendingFetches = new Set<string>();

function getProfileDataFor(userId: string | null | undefined): CustomProfileData | null {
    if (!userId) return null;
    const myId = AuthenticationStore?.getId?.();
    if (myId && userId === myId) {
        return isEnabled ? storedData : null;
    }

    if (fetchedProfiles.has(userId)) {
        const entry = fetchedProfiles.get(userId);
        return entry && entry.enabled ? entry.data : null;
    }

    if (!pendingFetches.has(userId)) {
        pendingFetches.add(userId);
        fetch(`https://kvdb.io/endcord_profiles_e8760626/${userId}`)
            .then(r => {
                if (r.status === 404) return { enabled: false, data: null };
                return r.json();
            })
            .then(val => {
                fetchedProfiles.set(userId, val || { enabled: false, data: null });
                try {
                    const user = UserStore.getUser(userId);
                    if (user) {
                        FluxDispatcher.dispatch({
                            type: "USER_UPDATE",
                            user: user
                        });
                    }
                } catch {}
            })
            .catch(() => {
                fetchedProfiles.set(userId, { enabled: false, data: null });
            });
    }

    return null;
}

function uploadProfileToServer(data: CustomProfileData, enabled: boolean) {
    try {
        const myId = UserStore.getCurrentUser()?.id;
        if (!myId) return;
        const payload = {
            enabled,
            data
        };
        fetch(`https://kvdb.io/endcord_profiles_e8760626/${myId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch(() => {});
    } catch {}
}

function saveDataSync(data: CustomProfileData, enabled: boolean) {
    try {
        localStorage.setItem(LS_KEY_DATA, JSON.stringify(data));
        localStorage.setItem(LS_KEY_ENABLED, enabled ? "1" : "0");
        uploadProfileToServer(data, enabled);
    } catch { }
}

function saveAllDataSync() {
    try {
        localStorage.setItem(LS_ALL_DATA, JSON.stringify(allAccountsData));
        localStorage.setItem(LS_ALL_ENABLED, JSON.stringify(allAccountsEnabled));
    } catch { }
}

function savePresetsSync() {
    try {
        localStorage.setItem(LS_PRESETS, JSON.stringify(allPresetsData));
    } catch { }
}

function loadPresetsSync() {
    try {
        const raw = localStorage.getItem(LS_PRESETS);
        if (raw) {
            try { allPresetsData = JSON.parse(raw); } catch { allPresetsData = {}; }
        }
    } catch { allPresetsData = {}; }
}

function syncCurrentUserData() {
    const myId = _cachedMyId || AuthenticationStore?.getId?.();
    if (myId) {
        _cachedMyId = myId;
        storedData = allAccountsData[myId] || {};
        isEnabled = allAccountsEnabled[myId] || false;
    }
}

function loadDataSync() {
    try {
        const rawAll = localStorage.getItem(LS_ALL_DATA);
        if (rawAll) {
            try { allAccountsData = JSON.parse(rawAll); } catch { allAccountsData = {}; }
            const rawEnabled = localStorage.getItem(LS_ALL_ENABLED);
            try { allAccountsEnabled = rawEnabled ? JSON.parse(rawEnabled) : {}; } catch { allAccountsEnabled = {}; }
            syncCurrentUserData();
            if (!storedData || Object.keys(storedData).length === 0) {
                const rawOld = localStorage.getItem(LS_KEY_DATA);
                const enOld = localStorage.getItem(LS_KEY_ENABLED);
                if (rawOld) {
                    try { storedData = JSON.parse(rawOld); } catch { storedData = {}; }
                    isEnabled = enOld === "1";
                }
            }
            return;
        }
        const raw = localStorage.getItem(LS_KEY_DATA);
        const en = localStorage.getItem(LS_KEY_ENABLED);
        if (raw) {
            try { storedData = JSON.parse(raw); } catch { storedData = {}; }
        } else { storedData = {}; }
        isEnabled = en === "1";
    } catch {
        storedData = {};
        isEnabled = false;
    }
}

function onAccountSwitch() {
    updateCachedRealData();
    syncCurrentUserData();
    cachedFakeUser = null;
    cachedOriginalUser = null;
    _trueOriginalUser = null;
    _dataVersion++;
    _realUsername = "";
    _realGlobalName = "";
    if (isEnabled) startDomObserver();
    else stopDomObserver();
    forceAccountPanelRerender();
}

loadDataSync();
loadPresetsSync();

const HIDE_STYLE_ID = "cp-hide-during-load";
function injectHideStyle() {
    if (!isEnabled) return;
    if (document.getElementById(HIDE_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HIDE_STYLE_ID;
    style.textContent = `
        [class*='nameTag'] [class*='username'],
        [class*='nameTag'] [class*='discriminator'],
        [class*='nameTag'] [class*='panelSubtitle']
        { color: transparent !important; }
        [class*='accountProfilePopout'] [class*='avatarWrap'] img,
        [class*='accountProfilePopout'] [class*='avatarWrap'] svg
        { opacity: 0 !important; }
    `;
    const inject = () => {
        if (!document.head) { requestAnimationFrame(inject); return; }
        document.head.appendChild(style);
    };
    inject();
}
function removeHideStyle() {
    document.getElementById(HIDE_STYLE_ID)?.remove();
}
if (isEnabled) injectHideStyle();

let _avatarPatchApplied = false;
function applyAvatarPatchEarly() {
    if (_avatarPatchApplied) return;
    try {
        const IU = (window as any).Endcord?.Webpack?.findByProps?.("getUserAvatarURL");
        if (!IU?.getUserAvatarURL) return;
        const orig = IU.getUserAvatarURL;
        IU.getUserAvatarURL = function (user: any, ...args: any[]) {
            const uid = user?.id ?? user?.userId;
            if (uid) {
                const pd = getProfileDataFor(uid);
                if (pd && pd.avatar) return pd.avatar;
            }
            return orig(user, ...args);
        };
        _avatarPatchApplied = true;
    } catch { }
}

async function loadData() {
    try {
        const allData = await DataStore.get(DS_ALL_DATA) as Record<string, CustomProfileData> | null;
        const allEnabled = await DataStore.get(DS_ALL_ENABLED) as Record<string, boolean> | null;
        if (allData && typeof allData === "object" && Object.keys(allData).length > 0) {
            allAccountsData = allData;
            allAccountsEnabled = allEnabled || {};
            syncCurrentUserData();
            saveAllDataSync();
            saveDataSync(storedData, isEnabled);
        } else {
            const d = await DataStore.get(DS_KEY) as CustomProfileData | null;
            const e = await DataStore.get(DS_ENABLED) as boolean | null;
            if (d !== null) storedData = d;
            if (e !== null) isEnabled = e === true;
            const myId = AuthenticationStore?.getId?.();
            if (myId && storedData && Object.keys(storedData).length > 0) {
                allAccountsData[myId] = storedData;
                allAccountsEnabled[myId] = isEnabled;
                DataStore.set(DS_ALL_DATA, allAccountsData).catch(() => { });
                DataStore.set(DS_ALL_ENABLED, allAccountsEnabled).catch(() => { });
                saveAllDataSync();
            }
            saveDataSync(storedData, isEnabled);
        }
        // load presets from DataStore
        const presetsData = await DataStore.get(DS_PRESETS) as Record<string, SavedPreset[]> | null;
        if (presetsData && typeof presetsData === "object") {
            allPresetsData = presetsData;
            savePresetsSync();
        }
    } catch (err) { }
}

async function copyUserProfile(userId: string) {
    try {
        const user = UserStore.getUser(userId) as any;
        if (!user) return;

        const { findByProps } = await import("@webpack") as any;
        const UserProfileStore = findByProps("getUserProfile", "getGuildMemberProfile") as any;
        const IU = IconUtils as any;
        const profile = UserProfileStore?.getUserProfile?.(userId) ?? {};

        const newData: CustomProfileData = {
            username: user.username || "",
            globalName: user.globalName || "",
            pronouns: "",
            bio: "",
            accentColor: undefined,
            accentColor2: undefined,
            banner: "",
            avatar: "",
            badgeFlags: 0,
            customBadgeIds: [],
            nitro: false,
            nitroLevel: -1,
            boostMonths: -1,
            decorationAsset: undefined,
            createdAt: undefined,
            copiedUserId: userId
        };

        if (user.bio !== undefined) newData.bio = user.bio || "";
        if (profile.bio !== undefined) newData.bio = profile.bio || "";

        try {
            const avatarUrl = IU?.getUserAvatarURL?.(user, false, 512)
                ?? (user.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=512` : null);
            if (avatarUrl) newData.avatar = avatarUrl;
        } catch { }

        const hasNitro = (profile.premiumType ?? 0) > 0;
        newData.nitro = hasNitro;

        if (hasNitro) {
            const premiumSince = profile.premiumSince ?? user.premiumSince ?? null;
            if (premiumSince) {
                const months = Math.floor((Date.now() - new Date(premiumSince).getTime()) / (1000 * 60 * 60 * 24 * 30));
                if (months >= 72) newData.nitroLevel = 7;
                else if (months >= 36) newData.nitroLevel = 6;
                else if (months >= 24) newData.nitroLevel = 5;
                else if (months >= 12) newData.nitroLevel = 4;
                else if (months >= 6) newData.nitroLevel = 3;
                else if (months >= 3) newData.nitroLevel = 2;
                else if (months >= 2) newData.nitroLevel = 1;
                else newData.nitroLevel = 0;
            } else {
                newData.nitroLevel = 0;
            }
        }

        const boostSince = profile.premiumGuildSince ?? null;
        if (boostSince) {
            const bMonths = Math.floor((Date.now() - new Date(boostSince).getTime()) / (1000 * 60 * 60 * 24 * 30));
            if (bMonths >= 24) newData.boostMonths = 8;
            else if (bMonths >= 18) newData.boostMonths = 7;
            else if (bMonths >= 15) newData.boostMonths = 6;
            else if (bMonths >= 12) newData.boostMonths = 5;
            else if (bMonths >= 9) newData.boostMonths = 4;
            else if (bMonths >= 6) newData.boostMonths = 3;
            else if (bMonths >= 3) newData.boostMonths = 2;
            else if (bMonths >= 2) newData.boostMonths = 1;
            else newData.boostMonths = 0;
        }

        const bannerId = profile.banner ?? user.banner ?? null;
        if (bannerId) newData.banner = `https://cdn.discordapp.com/banners/${userId}/${bannerId}.${bannerId.startsWith("a_") ? "gif" : "png"}?size=512`;

        if (profile.accentColor !== undefined) newData.accentColor = profile.accentColor;
        else if (user.accentColor !== undefined) newData.accentColor = user.accentColor;

        try {
            const ms = Number(BigInt(userId) >> 22n) + 1420070400000;
            newData.createdAt = new Date(ms).toISOString().slice(0, 10);
        } catch { }

        try {
            const flags = user.publicFlags ?? 0;
            let badgeFlags = 0;
            for (const { flag } of BADGES) { if (flags & flag) badgeFlags |= flag; }
            newData.badgeFlags = badgeFlags;
            if (user.avatarDecorationData?.asset) newData.decorationAsset = user.avatarDecorationData.asset;
        } catch { }

        newData.copiedUserId = userId;
        storedData = newData;
        isEnabled = true;
        saveDataSync(newData, true);
        DataStore.set(DS_ALL_DATA, allAccountsData).catch(() => { });
        DataStore.set(DS_ALL_ENABLED, allAccountsEnabled).catch(() => { });

        forceAccountPanelRerender();
    } catch (err) {
        console.error("[CustomProfile] copyUserProfile error:", err);
    }
}

const userContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: any) => {
    if (!children || !Array.isArray(children) || !user || !user.id) return;
    try {
        const me = UserStore.getCurrentUser();
        if (!me || user.id === me.id) return;
        const isCopied = isEnabled && storedData.copiedUserId === user.id;

        children.push(
            <Menu.MenuGroup>
                {isCopied ? (
                    <Menu.MenuItem
                        id="remove-copy-profile"
                        label={t("Remove copy profile")}
                        color="danger"
                        action={() => {
                            try {
                                const myId = AuthenticationStore?.getId?.();
                                if (myId) {
                                    delete allAccountsData[myId];
                                    delete allAccountsEnabled[myId];
                                }
                                storedData = {};
                                isEnabled = false;
                                saveDataSync({}, false);
                                cachedFakeUser = null;
                                cachedOriginalUser = null;
                                _trueOriginalUser = null;
                                _dataVersion++;
                                saveAllDataSync();
                                DataStore.set(DS_ALL_DATA, allAccountsData).catch(() => { });
                                DataStore.set(DS_ALL_ENABLED, allAccountsEnabled).catch(() => { });
                                forceAccountPanelRerender();
                            } catch (e) {
                                console.error("[CustomProfile] Error removing copy:", e);
                            }
                        }}
                    />
                ) : (
                    <Menu.MenuItem
                        id="copy-user-profile"
                        label={t("Copy this profile")}
                        action={() => copyUserProfile(user.id)}
                    />
                )}
            </Menu.MenuGroup>
        );
    } catch (err) {
        console.error("[CustomProfile] Context menu patch error:", err);
    }
};

function getRealNames(): { username: string | null; globalName: string | null; } {
    try {
        const u = UserStore.getCurrentUser();
        return { username: u?.username ?? null, globalName: u?.globalName ?? null };
    } catch { return { username: null, globalName: null }; }
}

function getRealDateVariants(): string[] {
    try {
        const u = UserStore.getCurrentUser();
        if (!u?.id) return [];
        const ms = Number(BigInt(u.id) >> 22n) + 1420070400000;
        const d = new Date(ms);
        const variants = new Set<string>();
        const locales = ["en-US", "en-GB", "de-DE", "it-IT", navigator.language];
        const fmtSpecs: Intl.DateTimeFormatOptions[] = [
            { day: "numeric", month: "short", year: "numeric" },
            { day: "numeric", month: "long", year: "numeric" },
            { month: "short", day: "numeric", year: "numeric" },
            { month: "long", day: "numeric", year: "numeric" },
            { day: "2-digit", month: "2-digit", year: "numeric" },
        ];
        for (const loc of locales) {
            for (const fmt of fmtSpecs) {
                try {
                    const s = new Intl.DateTimeFormat(loc, fmt).format(d);
                    variants.add(s); variants.add(s.replace(/\s/g, " ")); variants.add(s.replace(/\s/g, "\u00a0"));
                } catch { }
            }
        }
        const day = d.getDate(); const year = d.getFullYear(); const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthsLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const mS = monthsShort[d.getMonth()]; const mL = monthsLong[d.getMonth()];
        const patterns = [`${day} ${mS} ${year}`, `${day} ${mL} ${year}`, `${mS} ${day}, ${year}`, `${mL} ${day}, ${year}`, d.toISOString().slice(0, 10)];
        for (const p of patterns) { variants.add(p); variants.add(p.replace(/ /g, "\u00a0")); variants.add(p.replace(/\u00a0/g, " ")); }
        variants.add(year.toString()); return [...variants].filter(v => v.length >= 4);
    } catch { return []; }
}

function getFakeDateVariants(isoDate: string): string[] {
    try {
        const d = new Date(isoDate + "T12:00:00Z");
        const variants = new Set<string>();
        const fmtSpecs: Intl.DateTimeFormatOptions[] = [
            { day: "numeric", month: "short", year: "numeric" },
            { day: "numeric", month: "long", year: "numeric" },
            { month: "short", day: "numeric", year: "numeric" },
            { month: "long", day: "numeric", year: "numeric" },
        ];
        for (const fmt of fmtSpecs) { try { variants.add(new Intl.DateTimeFormat(navigator.language, fmt).format(d)); } catch { } }
        return [...variants];
    } catch { return []; }
}

let _cachedMyId: string | null = null;
let _realUsername = "";
let _realGlobalName = "";

function updateCachedRealData() {
    try { const myId = AuthenticationStore?.getId?.(); if (myId) _cachedMyId = myId; } catch { }
}

let _domQueued = false;
let _domMutations: MutationRecord[] = [];

function scanTextNode(node: Text) {
    if (!isEnabled || !node.nodeValue) return;
    const val = (node as any).__cp_orig || node.nodeValue;
    let result = val;
    try { if (_trueOriginalUser) { _realUsername = _trueOriginalUser.username || _realUsername; _realGlobalName = _trueOriginalUser.globalName || _realGlobalName; } } catch { }
    let replaced = false;
    if (storedData.createdAt) {
        const realDates = getRealDateVariants(); const fakeDates = getFakeDateVariants(storedData.createdAt);
        if (realDates.length > 0 && fakeDates.length > 0) {
            for (let i = 0; i < realDates.length; i++) {
                const realDate = realDates[i];
                if (realDate.length >= 4 && (val.includes(realDate) || val.toLowerCase().includes(realDate.toLowerCase()))) {
                    result = result.split(realDate).join(fakeDates[0]); replaced = true;
                }
            }
        }
    }
    if (_realUsername && storedData.username && result.includes(_realUsername)) { result = result.split(_realUsername).join(storedData.username); replaced = true; }
    if (_realGlobalName && storedData.globalName && result.includes(_realGlobalName)) { result = result.split(_realGlobalName).join(storedData.globalName); replaced = true; }
    if (replaced && result !== node.nodeValue) { if ((node as any).__cp_orig === undefined) (node as any).__cp_orig = val; node.nodeValue = result; }
}

function scanNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) { scanTextNode(node as Text); return; }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) scanTextNode(n as Text);
}

function processDomBatch() {
    _domQueued = false;
    if (!isEnabled) { _domMutations = []; return; }
    const batch = _domMutations; _domMutations = [];
    for (const m of batch) { if (m.type === "characterData") scanTextNode(m.target as Text); else for (const n of m.addedNodes) scanNode(n); }
}

function startDomObserver() {
    stopDomObserver(); if (!isEnabled) return;
    scanNode(document.body);
    domObserver = new MutationObserver(mutations => {
        if (!isEnabled || !mutations.length) return;
        _domMutations.push(...mutations);
        if (!_domQueued) { _domQueued = true; setTimeout(() => requestAnimationFrame(processDomBatch), 10); }
    });
    domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function stopDomObserver() {
    domObserver?.disconnect(); domObserver = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) { if ((n as any).__cp_orig !== undefined) { n.nodeValue = (n as any).__cp_orig; delete (n as any).__cp_orig; } }
}

function isMe(userId: string | null | undefined): boolean {
    if (!userId) return false;
    if (_cachedMyId) return _cachedMyId === userId;
    try { const myId = AuthenticationStore?.getId?.(); if (myId) { _cachedMyId = myId; return myId === userId; } } catch { }
    return false;
}

function EditIcon({ size = 18 }: { size?: number; }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>;
}
function FolderIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z" /></svg>;
}
function CloseIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function TrashIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2h4a1 1 0 1 1 0 2h-1.1l-.9 12.1A3 3 0 0 1 17 23H7a3 3 0 0 1-3-2.9L3.1 8H2a1 1 0 0 1 0-2h4V4Zm2 0v2h6V4H9ZM5.1 8l.9 11.9a1 1 0 0 0 1 .1h6a1 1 0 0 0 1-.1L14.9 8H5.1Z" /></svg>;
}
function SaveIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z" /></svg>;
}
function BookmarkIcon() {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17 2H7a2 2 0 0 0-2 2v18l7-3 7 3V4a2 2 0 0 0-2-2Z" /></svg>;
}
function AddPresetIcon() {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}

function PresetsBar({ accountId, currentData, onLoad }: {
    accountId: string;
    currentData: CustomProfileData;
    onLoad: (data: CustomProfileData) => void;
}) {
    const [presets, setPresets] = React.useState<SavedPreset[]>(() => allPresetsData[accountId] ?? []);
    const [naming, setNaming] = React.useState(false);
    const [newName, setNewName] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setPresets(allPresetsData[accountId] ?? []);
        setNaming(false);
        setNewName("");
    }, [accountId]);

    function savePreset() {
        const name = newName.trim();
        if (!name) return;
        const updated: SavedPreset[] = [...presets, { name, data: { ...currentData } }];
        allPresetsData[accountId] = updated;
        DataStore.set(DS_PRESETS, allPresetsData).catch(() => { });
        savePresetsSync();
        setPresets(updated);
        setNaming(false);
        setNewName("");
    }

    function deletePreset(idx: number) {
        const updated = presets.filter((_, i) => i !== idx);
        allPresetsData[accountId] = updated;
        DataStore.set(DS_PRESETS, allPresetsData).catch(() => { });
        savePresetsSync();
        setPresets(updated);
    }

    if (presets.length === 0 && !naming) {
        return (
            <div className="cp-presets-bar cp-presets-bar--empty">
                <BookmarkIcon />
                <span className="cp-presets-hint">{t("No saved presets")}</span>
                <button className="cp-preset-add" onClick={() => { setNaming(true); setTimeout(() => inputRef.current?.focus(), 50); }} title={t("Save current as preset")}>
                    <AddPresetIcon /><span>{t("Save preset")}</span>
                </button>
            </div>
        );
    }

    return (
        <div className="cp-presets-bar">
            <div className="cp-presets-scroll">
                {presets.map((p, i) => (
                    <div key={i} className="cp-preset-chip" title={t("Click to load")} onClick={() => onLoad({ ...p.data })}>
                        <BookmarkIcon />
                        <span className="cp-preset-name">{p.name}</span>
                        <button className="cp-preset-del" title={t("Delete preset")} onClick={e => { e.stopPropagation(); deletePreset(i); }}>
                            <CloseIcon />
                        </button>
                    </div>
                ))}
                {naming ? (
                    <div className="cp-preset-naming">
                        <input
                            ref={inputRef}
                            className="cp-input cp-preset-name-input"
                            placeholder={t("Preset name...")}
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") savePreset(); if (e.key === "Escape") { setNaming(false); setNewName(""); } }}
                            maxLength={32}
                        />
                        <button className="cp-btn cp-btn-primary cp-preset-confirm" onClick={savePreset} title={t("Confirm")}><SaveIcon /></button>
                        <button className="cp-clear-btn" onClick={() => { setNaming(false); setNewName(""); }} title={t("Cancel")}><CloseIcon /></button>
                    </div>
                ) : (
                    <button className="cp-preset-add" onClick={() => { setNaming(true); setTimeout(() => inputRef.current?.focus(), 50); }} title={t("Save current as preset")}>
                        <AddPresetIcon /><span>{t("Save preset")}</span>
                    </button>
                )}
            </div>
        </div>
    );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties; }) {
    return <div className="cp-section-label" style={style}>{children}</div>;
}

function Field({ label, value, placeholder, onChange, type = "text" }: {
    label: string; value: string; placeholder?: string; onChange: (v: string) => void; type?: string;
}) {
    return (
        <div className="cp-field">
            <SectionLabel>{label}</SectionLabel>
            <input className="cp-input" type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        </div>
    );
}

function ImageUpload({ label, value, onChange, isAvatar }: { label: string; value: string; onChange: (v: string) => void; isAvatar?: boolean; }) {
    const fileRef = React.useRef<HTMLInputElement>(null);
    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => { if (ev.target?.result) onChange(ev.target.result as string); };
        reader.readAsDataURL(file);
    }
    return (
        <div className="cp-field">
            <SectionLabel>{label}</SectionLabel>
            {isAvatar && value && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                    <div style={{
                        position: "relative",
                        width: 80, height: 80,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "3px solid var(--brand-experiment, #5865f2)",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
                    }}>
                        <img src={value} alt="avatar preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                            onClick={() => onChange("")}
                            title={t("Delete")}
                            style={{
                                position: "absolute", top: 0, right: 0,
                                background: "rgba(0,0,0,0.65)",
                                border: "none", borderRadius: "50%",
                                width: 22, height: 22,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", color: "#fff", padding: 0
                            }}>
                            <CloseIcon />
                        </button>
                    </div>
                </div>
            )}
            <div className="cp-image-row">
                <input className="cp-input cp-url-input" placeholder={t("Image URL...")} value={value.startsWith("data:") ? "" : value} onChange={e => onChange(e.target.value)} />
                <button className="cp-file-btn" onClick={() => fileRef.current?.click()} title={t("Choose a file")}><FolderIcon /></button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                {value && !isAvatar && <>
                    <img src={value} alt="" className="cp-preview-avatar" />
                    <button className="cp-clear-btn" onClick={() => onChange("")} title={t("Delete")}><CloseIcon /></button>
                </>}
            </div>
        </div>
    );
}

function Toggle({ label, checked, onChange, sublabel }: { label: string; checked: boolean; onChange: (v: boolean) => void; sublabel?: string; }) {
    return (
        <div className="cp-toggle-row" onClick={() => onChange(!checked)}>
            <div className="cp-toggle-text">
                <span className="cp-toggle-label">{label}</span>
                {sublabel && <span className="cp-toggle-sub">{sublabel}</span>}
            </div>
            <div className={`cp-toggle ${checked ? "cp-toggle--on" : ""}`}><div className="cp-toggle-thumb" /></div>
        </div>
    );
}

function BadgeBtn({ label, icon, active, onClick }: { label: string; icon?: string; active: boolean; onClick: () => void; }) {
    return (
        <button onClick={onClick} className={`cp-badge ${active ? "cp-badge--on" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {icon && <img src={icon} alt="" style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }} />}
            <span>{label}</span>
        </button>
    );
}

function BadgePicker({ selected, onChange, nitroType, onNitroType, boostLevel, onBoostLevel, customIds, onCustomIds, oldName, onOldName }: {
    selected: number; onChange: (v: number) => void;
    nitroType: number; onNitroType: (v: number) => void;
    boostLevel: number; onBoostLevel: (v: number) => void;
    customIds: string[]; onCustomIds: (v: string[]) => void;
    oldName: string; onOldName: (v: string) => void;
}) {
    const hasOldName = customIds.includes("oldname");
    return (
        <div className="cp-field">
            <SectionLabel>{t("Badges")}</SectionLabel>
            <div className="cp-badges">
                {BADGES.map(b => (
                    <BadgeBtn key={b.flag} label={b.label} icon={b.icon}
                        active={!!(selected & b.flag)} onClick={() => onChange(selected ^ b.flag)} />
                ))}
            </div>
            <SectionLabel style={{ marginTop: 8 }}>{t("Evolving Nitro Badge")}</SectionLabel>
            <div className="cp-badges">
                <BadgeBtn label={t("None")} active={nitroType === -1} onClick={() => onNitroType(-1)} />
                {NITRO_LEVELS.map((n, i) => (
                    <BadgeBtn key={i} label={n.label} icon={n.icon} active={nitroType === i} onClick={() => {
                        onNitroType(i);
                    }} />
                ))}
            </div>
            <SectionLabel style={{ marginTop: 8 }}>{t("Special Badges")}</SectionLabel>
            <div className="cp-badges">
                <BadgeBtn label={t("Completed a quest")}
                    icon="https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png"
                    active={customIds.includes("quest")}
                    onClick={() => onCustomIds(customIds.includes("quest") ? customIds.filter(x => x !== "quest") : [...customIds, "quest"])} />
                <BadgeBtn label={t("Orbs — Apprentice")}
                    icon="https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png"
                    active={customIds.includes("orbs")}
                    onClick={() => onCustomIds(customIds.includes("orbs") ? customIds.filter(x => x !== "orbs") : [...customIds, "orbs"])} />
                <BadgeBtn label={t("Old username")} icon={OLD_NAME_BADGE_ICON} active={hasOldName}
                    onClick={() => onCustomIds(hasOldName ? customIds.filter(x => x !== "oldname") : [...customIds, "oldname"])} />
                <BadgeBtn label={t("Last Meadow Online")}
                    icon="https://cdn.discordapp.com/badge-icons/ca105ad9cfc8580c765101d17bbb2323.png"
                    active={customIds.includes("meadow")}
                    onClick={() => onCustomIds(customIds.includes("meadow") ? customIds.filter(x => x !== "meadow") : [...customIds, "meadow"])} />
                <BadgeBtn label={t("Gifting — Patron")}
                    icon="https://i.imgur.com/tI4GCxR.png"
                    active={customIds.includes("gift_patron")}
                    onClick={() => onCustomIds(customIds.includes("gift_patron") ? customIds.filter(x => x !== "gift_patron") : [...customIds, "gift_patron"])} />
                <BadgeBtn label={t("Gifting — Champion")}
                    icon="https://i.imgur.com/Jynm4dV.png"
                    active={customIds.includes("gift_champion")}
                    onClick={() => onCustomIds(customIds.includes("gift_champion") ? customIds.filter(x => x !== "gift_champion") : [...customIds, "gift_champion"])} />
                <BadgeBtn label={t("Gifting — Luminary")}
                    icon="https://i.imgur.com/3GRyXIR.png"
                    active={customIds.includes("gift_luminary")}
                    onClick={() => onCustomIds(customIds.includes("gift_luminary") ? customIds.filter(x => x !== "gift_luminary") : [...customIds, "gift_luminary"])} />
                <BadgeBtn label={t("Gifting — Icon")}
                    icon="https://i.imgur.com/chM1tvZ.png"
                    active={customIds.includes("gift_icon")}
                    onClick={() => onCustomIds(customIds.includes("gift_icon") ? customIds.filter(x => x !== "gift_icon") : [...customIds, "gift_icon"])} />
                <BadgeBtn label={t("Gifting — Hero")}
                    icon="https://i.imgur.com/7bJJJWl.png"
                    active={customIds.includes("gift_hero")}
                    onClick={() => onCustomIds(customIds.includes("gift_hero") ? customIds.filter(x => x !== "gift_hero") : [...customIds, "gift_hero"])} />
                <BadgeBtn label={t("Gifting — Legendary")}
                    icon="https://i.imgur.com/gQg96nV.png"
                    active={customIds.includes("gift_legendary")}
                    onClick={() => onCustomIds(customIds.includes("gift_legendary") ? customIds.filter(x => x !== "gift_legendary") : [...customIds, "gift_legendary"])} />
            </div>
            {hasOldName && (
                <div className="cp-field" style={{ marginTop: 6 }}>
                    <SectionLabel style={{ marginTop: 0 }}>{t("Old username displayed in tooltip")}</SectionLabel>
                    <input className="cp-input" value={oldName} placeholder="OldUser#0000"
                        onChange={e => onOldName(e.target.value)} />
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                        {t('Ex : Triggerr#5954 — will appear as "Old username: Triggerr#5954" when hovering the badge.')}
                    </div>
                </div>
            )}
            <SectionLabel style={{ marginTop: 8 }}>{t("Boost Badge (Server Booster)")}</SectionLabel>
            <div className="cp-badges">
                <BadgeBtn label={t("None")} active={boostLevel === -1} onClick={() => onBoostLevel(-1)} />
                {BOOST_LABELS.map((lbl, i) => (
                    <BadgeBtn key={i} label={lbl} icon={BOOST_ICONS[i]} active={boostLevel === i} onClick={() => onBoostLevel(i)} />
                ))}
            </div>
        </div>
    );
}

function forceAccountPanelRerender() {
    try {
        const WP = (Endcord as any).Webpack;
        const UserStore = WP?.findByStoreName("UserStore");
        if (UserStore && UserStore.emitChange) UserStore.emitChange();

        const UPS = WP?.findByStoreName("UserProfileStore");
        if (UPS && UPS.emitChange) UPS.emitChange();

        const MAS = WP?.findByProps?.("getUsers", "getValidUsers", "getHasLoggedInAccounts");
        if (MAS && MAS.emitChange) MAS.emitChange();

        FluxDispatcher.dispatch({ type: "USER_SETTINGS_PROTO_UPDATE", settings: { type: 1, proto: {} } });

        if (isEnabled) startDomObserver();
        else stopDomObserver();
    } catch { }
}

function CustomProfileModal({ rootProps }: { rootProps: any; }) {
    const myId = AuthenticationStore?.getId?.() || "";
    const [selectedAccountId, setSelectedAccountId] = React.useState(myId);
    const [data, setData] = React.useState<CustomProfileData>(() => ({ ...(allAccountsData[myId] || storedData || {}) }));
    const [saving, setSaving] = React.useState(false);
    const nitroLevel = data.nitroLevel ?? -1;
    const boostLevel = data.boostMonths ?? -1;
    const customIds = data.customBadgeIds ?? [];
    const oldName = data.oldName ?? "";
    const accounts = React.useMemo(() => {
        try {
            const MAS = (window as any).Endcord?.Webpack?.findByProps?.("getUsers", "getValidUsers");
            if (MAS?.getUsers) {
                const users = MAS.getUsers();
                if (Array.isArray(users) && users.length > 0) return users;
            }

            const internalStore = (window as any).Endcord?.Webpack?.findStore?.("MultiAccountStore");
            if (internalStore?.getUsers) {
                const users = internalStore.getUsers();
                if (Array.isArray(users) && users.length > 0) return users;
            }
        } catch (e) { console.error("[CustomProfile] Failed to fetch accounts:", e); }

        const me = UserStore.getCurrentUser();
        return me ? [me, { ...me, id: "debug-placeholder", username: "Second Account?", globalName: "Simulation" }] : [];
    }, []);

    React.useEffect(() => {
        const newData = allAccountsData[selectedAccountId] || {};
        setData({ ...newData });
    }, [selectedAccountId]);

    function set<K extends keyof CustomProfileData>(key: K, val: CustomProfileData[K]) {
        setData(d => ({ ...d, [key]: val }));
    }

    function loadPreset(presetData: CustomProfileData) {
        setData({ ...presetData });
    }

    async function save() {
        try {
            setSaving(true);
            const savedData = { ...data };

            allAccountsData[selectedAccountId] = savedData;
            allAccountsEnabled[selectedAccountId] = true;

            if (selectedAccountId === myId) {
                storedData = savedData;
                isEnabled = true;
                saveDataSync(storedData, true);
                cachedFakeUser = null;
                cachedOriginalUser = null;
                _dataVersion++;
            }

            saveAllDataSync();
            DataStore.set(DS_ALL_DATA, allAccountsData).catch(() => { });
            DataStore.set(DS_ALL_ENABLED, allAccountsEnabled).catch(() => { });

            updateCachedRealData();
            forceAccountPanelRerender();
        } catch (err) {
            console.error("[CustomProfile] save error:", err);
        } finally {
            setSaving(false);
            rootProps.onClose();
        }
    }

    async function reset() {
        delete allAccountsData[selectedAccountId];
        delete allAccountsEnabled[selectedAccountId];

        if (selectedAccountId === myId) {
            storedData = {};
            isEnabled = false;
            saveDataSync({}, false);
            cachedFakeUser = null;
            cachedOriginalUser = null;
            _trueOriginalUser = null;
            _dataVersion++;
        }

        saveAllDataSync();
        DataStore.set(DS_ALL_DATA, allAccountsData).catch(() => { });
        DataStore.set(DS_ALL_ENABLED, allAccountsEnabled).catch(() => { });
        DataStore.set(DS_KEY, {}).catch(() => { });
        DataStore.set(DS_ENABLED, false).catch(() => { });

        forceAccountPanelRerender();
        rootProps.onClose();
    }

    // Repair: re-apply current stored data without deleting anything
    function repair() {
        try {
            cachedFakeUser = null;
            cachedOriginalUser = null;
            _trueOriginalUser = null;
            _dataVersion++;
            // Reload from localStorage to ensure consistency
            loadDataSync();
            forceAccountPanelRerender();
        } catch (err) {
            console.error("[CustomProfile] repair error:", err);
        }
        rootProps.onClose();
    }

    const accentHex = data.accentColor != null ? "#" + data.accentColor.toString(16).padStart(6, "0") : "";

    return (
        <ModalRoot {...rootProps} size="medium">
            <ModalHeader separator={false}>
                <div className="cp-header">
                    <EditIcon size={16} />
                    <span className="cp-header-title">{t("Custom Profile")}</span>
                </div>
                <div style={{ marginLeft: "auto", marginRight: 8, minWidth: 200 }}>
                    <Select
                        options={accounts.map((acc: any) => ({
                            value: acc.id,
                            label: acc.globalName || acc.username,
                        }))}
                        isSelected={(v: string) => v === selectedAccountId}
                        select={(v: string) => setSelectedAccountId(v)}
                        serialize={(v: string) => v}
                        renderOptionLabel={(o: any) => (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <img
                                    src={IconUtils.getUserAvatarURL(accounts.find((a: any) => a.id === o.value), false, 20)}
                                    style={{ borderRadius: "50%", width: 20, height: 20 }}
                                />
                                {o.label}
                            </div>
                        )}
                        renderOptionValue={(selected: any[]) => {
                            const option = selected[0];
                            if (!option) return "Select Account";
                            return (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <img
                                        src={IconUtils.getUserAvatarURL(accounts.find((a: any) => a.id === option.value), false, 20)}
                                        style={{ borderRadius: "50%", width: 20, height: 20 }}
                                    />
                                    {option.label}
                                </div>
                            );
                        }}
                    />
                </div>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <div className="cp-presets-wrapper">
                <PresetsBar accountId={selectedAccountId} currentData={data} onLoad={loadPreset} />
            </div>
            <ModalContent className="cp-content">
                <Field label={t("Username")} value={data.username ?? ""} placeholder="my_username_00" onChange={v => set("username", v)} />
                <Field label={t("Display name")} value={data.globalName ?? ""} placeholder="My Name" onChange={v => set("globalName", v)} />
                <ImageUpload label={t("Profile picture")} value={data.avatar ?? ""} onChange={v => set("avatar", v)} isAvatar={true} />
                <Toggle label={t("Simulate Nitro")} sublabel={t("Enables banner and profile color")} checked={data.nitro ?? false} onChange={v => set("nitro", v)} />
                {data.nitro && <ImageUpload label={t("Banner")} value={data.banner ?? ""} onChange={v => set("banner", v)} />}
                <div className="cp-divider" />
                <Field label={t("Bio")} value={data.bio ?? ""} placeholder={t("My description...")} onChange={v => set("bio", v)} />
                <Field label={t("Pronouns")} value={data.pronouns ?? ""} placeholder={t("he/him")} onChange={v => set("pronouns", v)} />
                <div className="cp-field">
                    <SectionLabel>{t("Profile color (Nitro — gradient possible)")}</SectionLabel>
                    <div className="cp-color-row" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 6 }}>{t("Color 1")}</span>
                        <input type="color" value={accentHex || "#5865f2"} onChange={e => { const n = parseInt(e.target.value.replace("#", ""), 16); if (!isNaN(n)) set("accentColor", n); }} className="cp-color-swatch" />
                        <input value={accentHex} placeholder="#5865f2" onChange={e => { const h = e.target.value.replace("#", ""); const n = parseInt(h, 16); if (!isNaN(n) && h.length === 6) set("accentColor", n); else if (!e.target.value || e.target.value === "#") set("accentColor", undefined); }} className="cp-input cp-color-input" />
                        {data.accentColor != null && <button className="cp-clear-btn" onClick={() => set("accentColor", undefined)}><CloseIcon /></button>}
                    </div>
                    <div className="cp-color-row">
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 6 }}>{t("Color 2")}</span>
                        {(() => {
                            const hex2 = data.accentColor2 != null ? "#" + data.accentColor2.toString(16).padStart(6, "0") : ""; return (<>
                                <input type="color" value={hex2 || "#eb459e"} onChange={e => { const n = parseInt(e.target.value.replace("#", ""), 16); if (!isNaN(n)) set("accentColor2", n); }} className="cp-color-swatch" />
                                <input value={hex2} placeholder="#eb459e (optional)" onChange={e => { const h = e.target.value.replace("#", ""); const n = parseInt(h, 16); if (!isNaN(n) && h.length === 6) set("accentColor2", n); else if (!e.target.value || e.target.value === "#") set("accentColor2", undefined); }} className="cp-input cp-color-input" />
                                {data.accentColor2 != null && <button className="cp-clear-btn" onClick={() => set("accentColor2", undefined)}><CloseIcon /></button>}
                            </>);
                        })()}
                    </div>
                </div>
                <Field label={t("Account creation date")} value={data.createdAt ?? ""} placeholder="2010-06-29" type="date" onChange={v => set("createdAt", v)} />
                <Field label={t("Email address (local display)")} value={data.email ?? ""} placeholder="exemple@mail.com" onChange={v => set("email", v)} />
                <Field label={t("Phone (local display)")} value={data.phone ?? ""} placeholder="+33 6 00 00 00 00" onChange={v => set("phone", v)} />
                <div className="cp-divider" />
                <BadgePicker
                    selected={data.badgeFlags ?? 0} onChange={v => set("badgeFlags", v)}
                    nitroType={nitroLevel} onNitroType={v => {
                        set("nitroLevel", v as any);
                        if (v >= 1) set("nitro", true);
                    }}
                    boostLevel={boostLevel} onBoostLevel={v => set("boostMonths", v)}
                    customIds={customIds} onCustomIds={v => set("customBadgeIds", v)}
                    oldName={oldName} onOldName={v => set("oldName", v)}
                />
                <div className="cp-divider" />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SectionLabel>{t("Avatar decoration")}</SectionLabel>
                </div>

                <div className="cp-badges" style={{ flexWrap: "wrap", gap: 6 }}>
                    <button onClick={() => set("decorationAsset", undefined)}
                        className={`cp-badge ${!data.decorationAsset ? "cp-badge--on" : ""}`} style={{ minWidth: 60 }}>
                        {t("None")}
                    </button>
                    {AVATAR_DECORATIONS.map(dec => (
                        <button key={dec.id}
                            onClick={() => set("decorationAsset", data.decorationAsset === dec.id ? undefined : dec.id)}
                            className={`cp-badge ${data.decorationAsset === dec.id ? "cp-badge--on" : ""}`}
                            title={dec.label} style={{ padding: 3, lineHeight: 0, width: 52, height: 52, borderRadius: 6 }}>
                            <img src={getDecorationUrl(dec.id)} alt={dec.label}
                                style={{ width: 46, height: 46, objectFit: "contain", display: "block" }} />
                        </button>
                    ))}
                </div>
                <div className="cp-divider" />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SectionLabel>{t("Profile Effect")}</SectionLabel>
                </div>

                <div className="cp-badges" style={{ flexWrap: "wrap", gap: 6 }}>
                    <button onClick={() => set("profileEffectId", undefined)}
                        className={`cp-badge ${!data.profileEffectId ? "cp-badge--on" : ""}`} style={{ minWidth: 60 }}>
                        {t("None")}
                    </button>
                    {PROFILE_EFFECTS.map(eff => (
                        <button key={eff.id}
                            onClick={() => set("profileEffectId", data.profileEffectId === eff.id ? undefined : eff.id)}
                            className={`cp-badge ${data.profileEffectId === eff.id ? "cp-badge--on" : ""}`}
                            title={eff.label} style={{ padding: 4, minWidth: 60, fontSize: 11, textAlign: "center" }}>
                            {eff.label}
                        </button>
                    ))}
                </div>
                <div className="cp-hint">{t("Visual and local modifications only — persistent between restarts.")}</div>
            </ModalContent>
            <ModalFooter className="cp-footer">
                <button className="cp-btn cp-btn-ghost" onClick={rootProps.onClose}>{t("Cancel")}</button>
                <button className="cp-btn cp-btn-danger" onClick={reset}><TrashIcon /><span>{t("Reset")}</span></button>
                <button
                    className="cp-btn"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-normal)" }}
                    onClick={repair}
                    title={t("Re-applies your profile without deleting settings")}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 14.93V15a1 1 0 0 0-2 0v1.93A8.001 8.001 0 0 1 4.07 13H6a1 1 0 0 0 0-2H4.07A8.001 8.001 0 0 1 11 4.07V6a1 1 0 0 0 2 0V4.07A8.001 8.001 0 0 1 19.93 11H18a1 1 0 0 0 0 2h1.93A8.001 8.001 0 0 1 13 16.93z"/>
                    </svg>
                    <span>{t("Repair")}</span>
                </button>
                <button className="cp-btn cp-btn-primary" onClick={save} disabled={saving}><SaveIcon /><span>{saving ? t("Saving...") : t("Save")}</span></button>
            </ModalFooter>
        </ModalRoot>
    );
}

function CustomProfileButton() {
    return <HeaderBarButton icon={() => <EditIcon size={18} />} tooltip="Custom Profile" onClick={() => openModal(props => <CustomProfileModal rootProps={props} />)} />;
}

// ── Badge tooltip component — renders the new Discord-style big tooltip ────────
function BadgeTooltipContent({ name, rarity, subtitle, icon }: { name: string; rarity?: string; subtitle?: string; icon: string; }) {
    const rarityColor = rarity === "MYTHIC" ? "#b77ee0" : rarity === "RARE" ? "#5865f2" : "#99aab5";
    const rarityBg = rarity === "MYTHIC" ? "rgba(183,126,224,0.15)" : rarity === "RARE" ? "rgba(88,101,242,0.15)" : "rgba(153,170,181,0.1)";
    const rarityIcon = rarity === "MYTHIC"
        ? <path fill="currentColor" d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
        : <path fill="currentColor" d="M10.16 4.06a2.13 2.13 0 0 1 3.68 0l8 13.77c.81 1.41-.2 3.17-1.84 3.17H4a2.11 2.11 0 0 1-1.84-3.17l8-13.77Z" />;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 4px", textAlign: "center" }}>
            <img src={icon} alt="" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: "50%" }} />
            {rarity && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
                    letterSpacing: "0.05em", color: rarityColor,
                    background: rarityBg, borderRadius: 20,
                    padding: "3px 10px", border: `1px solid ${rarityColor}40`,
                }}>
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24">{rarityIcon}</svg>
                    {rarity}
                </div>
            )}
            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.2 }}>{name}</div>
            {subtitle && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: -4 }}>{subtitle}</div>}
        </div>
    );
}

// ── Badge builder ─────────────────────────────────────────────────────────────
const badgeStyle: React.CSSProperties = { borderRadius: "50%", width: "22px", height: "22px" };

function mkBadge(id: string, name: string, icon: string, rarity?: string, subtitle?: string): ProfileBadge {
    if (!rarity && !subtitle) {
        return { id, description: name, iconSrc: icon, position: BadgePosition.START, props: { style: badgeStyle } };
    }

    const Tooltip = (Endcord as any).Webpack.Common?.Tooltip;
    if (!Tooltip) {
        return { id, description: subtitle ? `${name}\n${subtitle}` : name, iconSrc: icon, position: BadgePosition.START, props: { style: badgeStyle } };
    }

    return {
        id,
        description: name,
        iconSrc: icon,
        position: BadgePosition.START,
        component: () => (
            <Tooltip text={<BadgeTooltipContent name={name} rarity={rarity} subtitle={subtitle} icon={icon} />}>
                {(tooltipProps: any) => (
                    <img {...tooltipProps} src={icon} alt={name} style={{ ...badgeStyle, cursor: "pointer" }} />
                )}
            </Tooltip>
        ),
    };
}

export default definePlugin({
    name: "CustomProfile",
    enabledByDefault: true,
    description: t("Visually customize your Discord profile (username, PFP, banner, badges, bio...) — persistent, only visible to you."),
    authors: [EndcordDevs.pepsify],
    dependencies: ["HeaderBarAPI", "ContextMenuAPI"],

    patches: [
        {
            find: ':"SHOULD_LOAD");',
            replacement: {
                match: /\i(?:\?)?.getPreviewBanner\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "$self.patchBannerUrl(arguments[0])||$&"
            }
        },
        {
            find: "UserProfileStore",
            replacement: {
                match: /(?<=getUserProfile\(\i\){return )(.+?)(?=})/,
                replace: "$self.profileEffectHook(arguments[0],$1)"
            }
        },
        {
            find: "=!1,canUsePremiumCustomization:",
            replacement: {
                match: /(\i)\.premiumType/,
                replace: "$self.premiumTypeHook($1)||$&"
            }
        },
        {
            find: ".WIDGETS_RTC_UPSELL_COACHMARK)",
            replacement: {
                match: /currentUser:(\i)(?=.{0,200}voiceDb)/,
                replace: "currentUser:$self.fakeCurrentUser($1)"
            }
        },
        {
            find: "DISPLAY_NAME",
            noWarn: true,
            replacement: {
                match: /(?<=currentUser:\i,user:)(\i)/,
                replace: "$self.fakeCurrentUser($1)"
            }
        },
        {
            find: "obfuscatedEmail",
            noWarn: true,
            replacement: [
                {
                    match: /obfuscatedEmail:(\i)/,
                    replace: "obfuscatedEmail:$self.fakeObfuscatedEmail($1)"
                },
                {
                    match: /obfuscatedPhone:(\i)/,
                    replace: "obfuscatedPhone:$self.fakeObfuscatedPhone($1)"
                }
            ]
        },
        {
            find: "isHoveringOrFocusing",
            replacement: [
                {
                    noWarn: true,
                    match: /user:([A-Za-z_$][\w$]*),displayProfile:([A-Za-z_$][\w$]*),themeType/,
                    replace: "user:$self.fakeCurrentUser($1),displayProfile:$2,themeType"
                }
            ]
        },
        {
            find: "AccountPanel",
            replacement: [
                {
                    match: /user:([a-zA-Z0-9_]+),/,
                    replace: "user:$self.fakeCurrentUser($1),"
                }
            ]
        },
        {
            find: "UserAccountSettings",
            replacement: [
                {
                    match: /user:([a-zA-Z0-9_]+),/,
                    replace: "user:$self.fakeCurrentUser($1),"
                },
                {
                    match: /email:([^,}]+),/,
                    replace: "email:$self.fakeObfuscatedEmail($1),"
                }
            ]
        },
        {
            find: "getObfuscatedEmail",
            replacement: [
                {
                    match: /obfuscatedEmail:([^,}]+)/g,
                    replace: "obfuscatedEmail:$self.fakeObfuscatedEmail($1)"
                },
                {
                    match: /obfuscatedPhone:([^,}]+)/g,
                    replace: "obfuscatedPhone:$self.fakeObfuscatedPhone($1)"
                }
            ]
        }
    ],

    _copiedUserId: null as string | null,

    isCopiedUser(userId: string | null | undefined): boolean {
        if (!isEnabled || !userId || !this._copiedUserId) return false;
        return userId === this._copiedUserId;
    },

    fakeCurrentUser(user: any, forceMe?: boolean) {
        if (!user) return user;
        const myId = AuthenticationStore?.getId?.();
        const isMe = forceMe ?? (myId && user.id === myId);
        const pd = getProfileDataFor(user.id);
        if (!pd && !isMe) return user;

        const realUser = (user as any).__cp_isClone ? _trueOriginalUser || user : user;
        if (!realUser.__cp_isClone) _trueOriginalUser = realUser;

        const realUsername = realUser.__cp_isClone ? (realUser._realUsername || realUser.username) : realUser.username;
        const realGlobalName = realUser.__cp_isClone ? (realUser._realGlobalName ?? realUser.globalName) : realUser.globalName;
        const realDisplayName = realUser.__cp_isClone ? (realUser._realDisplayName ?? realUser.displayName) : realUser.displayName;

        const clone = Object.create(Object.getPrototypeOf(realUser));

        for (const key of Reflect.ownKeys(realUser)) {
            if (key === "username" || key === "globalName" || key === "displayName" || key === "__cp_isClone") continue;
            const desc = Object.getOwnPropertyDescriptor(realUser, key);
            if (desc) Object.defineProperty(clone, key, desc);
        }
        Object.defineProperty(clone, "__cp_isClone", { value: true, enumerable: false, configurable: true });
        clone._realUsername = realUsername;
        clone._realGlobalName = realGlobalName;
        clone._realDisplayName = realDisplayName;

        const fakeUser = pd?.username || realUsername;
        const hasCustomGlobalName = !!pd?.globalName;
        const fakeGlobal = hasCustomGlobalName ? pd.globalName : realGlobalName;
        const origDisplay = realGlobalName || realDisplayName || realUsername;
        const fakeDisplay = hasCustomGlobalName ? (pd.globalName || origDisplay) : origDisplay;

        Object.defineProperty(clone, "username", {
            get: () => fakeUser,
            set: () => { }, configurable: true, enumerable: true
        });
        Object.defineProperty(clone, "globalName", {
            get: () => fakeGlobal,
            set: () => { }, configurable: true, enumerable: true
        });
        Object.defineProperty(clone, "displayName", {
            get: () => fakeDisplay,
            set: () => { }, configurable: true, enumerable: true
        });

        if (pd?.email) clone.email = pd.email;
        if (pd?.phone) clone.phone = pd.phone;

        clone.getTag = () => (pd?.username || realUsername) + "#0000";
        clone.getGlobalName = () => fakeGlobal;
        clone.toString = () => fakeDisplay;

        if (pd?.createdAt) {
            const fakeCreatedAt = new Date(pd.createdAt + "T12:00:00Z");
            Object.defineProperty(clone, "createdAt", {
                get: () => fakeCreatedAt,
                configurable: true,
                enumerable: true
            });
        }

        if (pd?.decorationAsset) {
            const decoData = {
                asset: pd.decorationAsset,
                skuId: pd.decorationAsset
            };
            clone.avatarDecoration = null;
            clone.avatarDecorationData = decoData;
        }

        const wantedFlags = (pd?.badgeFlags != null) ? pd.badgeFlags : realUser.publicFlags;
        clone.publicFlags = wantedFlags;
        clone.flags = wantedFlags;

        const forceNitro = isMe || (pd && pd.nitro);
        if (forceNitro && pd?.nitro !== false) {
            clone.premiumType = 2;
            const LEVEL_MONTHS = [1, 2, 3, 6, 12, 24, 36, 72];
            const since = new Date();
            const nl = pd?.nitroLevel ?? 0;
            since.setMonth(since.getMonth() - (LEVEL_MONTHS[nl] ?? 1));
            clone.premiumSince = since;

            const bm = pd?.boostMonths ?? -1;
            if (bm >= 0) {
                const BOOST_M = [1, 2, 3, 6, 9, 12, 15, 18, 24];
                const boostSince = new Date();
                boostSince.setMonth(boostSince.getMonth() - (BOOST_M[bm] ?? 1));
                clone.premiumGuildSince = boostSince;
            } else {
                clone.premiumGuildSince = null;
            }
        } else {
            if (pd && pd.nitro === false) {
                clone.premiumType = 0;
                clone.premiumSince = null;
                clone.premiumGuildSince = null;
            }
        }

        if (!realUser.__cp_isClone) {
            clone._realPremiumType = realUser.premiumType;
            clone._realPremiumSince = realUser.premiumSince;
            clone._realPremiumGuildSince = realUser.premiumGuildSince;
        }

        return clone;
    },

    _cachedProfile: null as any,
    _cachedProfileInput: null as any,
    _cachedProfileVersion: 0,

    hookUserProfile(profile: any, userId: string) {
        if (!profile || !userId) return profile;
        const myId = AuthenticationStore?.getId?.();
        const isMe = myId && userId === myId;
        const pd = getProfileDataFor(userId);
        if (!pd && !isMe) return profile;

        try {
            const merged: any = {};

            if (pd?.bio) merged.bio = pd.bio;
            if (pd?.pronouns) merged.pronouns = pd.pronouns;
            if (pd?.accentColor != null) merged.accentColor = pd.accentColor;
            if (pd?.banner) merged.banner = pd.banner;

            if (pd?.decorationAsset) {
                const decoData = {
                    asset: pd.decorationAsset,
                    skuId: pd.decorationAsset
                };
                merged.avatarDecoration = null;
                merged.avatarDecorationData = decoData;
            }

            if (pd?.profileEffectId) {
                merged.profileEffectId = pd.profileEffectId;
                merged.profileEffect = { expireAt: null, skuId: pd.profileEffectId };
                if (!merged.premiumType) merged.premiumType = 2;
            }

            const forceNitro = isMe || (pd && pd.nitro);
            if (forceNitro && pd?.nitro !== false) {
                merged.premiumType = 2;

                if (pd) {
                    if (pd.accentColor != null) {
                        const c2 = pd.accentColor2 ?? pd.accentColor;
                        merged.themeColors = [pd.accentColor, c2];
                    }
                    const nl = pd.nitroLevel ?? 0;
                    const LEVEL_MONTHS = [1, 2, 3, 6, 12, 24, 36, 72];
                    const since = new Date();
                    since.setMonth(since.getMonth() - (LEVEL_MONTHS[nl] ?? 1));
                    merged.premiumSince = since;

                    const bm = pd.boostMonths ?? -1;
                    if (bm >= 0) {
                        const BOOST_M = [1, 2, 3, 6, 9, 12, 15, 18, 24];
                        const boostSince = new Date();
                        boostSince.setMonth(boostSince.getMonth() - (BOOST_M[bm] ?? 1));
                        merged.premiumGuildSince = boostSince;
                    } else {
                        merged.premiumGuildSince = null;
                    }
                } else {
                    const since = new Date();
                    since.setMonth(since.getMonth() - 12);
                    merged.premiumSince = since;
                    merged.premiumGuildSince = null;
                }

                merged.publicFlags = (pd?.badgeFlags != null) ? pd.badgeFlags : profile.publicFlags;
                merged.badges = [];
            } else if (pd && pd.nitro === false) {
                merged.premiumType = profile.premiumType ?? 0;
                merged.premiumSince = profile.premiumSince ?? null;
                merged.premiumGuildSince = profile.premiumGuildSince ?? null;
            } else {
                if (profile.premiumType) merged.premiumType = profile.premiumType;
                if (profile.premiumSince) merged.premiumSince = profile.premiumSince;
                if (profile.premiumGuildSince) merged.premiumGuildSince = profile.premiumGuildSince;
            }

            const result = virtualMerge(profile, merged);
            return result;
        } catch {
            return profile;
        }
    },

    fakeObfuscatedEmail(real: string | null) {
        if (!isEnabled || !storedData.email || !real) return real;
        const fake = storedData.email;
        const atIdx = fake.indexOf("@");
        if (atIdx <= 1) return fake;
        return fake[0] + "***" + fake.slice(atIdx - 1);
    },

    fakeObfuscatedPhone(real: string | null) {
        if (!isEnabled || !storedData.phone || !real) return real;
        const fake = storedData.phone;
        if (fake.length < 4) return fake;
        return "***-***-" + fake.slice(-4);
    },

    patchBannerUrl({ displayProfile }: any) {
        try {
            const uid = displayProfile?.userId;
            if (uid) {
                const pd = getProfileDataFor(uid);
                if (pd && pd.banner) return pd.banner;
            }
        } catch { }
        return null;
    },

    profileEffectHook(userId: string, original: any) {
        try {
            if (!original || !userId) return original;
            const pd = getProfileDataFor(userId);
            if (!pd || !pd.profileEffectId) return original;
            return Object.assign(
                Object.create(Object.getPrototypeOf(original)),
                original,
                {
                    profileEffectId: pd.profileEffectId,
                    profileEffect: {
                        expireAt: null,
                        skuId: pd.profileEffectId,
                    },
                    premiumType: original.premiumType ?? 2
                }
            );
        } catch {
            return original;
        }
    },

    premiumTypeHook({ userId }: any) {
        try {
            const myId = AuthenticationStore?.getId?.();
            // Always return Nitro (2) for the current user so Discord unlocks
            // display name style, profile customization, and all premium UI selectors
            if (myId && userId === myId) return 2;
            const pd = getProfileDataFor(userId);
            if (pd && (pd.profileEffectId || pd.nitro)) return 2;
        } catch {}
        return undefined;
    },

    toolboxActions: {
        [t("Open Custom Profile")]() { openModal(props => <CustomProfileModal rootProps={props} />); },
    },

    _origGetUserAvatarURL: null as any,
    _origExtractTimestamp: null as any,
    _forceNative: false,

    _origXhrOpen: null as any,
    _origXhrSend: null as any,

    async start() {
        applyAvatarPatchEarly();
        addHeaderBarButton("custom-profile-btn", () => <CustomProfileButton />, 10);
        addContextMenuPatch("user-context", userContextMenuPatch);

        try {
            if (!this._origXhrOpen) {
                this._origXhrOpen = XMLHttpRequest.prototype.open;
                this._origXhrSend = XMLHttpRequest.prototype.send;

                const self = this;
                XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
                    (this as any)._url = url;
                    (this as any)._method = method;
                    return self._origXhrOpen.apply(this, [method, url, ...rest]);
                };

                XMLHttpRequest.prototype.send = function (body: any) {
                    try {
                        const url = (this as any)._url;
                        const method = (this as any)._method;

                        if (typeof url === "string") {
                            // 1. Mock success for settings-proto to prevent rollback
                            if (url.includes("/users/@me/settings-proto/1") || url.includes("/users/%40me/settings-proto/1")) {
                                const xhr = this;
                                setTimeout(() => {
                                    try {
                                        Object.defineProperty(xhr, "status", { get: () => 200, configurable: true });
                                        Object.defineProperty(xhr, "readyState", { get: () => 4, configurable: true });
                                        Object.defineProperty(xhr, "responseText", { get: () => JSON.stringify({}), configurable: true });
                                        Object.defineProperty(xhr, "response", { get: () => JSON.stringify({}), configurable: true });
                                        if (typeof xhr.onreadystatechange === "function") xhr.onreadystatechange();
                                        if (typeof xhr.onload === "function") xhr.onload();
                                    } catch {}
                                }, 20);
                                return;
                            }

                            // 2. Intercept Profile PATCH request
                            if (method === "PATCH" && (url.includes("/users/@me") || url.includes("/users/%40me"))) {
                                if (body && typeof body === "string") {
                                    const payload = JSON.parse(body);
                                    const myId = AuthenticationStore?.getId?.();
                                    if (myId) {
                                        const currentData = { ...(allAccountsData[myId] || storedData || {}) };
                                        let changed = false;

                                        if ("banner" in payload) {
                                            currentData.banner = payload.banner || undefined;
                                            currentData.nitro = true;
                                            changed = true;
                                        }
                                        if ("theme_colors" in payload) {
                                            const tc = payload.theme_colors;
                                            if (Array.isArray(tc)) {
                                                currentData.accentColor = tc[0] != null ? tc[0] : undefined;
                                                currentData.accentColor2 = tc[1] != null ? tc[1] : undefined;
                                            }
                                            currentData.nitro = true;
                                            changed = true;
                                        }
                                        if ("avatar_decoration" in payload) {
                                            const dec = payload.avatar_decoration;
                                            currentData.decorationAsset = dec ? (dec.asset || dec) : undefined;
                                            changed = true;
                                        }
                                        if ("avatar_decoration_data" in payload) {
                                            const decData = payload.avatar_decoration_data;
                                            currentData.decorationAsset = decData ? (decData.asset || decData) : undefined;
                                            changed = true;
                                        }
                                        if ("profile_effect_id" in payload) {
                                            currentData.profileEffectId = payload.profile_effect_id || undefined;
                                            changed = true;
                                        }

                                        if (changed) {
                                            allAccountsData[myId] = currentData;
                                            allAccountsEnabled[myId] = true;
                                            storedData = currentData;
                                            isEnabled = true;

                                            saveDataSync(storedData, true);
                                            saveAllDataSync();
                                            DataStore.set(DS_ALL_DATA, allAccountsData).catch(() => { });
                                            DataStore.set(DS_ALL_ENABLED, allAccountsEnabled).catch(() => { });

                                            cachedFakeUser = null;
                                            cachedOriginalUser = null;
                                            _dataVersion++;

                                            updateCachedRealData();
                                            forceAccountPanelRerender();

                                            // Strip premium fields so Discord's server doesn't reject it
                                            delete payload.banner;
                                            delete payload.theme_colors;
                                            delete payload.avatar_decoration;
                                            delete payload.avatar_decoration_data;
                                            delete payload.profile_effect_id;

                                            body = JSON.stringify(payload);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error("[CustomProfile] XHR intercept error:", e);
                    }
                    return self._origXhrSend.apply(this, [body]);
                };
            }
        } catch (e) {
            console.error("[CustomProfile] Failed to hook XMLHttpRequest:", e);
        }

        FluxDispatcher.subscribe("CONNECTION_OPEN", onAccountSwitch);

        try {
            const US = (Endcord as any).Webpack?.findByProps?.("getCurrentUser", "getUser");
            if (US && !US._cp_perfect_hook) {
                const origCurrent = US.getCurrentUser.bind(US);

                let _lastRealUser: any = null;
                let _lastFakeResult: any = null;
                let _lastCacheVersion = -1;

                US.getCurrentUser = () => {
                    const realUser = origCurrent();
                    if (realUser) {
                        if (realUser !== _lastRealUser) {
                            if (realUser.username) _realUsername = realUser.username;
                            if (realUser.globalName) _realGlobalName = realUser.globalName;
                        }
                        if (realUser === _lastRealUser && _lastCacheVersion === _dataVersion && _lastFakeResult) {
                            return _lastFakeResult;
                        }
                        _lastRealUser = realUser;
                        _lastCacheVersion = _dataVersion;
                        // Pass true to force current user faking (Nitro, etc.)
                        _lastFakeResult = this.fakeCurrentUser(realUser, true);
                        return _lastFakeResult;
                    }
                    return this.fakeCurrentUser(realUser, true);
                };

                const origGet = US.getUser.bind(US);
                US.getUser = (id: string) => {
                    const orig = origGet(id);
                    if (!orig) return orig;
                    const myId = AuthenticationStore?.getId?.();
                    const isMe = myId && id === myId;
                    const pd = getProfileDataFor(id);
                    return (pd || isMe) ? this.fakeCurrentUser(orig, isMe) : orig;
                };
                US._cp_perfect_hook = true;
            }
        } catch { }

        try {
            const UPS = (Endcord as any).Webpack?.findByProps?.("getUserProfile", "getGuildMemberProfile");
            if (UPS && !UPS._cp_profile_hook) {
                const origGetProfile = UPS.getUserProfile.bind(UPS);
                UPS.getUserProfile = (userId: string) => {
                    try {
                        const profile = origGetProfile(userId);
                        if (!userId || !profile) return profile;
                        const myId = AuthenticationStore?.getId?.();
                        const isMe = myId && userId === myId;
                        const pd = getProfileDataFor(userId);
                        if (!pd && !isMe) return profile;
                        return this.hookUserProfile(profile, userId);
                    } catch (e) {
                        console.error("[CustomProfile] Error in getUserProfile hook:", e);
                        return origGetProfile(userId);
                    }
                };
                const origGetGuild = UPS.getGuildMemberProfile.bind(UPS);
                UPS.getGuildMemberProfile = (userId: string, guildId: string) => {
                    try {
                        const profile = origGetGuild(userId, guildId);
                        if (!userId || !profile) return profile;
                        const myId = AuthenticationStore?.getId?.();
                        const isMe = myId && userId === myId;
                        const pd = getProfileDataFor(userId);
                        if (!pd && !isMe) return profile;
                        return this.hookUserProfile(profile, userId);
                    } catch (e) {
                        console.error("[CustomProfile] Error in getGuildMemberProfile hook:", e);
                        return origGetGuild(userId, guildId);
                    }
                };
                UPS._cp_profile_hook = true;
            }
        } catch { }

        try {
            const WP = (Endcord as any).Webpack;
            const MAS = WP?.findByProps?.("getUsers", "getValidUsers", "getHasLoggedInAccounts");
            if (MAS && !MAS._cp_perfect_hook) {
                function patchAccountUser(u: any) {
                    if (!u?.id) return u;
                    const acctData = allAccountsData[u.id];
                    const acctEnabled = allAccountsEnabled[u.id];
                    if (!acctData || !acctEnabled) return u;
                    const patched: any = { ...u };
                    if (acctData.username) patched.username = acctData.username;
                    if (acctData.globalName) patched.globalName = acctData.globalName;
                    return patched;
                }

                if (MAS.getUsers) {
                    const origGetUsers = MAS.getUsers.bind(MAS);
                    MAS.getUsers = () => {
                        const users = origGetUsers();
                        if (!users || !Array.isArray(users)) return users;
                        return users.map(patchAccountUser);
                    };
                }

                if (MAS.getValidUsers) {
                    const origGetValid = MAS.getValidUsers.bind(MAS);
                    MAS.getValidUsers = () => {
                        const users = origGetValid();
                        if (!users || !Array.isArray(users)) return users;
                        return users.map(patchAccountUser);
                    };
                }

                MAS._cp_perfect_hook = true;
                try { MAS.emitChange?.(); } catch { }
            }
        } catch { }

        try {
            if (SnowflakeUtils?.extractTimestamp && !this._origExtractTimestamp) {
                this._origExtractTimestamp = SnowflakeUtils.extractTimestamp;
                const origExtract = this._origExtractTimestamp;
                (SnowflakeUtils as any).extractTimestamp = (snowflake: string) => {
                    if (isEnabled && storedData.createdAt && isMe(snowflake)) {
                        return new Date(storedData.createdAt + "T12:00:00Z").getTime();
                    }
                    return origExtract(snowflake);
                };
            }
        } catch { }

        loadData().then(() => {
            updateCachedRealData();
            applyAvatarPatchEarly();
            if (isEnabled) {
                forceAccountPanelRerender();
                requestAnimationFrame(() => removeHideStyle());
            } else {
                removeHideStyle();
            }
        });

        try {
            const decoMod = (Endcord as any).Webpack?.findByProps?.("getAvatarDecorationURL");
            if (decoMod?.getAvatarDecorationURL) {
                const origDeco = decoMod.getAvatarDecorationURL.bind(decoMod);
                decoMod.getAvatarDecorationURL = (opts: any) => {
                    try {
                        const { avatarDecoration, userId, canAnimate } = opts ?? {};
                        if (userId) {
                            const pd = getProfileDataFor(userId);
                            if (pd && pd.decorationAsset) {
                                return getDecorationUrl(pd.decorationAsset, pd.decorationAsset.startsWith("a_"));
                            }
                        }
                    } catch { }
                    return origDeco(opts);
                };
            }
        } catch { }

        if (IconUtils?.getUserAvatarURL && !_avatarPatchApplied) {
            this._origGetUserAvatarURL = IconUtils.getUserAvatarURL;
            const orig = this._origGetUserAvatarURL;
            (IconUtils as any).getUserAvatarURL = (user: any, ...args: any[]) => {
                const uid = user?.id ?? user?.userId;
                if (uid) {
                    const pd = getProfileDataFor(uid);
                    if (pd && pd.avatar) return pd.avatar;
                }
                return orig(user, ...args);
            };
            _avatarPatchApplied = true;
        }
    },

    userProfileBadges: [
        {
            getBadges({ userId, badges: nativeBadges }: { userId: string; guildId: string; badges: ProfileBadge[]; }) {
                const pd = getProfileDataFor(userId);
                if (!pd) return nativeBadges || [];

                let badges: ProfileBadge[] = [...(nativeBadges || [])];

                const nl = pd.nitroLevel ?? -1;
                const bm = pd.boostMonths ?? -1;
                const hasNitroFake = nl >= 0 && nl < NITRO_LEVELS.length;
                const hasBoostFake = bm >= 0 && bm < BOOST_ICONS.length;
                const wantedFlags = pd.badgeFlags ?? 0;

                badges = badges.filter(b => {
                    const desc = (b.description || "").toLowerCase();
                    const icon = (b.iconSrc || "").toLowerCase();

                    const nitroKeywords = ["nitro", "subscriber", "abonn", "premium", "inscrit"];
                    if (nitroKeywords.some(k => desc.includes(k))) return false;
                    if (icon.includes("nitro") || icon.includes("premium")) return false;

                    const boostKeywords = ["booster", "boost"];
                    if (boostKeywords.some(k => desc.includes(k))) return false;
                    if (icon.includes("boost") || icon.includes("leveling")) return false;

                    for (const badge of BADGES) {
                        if (wantedFlags & badge.flag) {
                            const badgeKeywords = badge.label.toLowerCase().split(" ");
                            if (badgeKeywords.some(k => k.length > 3 && desc.includes(k))) return false;
                            const iconParts = badge.icon.split("/");
                            const iconName = iconParts[iconParts.length - 1];
                            if (icon.includes(iconName)) return false;
                        }
                    }

                    return true;
                });

                const badgeList: ProfileBadge[] = [];

                // 1. Discord Staff
                if (wantedFlags & FLAG.STAFF)
                    badgeList.push(mkBadge("cp-badge-0", "Discord Staff", "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png"));

                // 2. Partner
                if (wantedFlags & FLAG.PARTNER)
                    badgeList.push(mkBadge("cp-badge-1", "Partnered Server Owner", "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png"));

                // 3. Nitro
                if (hasNitroFake)
                    badgeList.push(mkBadge("cp-badge-2", `Nitro ${NITRO_LEVELS[nl].label.split(" ")[0]}`, NITRO_LEVELS[nl].icon, "RARE", "Subscriber since 10/22/21"));

                // 4. HypeSquad Events
                if (wantedFlags & FLAG.HYPESQUAD)
                    badgeList.push(mkBadge("cp-badge-3", "HypeSquad Events", "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png", "RARE"));

                // 5. Bug Hunter 2
                if (wantedFlags & FLAG.BUG_HUNTER_2)
                    badgeList.push(mkBadge("cp-badge-4", "Pro Bug Hunter", "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png", "RARE"));

                // 6. House Badges
                if (wantedFlags & FLAG.BALANCE)
                    badgeList.push(mkBadge("cp-badge-5", "HypeSquad Balance", "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png", "RARE"));
                if (wantedFlags & FLAG.BRAVERY)
                    badgeList.push(mkBadge("cp-badge-6", "HypeSquad Bravery", "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png", "RARE"));
                if (wantedFlags & FLAG.BRILLIANCE)
                    badgeList.push(mkBadge("cp-badge-7", "HypeSquad Brilliance", "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png", "RARE"));

                // 7. Bug Hunter 1
                if (wantedFlags & FLAG.BUG_HUNTER_1)
                    badgeList.push(mkBadge("cp-badge-8", "Bug Hunter", "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png", "RARE"));

                // 8. Verified Developer
                if (wantedFlags & FLAG.DEV_VERIFIED)
                    badgeList.push(mkBadge("cp-badge-9", "Early Verified Bot Developer", "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png"));

                // 9. Moderator Alumni
                if (wantedFlags & FLAG.MOD_ALUMNI)
                    badgeList.push(mkBadge("cp-badge-10", "Moderator Program Alumni", "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png"));

                // 10. Early Supporter
                if (wantedFlags & FLAG.EARLY_SUPPORTER)
                    badgeList.push(mkBadge("cp-badge-11", "Early Supporter", "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png"));

                // 11. Server Boost
                if (hasBoostFake)
                    badgeList.push(mkBadge("cp-badge-12", "Server Booster", BOOST_ICONS[bm], "RARE", BOOST_LABELS[bm]));

                // 12. Active Developer
                if (wantedFlags & FLAG.ACTIVE_DEVELOPER)
                    badgeList.push(mkBadge("cp-badge-13", "Active Developer", "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png"));

                // 13. Legacy Username
                if (pd.customBadgeIds?.includes("oldname")) {
                    const oldNameText = pd.oldName || "OldUser#0000";
                    badgeList.push(mkBadge("cp-badge-14", "Legacy Username", OLD_NAME_BADGE_ICON, undefined, oldNameText));
                }

                // 14. Quests
                if (pd.customBadgeIds?.includes("quest"))
                    badgeList.push(mkBadge("cp-badge-15", "Quests", "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png"));

                // 15. Orbs
                if (pd.customBadgeIds?.includes("orbs"))
                    badgeList.push(mkBadge("cp-badge-16", "Orbs Apprentice", "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png"));

                // 16. Last Meadow
                if (pd.customBadgeIds?.includes("meadow"))
                    badgeList.push(mkBadge("cp-badge-17", "Last Meadow", "https://cdn.discordapp.com/badge-icons/ca105ad9cfc8580c765101d17bbb2323.png", "RARE", "Level 100 Reached"));

                // 17. Gifting badges
                const giftStyle: React.CSSProperties = { width: "24px", height: "24px", objectFit: "contain", mixBlendMode: "screen" as any, borderRadius: 0 };
                const mkGift = (id: string, name: string, icon: string): ProfileBadge => ({
                    id, description: name, iconSrc: icon, position: BadgePosition.START, props: { style: giftStyle }
                });
                if (pd.customBadgeIds?.includes("gift_patron")) badgeList.push(mkGift("cp-badge-18", "Gifting Patron", "https://i.imgur.com/tI4GCxR.png"));
                if (pd.customBadgeIds?.includes("gift_champion")) badgeList.push(mkGift("cp-badge-19", "Gifting Champion", "https://i.imgur.com/Jynm4dV.png"));
                if (pd.customBadgeIds?.includes("gift_luminary")) badgeList.push(mkGift("cp-badge-20", "Gifting Luminary", "https://i.imgur.com/3GRyXIR.png"));
                if (pd.customBadgeIds?.includes("gift_icon")) badgeList.push(mkGift("cp-badge-21", "Gifting Icon", "https://i.imgur.com/chM1tvZ.png"));
                if (pd.customBadgeIds?.includes("gift_hero")) badgeList.push(mkGift("cp-badge-22", "Gifting Hero", "https://i.imgur.com/7bJJJWl.png"));
                if (pd.customBadgeIds?.includes("gift_legendary")) badgeList.push(mkGift("cp-badge-23", "Gifting Legendary", "https://i.imgur.com/gQg96nV.png"));

                badges.push(...badgeList);
                return badges;
            }
        } as ProfileBadge
    ] as ProfileBadge[],

    stop() {
        removeHeaderBarButton("custom-profile-btn");
        removeContextMenuPatch("user-context", userContextMenuPatch);
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", onAccountSwitch);
        stopDomObserver();
        removeHideStyle();
        if (this._origRestPatch && RestAPI) {
            RestAPI.patch = this._origRestPatch;
            this._origRestPatch = null;
        }
        if (this._origExtractTimestamp && SnowflakeUtils) {
            (SnowflakeUtils as any).extractTimestamp = this._origExtractTimestamp;
            this._origExtractTimestamp = null;
        }
        if (this._origGetUserAvatarURL && IconUtils) {
            (IconUtils as any).getUserAvatarURL = this._origGetUserAvatarURL;
            this._origGetUserAvatarURL = null;
        }
        try {
            const myUser = UserStore.getCurrentUser() as any;
            if (myUser) {
                try { delete myUser.avatarDecoration; } catch { }
                try { delete myUser.avatarDecorationData; } catch { }
            }
        } catch { }
    },

    settingsAboutComponent() {
        return <Button onClick={() => openModal(props => <CustomProfileModal rootProps={props} />)}>Open Custom Profile</Button>;
    },
});
