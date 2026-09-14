/*
 * Endcord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { OptionType } from "@utils/types";
import { useEffect, UserStore, useState } from "@webpack/common";

const settings = definePluginSettings({
    showEndcordDonor: {
        type: OptionType.BOOLEAN,
        description: "Enable to show Endcord Donor badges in chat.",
        hidden: true,
        default: true
    },
    EndcordDonorPosition: {
        type: OptionType.NUMBER,
        description: "The position of the Endcord Donor badges.",
        hidden: true,
        default: 0
    },
    showEndcordContributor: {
        type: OptionType.BOOLEAN,
        description: "Enable to show Endcord Contributor badges in chat.",
        hidden: true,
        default: true
    },
    EndcordContributorPosition: {
        type: OptionType.NUMBER,
        description: "The position of the Endcord Contributor badge.",
        hidden: true,
        default: 1
    },
    showVencordDonor: {
        type: OptionType.BOOLEAN,
        description: "Enable to show Endcord donor badges in chat.",
        hidden: true,
        default: true
    },
    VencordDonorPosition: {
        type: OptionType.NUMBER,
        description: "The position of the Endcord Donor badges.",
        hidden: true,
        default: 4
    },
    showVencordContributor: {
        type: OptionType.BOOLEAN,
        description: "Enable to show Endcord contributor badges in chat.",
        hidden: true,
        default: true
    },
    VencordContributorPosition: {
        type: OptionType.NUMBER,
        description: "The position of the Endcord Contributor badge.",
        hidden: true,
        default: 5
    },
    showDiscordProfile: {
        type: OptionType.BOOLEAN,
        description: "Enable to show Discord profile badges in chat.",
        hidden: true,
        default: true
    },
    DiscordProfilePosition: {
        type: OptionType.NUMBER,
        description: "The position of the Discord profile badges.",
        hidden: true,
        default: 6
    },
    showDiscordNitro: {
        type: OptionType.BOOLEAN,
        description: "Enable to show Discord Nitro badges in chat.",
        hidden: true,
        default: true
    },
    DiscordNitroPosition: {
        type: OptionType.NUMBER,
        description: "The position of the Discord Nitro badge.",
        hidden: true,
        default: 7
    },
    badgeSettings: {
        type: OptionType.COMPONENT,
        description: "Setup badge layout and visibility",
        component: () => <BadgeSettings />
    }
});

export default settings;

const BadgeSettings = () => {
    const [images, setImages] = useState([
        { src: "https://badge.equicord.org/donor.webp", shown: settings.store.showEndcordDonor, title: "Endcord donor badges", key: "EndcordDonor", position: settings.store.EndcordDonorPosition },
        { src: "https://iili.io/C3jZGrg.th.png", shown: settings.store.showEndcordContributor, title: "Endcord contributor badge", key: "EndcordContributer", position: settings.store.EndcordContributorPosition },
        { src: "https://cdn.discordapp.com/emojis/1026533070955872337.png", shown: settings.store.showVencordDonor, title: "Endcord donor badges", key: "VencordDonor", position: settings.store.VencordDonorPosition },
        { src: "https://cdn.discordapp.com/emojis/1092089799109775453.png", shown: settings.store.showVencordContributor, title: "Endcord contributor badge", key: "VencordContributer", position: settings.store.VencordContributorPosition },
        { src: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png", shown: settings.store.showDiscordProfile, title: "Discord profile badges (HypeSquad, Discord Staff, Early Supporter, etc.)", key: "DiscordProfile", position: settings.store.DiscordProfilePosition },
        { src: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png", shown: settings.store.showDiscordNitro, title: "Nitro badge", key: "DiscordNitro", position: settings.store.DiscordNitroPosition }
    ]);

    useEffect(() => {
        images.forEach(image => {
            switch (image.key) {
                case "EndcordDonor":
                    settings.store.EndcordDonorPosition = image.position;
                    settings.store.showEndcordDonor = image.shown;
                    break;
                case "EndcordContributer":
                    settings.store.EndcordContributorPosition = image.position;
                    settings.store.showEndcordContributor = image.shown;
                    break;
                case "VencordDonor":
                    settings.store.VencordDonorPosition = image.position;
                    settings.store.showVencordDonor = image.shown;
                    break;
                case "VencordContributer":
                    settings.store.VencordContributorPosition = image.position;
                    settings.store.showVencordContributor = image.shown;
                    break;
                case "DiscordProfile":
                    settings.store.DiscordProfilePosition = image.position;
                    settings.store.showDiscordProfile = image.shown;
                    break;
                case "DiscordNitro":
                    settings.store.DiscordNitroPosition = image.position;
                    settings.store.showDiscordNitro = image.shown;
                    break;
                default:
                    break;
            }
        });
    }, [images]);

    const handleDragStart = (e: any, index: number) => {
        if (!images[index].shown) {
            e.preventDefault();
        } else {
            e.dataTransfer.setData("index", index);
        }
    };

    const handleDragOver = e => {
        e.preventDefault();
    };

    const handleDrop = (e: any, dropIndex: number) => {
        const dragIndex = e.dataTransfer.getData("index");
        const newImages = [...images];
        const draggedImage = newImages[dragIndex];

        newImages.splice(dragIndex, 1);
        newImages.splice(dropIndex, 0, draggedImage);

        newImages.forEach((image, index) => {
            image.position = index;
        });

        setImages(newImages);
    };

    const toggleDisable = (index: number) => {
        const newImages = [...images];
        newImages[index].shown = !newImages[index].shown;
        setImages(newImages);
    };

    return (
        <>
            <BaseText>Drag the badges to reorder them, you can click to enable/disable a specific badge type.</BaseText>
            <div className="vc-sbic-badge-settings">
                <img className="vc-sbic-settings-avatar" src={UserStore.getCurrentUser().getAvatarURL()}></img>
                <BaseText className="vc-sbic-settings-username">{(UserStore.getCurrentUser() as any).globalName}</BaseText>
                {images
                    .sort((a, b) => a.position - b.position)
                    .map((image, index) => (
                        <div
                            key={image.key}
                            className={`vc-sbic-image-container ${!image.shown ? "vc-sbic-disabled" : ""}`}
                            onDragOver={e => handleDragOver(e)}
                            onDrop={e => handleDrop(e, index)}
                            onClick={() => toggleDisable(index)}
                        >
                            <img
                                src={image.src}
                                draggable={image.shown}
                                onDragStart={e => handleDragStart(e, index)}
                                title={image.title}
                            />
                        </div>
                    ))
                }
            </div>
        </>
    );
};
