/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isSettingDisabled } from "@api/PluginManager";
import { OptionType, PluginSettingBigIntDef, PluginSettingNumberDef } from "@utils/types";
import { React, TextInput, useState } from "@webpack/common";

import { resolveError, SettingProps, SettingsSection } from "./Common";

const MAX_SAFE_NUMBER = BigInt(Number.MAX_SAFE_INTEGER);

export function NumberSetting({ setting, pluginSettings, definedSettings, id, onChange }: SettingProps<PluginSettingNumberDef | PluginSettingBigIntDef>) {
    function serialize(value: any) {
        if (setting.type === OptionType.BIGINT) return BigInt(value);
        return Number(value);
    }

    const [state, setState] = useState<any>(`${pluginSettings[id] ?? setting.default ?? 0}`);
    const [error, setError] = useState<string | null>(null);

    function handleChange(newValue: any) {
        const isValid = setting.isValid?.call(definedSettings, newValue) ?? true;

        setError(resolveError(isValid));

        if (isValid === true) {
            onChange(serialize(newValue));
        }

        if (setting.type === OptionType.NUMBER && BigInt(newValue) >= MAX_SAFE_NUMBER) {
            setState(`${Number.MAX_SAFE_INTEGER}`);
        } else {
            setState(newValue);
        }
    }

    return (
        <SettingsSection name={setting.displayName} id={id} description={setting.description} error={error}>
            <TextInput
                type="number"
                pattern="-?[0-9]+"
                placeholder={setting.placeholder ?? "Enter a number"}
                value={state}
                onChange={handleChange}
                disabled={isSettingDisabled(definedSettings, setting)}
                {...setting.componentProps}
            />
        </SettingsSection>
    );
}
