/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isSettingDisabled } from "@api/PluginManager";
import { PluginSettingSelectDef } from "@utils/types";
import { React, Select, useState } from "@webpack/common";

import { resolveError, SettingProps, SettingsSection } from "./Common";

export function SelectSetting({ setting, pluginSettings, definedSettings, onChange, id }: SettingProps<PluginSettingSelectDef>) {
    const def = pluginSettings[id] ?? setting.options?.find(o => o.default)?.value;

    const [state, setState] = useState<any>(def ?? null);
    const [error, setError] = useState<string | null>(null);

    function handleChange(newValue: any) {
        const isValid = setting.isValid?.call(definedSettings, newValue) ?? true;

        setState(newValue);
        setError(resolveError(isValid));

        if (isValid === true) {
            onChange(newValue);
        }
    }

    return (
        <SettingsSection name={setting.displayName} id={id} description={setting.description} error={error}>
            <Select
                placeholder={setting.placeholder ?? "Select an option"}
                options={setting.options}
                maxVisibleItems={5}
                closeOnSelect={true}
                select={handleChange}
                isSelected={v => v === state}
                serialize={v => String(v)}
                isDisabled={isSettingDisabled(definedSettings, setting)}
                {...setting.componentProps}
            />
        </SettingsSection>
    );
}
