/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { filters, mapMangledModuleLazy } from "@webpack";
import { closeAllModals, closeModal, openMediaModal, openModal, openModalLazy } from "@webpack/common";

import { LazyComponent } from "./react";

/** @deprecated Migrate to new Modals */
export const enum ModalSize {
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
    DYNAMIC = "dynamic",
}

/** @deprecated Migrate to new Modals */
export const Modals = mapMangledModuleLazy(".MODAL_ROOT_LEGACY,", {
    ModalRoot: filters.componentByCode('.MODAL,"aria-labelledby":'),
    ModalHeader: filters.componentByCode(",id:"),
    ModalContent: filters.componentByCode("scrollbarType:"),
    ModalFooter: filters.componentByCode(".HORIZONTAL_REVERSE,"),
    ModalCloseButton: filters.componentByCode(".withCircleBackground")
}) as never;

/** @deprecated Migrate to new Modals */
export const ModalRoot = LazyComponent(() => (Modals as any).ModalRoot) as never;
/** @deprecated Migrate to new Modals */
export const ModalHeader = LazyComponent(() => (Modals as any).ModalHeader) as never;
/** @deprecated Migrate to new Modals */
export const ModalContent = LazyComponent(() => (Modals as any).ModalContent) as never;
/** @deprecated Migrate to new Modals */
export const ModalFooter = LazyComponent(() => (Modals as any).ModalFooter) as never;
/** @deprecated Migrate to new Modals */
export const ModalCloseButton = LazyComponent(() => (Modals as any).ModalCloseButton) as never;

/** @deprecated Migrate to new Modals */
export const ModalAPI = {
    openModal,
    openModalLazy,
    closeModal,
    closeAllModals
} as never;

export {
    /** @deprecated Migrate to new Modals */
    closeAllModals,
    /** @deprecated Migrate to new Modals */
    closeModal,
    /** @deprecated Migrate to new Modals */
    openMediaModal,
    /** @deprecated Migrate to new Modals */
    openModal,
    /** @deprecated Migrate to new Modals */
    openModalLazy
};
