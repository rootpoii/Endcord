/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { ComponentType } from "react";

export const enum ServerListRenderPosition {
    Above,
    In,
    Below,
}

const componentsAbove = new Map<ComponentType, number>();
const componentsIn = new Map<ComponentType, number>();
const componentsBelow = new Map<ComponentType, number>();

function getRenderMap(position: ServerListRenderPosition) {
    switch (position) {
        case ServerListRenderPosition.Above:
            return componentsAbove;
        case ServerListRenderPosition.In:
            return componentsIn;
        case ServerListRenderPosition.Below:
            return componentsBelow;
    }
}

export function addServerListElement(position: ServerListRenderPosition, renderFunction: ComponentType, priority = 0) {
    getRenderMap(position).set(renderFunction, priority);
}

export function removeServerListElement(position: ServerListRenderPosition, renderFunction: ComponentType) {
    getRenderMap(position).delete(renderFunction);
}

export const renderAll = (position: ServerListRenderPosition) => {
    return Array.from(getRenderMap(position).entries())
        .sort((a, b) => b[1] - a[1])
        .map(([Component], i) => (
            <ErrorBoundary noop key={i}>
                <Component />
            </ErrorBoundary>
        ));
};
