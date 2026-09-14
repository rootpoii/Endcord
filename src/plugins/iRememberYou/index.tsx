/*
 * Endcord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";

import { Data } from "./components/data";
import DataUI from "./components/ui";

const EyeIcon = (props: any) => (
    <svg {...props} width={props.width ?? 20} height={props.height ?? 20} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
);

export default definePlugin({
    name: "IRememberYou",
    description: "Locally saves everyone you've been communicating with (including servers), in case of lose",
    tags: ["Chat", "Servers"],
    authors: [Devs.ewlle, Devs.rootpoi, Devs.kraethis],
    dependencies: ["MessageEventsAPI"],

    patches: [],

    async start() {
        SettingsPlugin.customEntries.push({
            key: "endcord_i_remember_you",
            title: "I Remember You",
            Component: () => <DataUI usersCollection={data.usersCollection} />,
            Icon: EyeIcon
        });

        const data = (this.dataManager = await new Data().withStart());

        await data.initializeUsersCollection();
        data.writeGuildsOwnersToCollection();
        data.writeMembersFromUserGuildsToCollection();
        data._onMessagePreSend_preSend = addMessagePreSendListener(
            data.onMessagePreSend.bind(data)
        );
        data.storageAutoSaveProtocol();
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "endcord_i_remember_you");

        const dataManager = this.dataManager as Data;
        removeMessagePreSendListener(dataManager._onMessagePreSend_preSend);
        clearInterval(dataManager._storageAutoSaveProtocol_interval);
    },
});
