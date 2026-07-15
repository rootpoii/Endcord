/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginSettingComponentDef } from "@utils/types";

import { ComponentSettingProps } from "./Common";

export function ComponentSetting({ setting, onChange, closePluginSettings }: ComponentSettingProps<PluginSettingComponentDef>) {
    return setting.component({ setValue: onChange, option: setting, closePluginSettings });
}
