/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TextButton } from "@components/Button";
import { RenderModalProps } from "@endcord/discord-types";
import { SessionInfo } from "@plugins/betterSessions/types";
import { getDefaultName, savedSessionsCache, saveSessionsToDataStore } from "@plugins/betterSessions/utils";
import { Forms, Modal,React, TextInput } from "@webpack/common";
import { KeyboardEvent } from "react";

export function RenameModal({ props, session, state }: { props: RenderModalProps, session: SessionInfo["session"], state: [string, React.Dispatch<React.SetStateAction<string>>]; }) {
    const [title, setTitle] = state;
    const [value, setValue] = React.useState(savedSessionsCache.get(session.id_hash)?.name ?? "");

    function onSaveClick() {
        savedSessionsCache.set(session.id_hash, { name: value, isNew: false });
        if (value !== "") {
            setTitle(`${value}*`);
        } else {
            setTitle(getDefaultName(session.client_info));
        }

        saveSessionsToDataStore();
        props.onClose();
    }

    return (
        <Modal
            {...props}
            title="Rename"
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: () => props.onClose()
                },
                {
                    text: "Save",
                    variant: "primary",
                    onClick: onSaveClick
                }
            ]}
        >
            <div>
                <Forms.FormTitle tag="h5">New device name</Forms.FormTitle>
                <TextInput
                    style={{ marginBottom: "10px" }}
                    placeholder={getDefaultName(session.client_info)}
                    value={value}
                    onChange={setValue}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") {
                            onSaveClick();
                        }
                    }}
                />
                <TextButton
                    style={{
                        paddingLeft: "1px",
                        opacity: 0.6
                    }}
                    onClick={() => setValue("")}
                >
                    Reset Name
                </TextButton>
            </div>
        </Modal>
    );
}
