/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { handleComponentFailed } from "@components/handleComponentFailed";
import { onlyOnce } from "@utils/onlyOnce";
import { Modal,openModal } from "@webpack/common";
import type { ComponentType, PropsWithChildren } from "react";

export function SettingsTab({ children }: PropsWithChildren) {
    return (
        <section className="vc-settings-tab">{children}</section>
    );
}

export const handleSettingsTabError = onlyOnce(handleComponentFailed);

export function wrapTab(component: ComponentType<any>, tab: string) {
    const wrapped = ErrorBoundary.wrap(component, {
        displayName: `${tab}SettingsTab`,
        message: `Failed to render the ${tab} tab. If this issue persists, try using the installer to reinstall!`,
        onError: handleSettingsTabError,
    });

    return wrapped;
}

export function openSettingsTabModal(Tab: ComponentType<any>) {
    Tab = wrapTab(Tab, Tab.displayName || "SettingsTab");

    try {
        openModal(props => (
            <Modal
                {...props}
                size="lg"
                title={Tab.displayName?.replace("SettingsTab", "") || "Settings"}
            >
                <Tab />
            </Modal>
        ));
    } catch {
        handleSettingsTabError();
    }
}
