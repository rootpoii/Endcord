/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React, TextInput, useState } from "@webpack/common";

interface TextInputProps {
    /**
     * WARNING: Changing this between renders will have no effect!
     */
    initialValue: string;
    /**
     * This will only be called if the new value passed validate()
     */
    onChange(newValue: string): void;
    /**
     * Optionally validate the user input
     * Return true if the input is valid
     * Otherwise, return a string containing the reason for this input being invalid
     */
    validate(v: string): true | string;
}

/**
 * A very simple wrapper around Discord's TextInput that validates input and shows
 * the user an error message and only calls your onChange when the input is valid
 */
export function CheckedTextInput({ initialValue, onChange, validate }: TextInputProps) {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState<string>();

    function handleChange(v: string) {
        setValue(v);

        const res = validate(v);

        if (res === true) {
            setError(void 0);
            onChange(v);
        } else {
            setError(res);
        }
    }

    return (
        <>
            <TextInput
                type="text"
                value={value}
                onChange={handleChange}
                error={error}
            />
        </>
    );
}
