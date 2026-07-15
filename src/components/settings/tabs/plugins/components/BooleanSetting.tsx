/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isSettingDisabled } from "@api/PluginManager";
import { Switch } from "@components/Switch";
import { PluginSettingBooleanDef } from "@utils/types";
import { React, useState } from "@webpack/common";

import { resolveError, SettingProps, SettingsSection } from "./Common";

export function BooleanSetting({ setting, pluginSettings, definedSettings, id, onChange }: SettingProps<PluginSettingBooleanDef>) {
    const def = pluginSettings[id] ?? setting.default;

    const [state, setState] = useState(def ?? false);
    const [error, setError] = useState<string | null>(null);

    function handleChange(newValue: boolean): void {
        const isValid = setting.isValid?.call(definedSettings, newValue) ?? true;

        setState(newValue);
        setError(resolveError(isValid));

        if (isValid === true) {
            onChange(newValue);
        }
    }

    return (
        <SettingsSection tag="label" name={setting.displayName} id={id} description={setting.description} error={error} inlineSetting>
            <Switch
                checked={state}
                onChange={handleChange}
                disabled={isSettingDisabled(definedSettings, setting)}
            />
        </SettingsSection>
    );
}

