/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { OpenExternalIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { Guild, User } from "@endcord/discord-types";
import { Devs } from "@utils/constants";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin from "@utils/types";
import { findCssClassesLazy } from "@webpack";
import { Clickable, ConfirmModal, IconUtils, Menu, openModal, Parser } from "@webpack/common";

import { Auth, initAuth, updateAuth } from "./auth";
import { openReviewsModal } from "./components/ReviewModal";
import { NotificationType, ReviewType } from "./entities";
import { getCurrentUserInfo, getReviews, readNotification } from "./reviewDbApi";
import { settings } from "./settings";
import { cl, showToast } from "./utils";

const DMSideBarClasses = findCssClassesLazy("widgetPreviews");
const ProfileCardClasses = findCssClassesLazy("cardsList", "firstCardContainer", "card", "container");
const ProfileCardContainerClasses = findCssClassesLazy("innerContainer", "icons", "icon", "displayCount", "displayCountText", "displayCountTextColor", "breadcrumb");
const ProfileCardOverlayClasses = findCssClassesLazy("overlay", "isPrivate", "outer");

const guildPopoutPatch: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild, onClose(): void; }) => {
    if (!guild) return;
    children.push(
        <Menu.MenuItem
            label="View Reviews"
            id="vc-rdb-server-reviews"
            icon={OpenExternalIcon}
            action={() => openReviewsModal(guild.id, guild.name, ReviewType.Server)}
        />
    );
};

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User, onClose(): void; }) => {
    if (!user) return;
    children.push(
        <Menu.MenuItem
            label="View Reviews"
            id="vc-rdb-user-reviews"
            icon={OpenExternalIcon}
            action={() => openReviewsModal(user.id, user.username, ReviewType.User)}
        />
    );
};

export default definePlugin({
    name: "ReviewDB",
    description: "Review other users (Adds a new settings to profiles)",
    tags: ["Friends", "Servers"],
    authors: [Devs.mantikafasi, Devs.Ven],

    settings,
    contextMenus: {
        "guild-header-popout": guildPopoutPatch,
        "guild-context": guildPopoutPatch,
        "user-context": userContextPatch,
        "user-profile-actions": userContextPatch,
        "user-profile-overflow-menu": userContextPatch
    },

    patches: [
        {
            // DM profile sidebar
            find: ".SIDEBAR,disableToolbar:",
            replacement: {
                match: /user:(\i),widgets:.{0,100}?\}\),(?=.{0,200}?#{intl::USER_PROFILE_WISHLIST})/,
                replace: "$&$self.renderProfileComponent({user:$1,isSideBar:true}),"
            }
        },
        {
            // User popout
            // Same find as ShowConnections
            find: '"UserProfilePopout");',
            replacement: {
                match: /user:(\i),widgets:.{0,100}?\}\),/,
                replace: "$&$self.renderProfileComponent({user:$1}),"
            }
        }
    ],

    flux: {
        CONNECTION_OPEN: initAuth,
    },

    async start() {
        const s = settings.store;
        const { lastReviewId, notifyReviews } = s;

        await initAuth();

        setTimeout(async () => {
            if (!Auth.token) return;

            const user = await getCurrentUserInfo();
            if (user) {
                updateAuth({ user });

                if (notifyReviews) {
                    if (lastReviewId && lastReviewId < user.lastReviewID) {
                        s.lastReviewId = user.lastReviewID;
                        if (user.lastReviewID !== 0)
                            showToast("You have new reviews on your profile!");
                    }
                }

                const { notification } = user;
                if (notification) {
                    const props = notification.type === NotificationType.Ban ? {
                        cancelText: "Appeal",
                        confirmText: "Ok",
                        onCancel: async () =>
                            EndcordNative.native.openExternal(
                                "https://reviewdb.mantikafasi.dev/api/redirect?"
                                + new URLSearchParams({
                                    token: Auth.token!,
                                    page: "dashboard/appeal"
                                })
                            )
                    } : {};

                    openModal(modalProps => (
                        <ConfirmModal
                            {...modalProps}
                            title={notification.title}
                            confirmText={props.confirmText ?? "OK"}
                            cancelText={props.cancelText}
                            variant="primary"
                            onCancel={props.onCancel}
                        >
                            {Parser.parse(
                                notification.content,
                                false
                            )}
                        </ConfirmModal>
                    ));

                    readNotification(notification.id);
                }
            }
        }, 4000);
    },

    renderProfileComponent: ErrorBoundary.wrap(({ user, isSideBar = false }: { user: User; isSideBar?: boolean; }) => {
        const [reviewData] = useAwaiter(() => getReviews(user.id, { limit: 4 }), { deps: [user.id], fallbackValue: null });

        // Discord are masters at using a crap ton of html elements and css classes to create a simple ui that could have
        // been made with less than half of the number of elements, so we have to do this insanity to replicate their ui
        const reviewsSection = (
            <section className={ProfileCardClasses.container}>
                <ul className={ProfileCardClasses.cardsList} tabIndex={-1}>
                    <li className={ProfileCardClasses.firstCardContainer}>
                        <Clickable
                            className={classes(ProfileCardContainerClasses.breadcrumb, reviewData?.hasOptedOut && cl("profile-popout-disabled"))}
                            onClick={() => !reviewData?.hasOptedOut && openReviewsModal(user.id, user.username, ReviewType.User)}
                        >
                            <div className={classes(ProfileCardOverlayClasses.overlay, ProfileCardContainerClasses.innerContainer, ProfileCardClasses.card)}>
                                <Paragraph size={isSideBar ? "sm" : "xs"} weight="medium">User Reviews</Paragraph>
                                {!!reviewData?.reviewCount
                                    ? (
                                        <div className={ProfileCardContainerClasses.icons}>
                                            {reviewData.reviews
                                                .filter(review => review.id !== 0)
                                                .slice(0, 4)
                                                .reverse()
                                                .map((review, idx) => {
                                                    const showCount = idx === 3 && reviewData.reviewCount > 4;

                                                    return (
                                                        <div className={ProfileCardContainerClasses.icon} key={review.id}>
                                                            <img
                                                                src={review.sender.profilePhoto}
                                                                alt={review.sender.username}
                                                                className={showCount ? ProfileCardContainerClasses.displayCount : undefined}
                                                                onError={e => e.currentTarget.src = IconUtils.getDefaultAvatarURL(review.sender.discordID)}
                                                            />
                                                            {showCount && (
                                                                <div className={ProfileCardContainerClasses.displayCountText}>
                                                                    <Span className={ProfileCardContainerClasses.displayCountTextColor} size="xs" weight="medium" defaultColor={false}>
                                                                        +{reviewData.reviewCount - 3}
                                                                    </Span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )
                                    : <Paragraph size={isSideBar ? "sm" : "xs"}>{reviewData?.hasOptedOut ? "User opted out" : "No reviews yet"}</Paragraph>
                                }
                            </div>
                        </Clickable>
                    </li>
                </ul>
            </section>
        );

        return isSideBar
            ? <div className={DMSideBarClasses.widgetPreviews}>{reviewsSection}</div>
            : reviewsSection;
    }, { noop: true })
});
