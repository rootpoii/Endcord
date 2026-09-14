/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { Devs } from "@utils/constants";
import { ModalCloseButton as ModalCloseButton_, ModalContent as ModalContent_, ModalFooter as ModalFooter_, ModalHeader as ModalHeader_, ModalRoot as ModalRoot_ } from "@utils/modal";
import definePlugin, { IconComponent } from "@utils/types";
import { FluxDispatcher, openModal, React, UserStore } from "@webpack/common";

const ModalRoot = ModalRoot_ as React.ComponentType<any>;
const ModalHeader = ModalHeader_ as React.ComponentType<any>;
const ModalContent = ModalContent_ as React.ComponentType<any>;
const ModalFooter = ModalFooter_ as React.ComponentType<any>;
const ModalCloseButton = ModalCloseButton_ as React.ComponentType<any>;

const DS_KEY = "FakeNitroAge_months";

// ── State ─────────────────────────────────────────────────────────────────────

let fakeMonths: number | null = null;
let originalGetCurrentUser: (() => ReturnType<typeof UserStore.getCurrentUser>) | null = null;

function cloneWithPremium(user: any, months: number): any {
    const clone = Object.create(Object.getPrototypeOf(user));
    for (const key of Object.getOwnPropertyNames(user)) {
        const desc = Object.getOwnPropertyDescriptor(user, key);
        if (desc) Object.defineProperty(clone, key, desc);
    }
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    clone.premiumSince = since;
    clone.premiumType = 2;
    return clone;
}

function applyPatch() {
    if (originalGetCurrentUser) return;
    originalGetCurrentUser = UserStore.getCurrentUser.bind(UserStore);
    (UserStore as any).getCurrentUser = function () {
        const user = originalGetCurrentUser!();
        if (!user || fakeMonths == null) return user;
        return cloneWithPremium(user, fakeMonths);
    };
}

function removePatch() {
    if (!originalGetCurrentUser) return;
    (UserStore as any).getCurrentUser = originalGetCurrentUser;
    originalGetCurrentUser = null;
}

function notifyUpdate() {
    try {
        const me = originalGetCurrentUser?.() ?? UserStore.getCurrentUser();
        if (me) FluxDispatcher.dispatch({ type: "USER_UPDATE", user: me });
    } catch { }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const PRESETS = [
    { label: "1 month", months: 1 },
    { label: "2 months", months: 2 },
    { label: "3 months", months: 3 },
    { label: "6 months", months: 6 },
    { label: "1 year", months: 12 },
    { label: "2 years", months: 24 },
    { label: "3 years", months: 36 },
    { label: "4 years", months: 48 },
    { label: "5 years", months: 60 },
    { label: "6 years", months: 72 },
];

function NitroAgeModal({ modalProps }: { modalProps: any; }) {
    const [selected, setSelected] = React.useState<number | null>(fakeMonths);
    const [custom, setCustom] = React.useState("");

    function apply(months: number | null) {
        fakeMonths = months;
        if (months != null) {
            dsSet(DS_KEY, months);
            applyPatch();
        } else {
            dsSet(DS_KEY, null);
            removePatch();
        }
        notifyUpdate();
        modalProps.onClose();
    }

    const inputMonths = parseInt(custom, 10);
    const customValid = !isNaN(inputMonths) && inputMonths >= 1 && inputMonths <= 999;

    return (
        <ModalRoot {...modalProps} size="small">
            <ModalHeader>
                <span style={{ fontWeight: 700, fontSize: 16, flexGrow: 1 }}>Fake Nitro Age</span>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                    Sets how long your client shows you've had Nitro. Client-side only.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {PRESETS.map(p => (
                        <button
                            key={p.months}
                            onClick={() => setSelected(p.months)}
                            style={{
                                padding: "7px 0",
                                borderRadius: 6,
                                border: selected === p.months
                                    ? "2px solid var(--brand-500)"
                                    : "2px solid var(--background-modifier-accent)",
                                background: selected === p.months
                                    ? "var(--brand-500, #5865f2)"
                                    : "var(--background-secondary)",
                                color: selected === p.months ? "#fff" : "var(--text-normal)",
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: "pointer",
                                fontFamily: "var(--font-primary)",
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <input
                        type="number"
                        min={1}
                        max={999}
                        placeholder="Custom months…"
                        value={custom}
                        onChange={e => { setCustom(e.currentTarget.value); setSelected(null); }}
                        style={{
                            flex: 1,
                            background: "var(--background-secondary)",
                            border: "1px solid var(--background-modifier-accent)",
                            borderRadius: 6,
                            color: "var(--text-normal)",
                            padding: "7px 10px",
                            fontSize: 13,
                            fontFamily: "var(--font-primary)",
                            outline: "none",
                        }}
                    />
                    <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>months</span>
                </div>
            </ModalContent>
            <ModalFooter style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                    onClick={() => apply(null)}
                    style={{
                        background: "transparent",
                        border: "1px solid var(--text-danger, #f87171)",
                        color: "var(--text-danger, #f87171)",
                        borderRadius: 4,
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "var(--font-primary)",
                    }}
                >
                    Reset
                </button>
                <button
                    onClick={() => {
                        const months = custom && customValid ? inputMonths : (selected ?? null);
                        if (months != null) apply(months);
                    }}
                    disabled={!selected && !customValid}
                    style={{
                        background: "var(--brand-500)",
                        border: "none",
                        color: "#fff",
                        borderRadius: 4,
                        padding: "6px 18px",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "var(--font-primary)",
                        opacity: (!selected && !customValid) ? 0.4 : 1,
                    }}
                >
                    Apply
                </button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ── User area button ──────────────────────────────────────────────────────────

const NitroIcon: IconComponent = (props) => {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" {...props}>
            <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10zm-10 6c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6zm0-9c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
        </svg>
    );
}

function NitroAgeButton({ iconForeground, nameplate }: UserAreaRenderProps) {
    return (
        <UserAreaButton
            icon={<NitroIcon className={iconForeground} />}
            tooltipText={fakeMonths != null ? `Fake Nitro: ${fakeMonths} month${fakeMonths === 1 ? "" : "s"}` : "Fake Nitro Age"}
            onClick={() => openModal(props => <NitroAgeModal modalProps={props} />)}
            plated={nameplate != null}
        />
    );
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "FakeNitroAge",
    description: "Client-side button to set how many months/years of Nitro your profile shows.",
    tags: ["Customisation", "Fun"],
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    dependencies: ["UserAreaAPI"],

    userAreaButton: {
        icon: NitroIcon,
        render: NitroAgeButton,
    },

    async start() {
        const saved = await dsGet<number>(DS_KEY);
        if (saved != null && saved > 0) {
            fakeMonths = saved;
            applyPatch();
            notifyUpdate();
        }
    },

    stop() {
        fakeMonths = null;
        removePatch();
        notifyUpdate();
    },
});
