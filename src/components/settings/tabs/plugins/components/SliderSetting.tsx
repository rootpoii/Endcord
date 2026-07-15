/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isSettingDisabled } from "@api/PluginManager";
import { PluginSettingSliderDef } from "@utils/types";
import { React, Slider, useState } from "@webpack/common";

import { resolveError, SettingProps, SettingsSection } from "./Common";

export function SliderSetting({ setting, pluginSettings, definedSettings, id, onChange }: SettingProps<PluginSettingSliderDef>) {
    const def = pluginSettings[id] ?? setting.default;

    const [error, setError] = useState<string | null>(null);

    function handleChange(newValue: number): void {
        const isValid = setting.isValid?.call(definedSettings, newValue) ?? true;

        setError(resolveError(isValid));

        if (isValid === true) {
            onChange(newValue);
        }
    }

    return (
        <SettingsSection name={setting.displayName} id={id} description={setting.description} error={error}>
            <Slider
                markers={setting.markers}
                minValue={setting.markers[0]}
                maxValue={setting.markers[setting.markers.length - 1]}
                initialValue={def}
                onValueChange={handleChange}
                onValueRender={(v: number) => String(v.toFixed(2))}
                stickToMarkers={setting.stickToMarkers ?? true}
                disabled={isSettingDisabled(definedSettings, setting)}
                {...setting.componentProps}
            />
        </SettingsSection>
    );
}

