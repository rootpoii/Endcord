/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isSettingDisabled } from "@api/PluginManager";
import { PluginSettingStringDef } from "@utils/types";
import { React, TextArea, TextInput, useState } from "@webpack/common";

import { resolveError, SettingProps, SettingsSection } from "./Common";

export function TextSetting({ setting, pluginSettings, definedSettings, id, onChange }: SettingProps<PluginSettingStringDef>) {
    const [state, setState] = useState(pluginSettings[id] ?? setting.default ?? null);
    const [error, setError] = useState<string | null>(null);

    function handleChange(newValue: string) {
        const isValid = setting.isValid?.call(definedSettings, newValue) ?? true;

        setState(newValue);
        setError(resolveError(isValid));

        if (isValid === true) {
            onChange(newValue);
        }
    }

    return (
        <SettingsSection name={setting.displayName} id={id} description={setting.description} error={error}>
            {setting.multiline
                ? <TextArea
                    placeholder={setting.placeholder ?? "Enter a value"}
                    value={state}
                    onChange={handleChange}
                    disabled={isSettingDisabled(definedSettings, setting)}
                    {...setting.componentProps} />
                : <TextInput
                    type="text"
                    placeholder={setting.placeholder ?? "Enter a value"}
                    value={state}
                    onChange={handleChange}
                    maxLength={null}
                    disabled={isSettingDisabled(definedSettings, setting)}
                    {...setting.componentProps}
                />
            }
        </SettingsSection>
    );
}
