/*
 * Endcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as t from "@endcord/discord-types";
import { Auth } from "@plugins/reviewDB/auth";
import { ReviewType } from "@plugins/reviewDB/entities";
import { REVIEWS_PER_PAGE, UserReviewsData } from "@plugins/reviewDB/reviewDbApi";
import { cl } from "@plugins/reviewDB/utils";
import { useForceUpdater } from "@utils/react";
import { DefaultExtractAndLoadChunksRegex, extractAndLoadChunksLazy, findComponentByCodeLazy } from "@webpack";
import { Modal,openModalLazy, Text, useRef, useState } from "@webpack/common";
import { ComponentProps } from "react";

import ReviewComponent from "./ReviewComponent";
import ReviewsView, { ReviewsInputComponent } from "./ReviewsView";

const Paginator = findComponentByCodeLazy<ComponentProps<t.Paginator>>('rel:"prev",children:');
// This matches a massive module with ~230k chars so we need an anchor before to prevent REDOS
const requirePaginator = extractAndLoadChunksLazy(['name:"SearchResults"'], new RegExp(`name:"StageChannelCall",renderLoader:.+?(?:${DefaultExtractAndLoadChunksRegex.source}).{0,30}?name:"SearchResults"`));

function ReviewsModal({ modalProps, modalKey, discordId, name, type }: { modalProps: t.RenderModalProps; modalKey: string, discordId: string; name: string; type: ReviewType; }) {
    const [data, setData] = useState<UserReviewsData>();
    const [signal, refetch] = useForceUpdater(true);
    const [page, setPage] = useState(1);

    const ref = useRef<HTMLDivElement>(null);

    const reviewCount = data?.reviewCount;
    const ownReview = data?.reviews.find(r => r.sender.discordID === Auth.user?.discordID);

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={
                <Text variant="heading-lg/semibold" className={cl("modal-header")}>
                    {name}'s Reviews
                    {!!reviewCount && <span> ({reviewCount} Reviews)</span>}
                </Text>
            }
            preview={
                <div className={cl("modal-footer")}>
                    <div className={cl("modal-footer-wrapper")}>
                        {ownReview && (
                            <ReviewComponent
                                refetch={refetch}
                                review={ownReview}
                                profileId={discordId}
                            />
                        )}
                        <ReviewsInputComponent
                            isAuthor={ownReview != null}
                            discordId={discordId}
                            name={name}
                            refetch={refetch}
                            modalKey={modalKey}
                        />

                        {!!reviewCount && (
                            <Paginator
                                currentPage={page}
                                maxVisiblePages={5}
                                pageSize={REVIEWS_PER_PAGE}
                                totalCount={reviewCount}
                                onPageChange={setPage}
                            />
                        )}
                    </div>
                </div>
            }
            scrollerRef={ref}
        >
            <div className={cl("modal-reviews")}>
                <ReviewsView
                    discordId={discordId}
                    name={name}
                    page={page}
                    refetchSignal={signal}
                    onFetchReviews={setData}
                    scrollToTop={() => ref.current?.scrollTo({ top: 0, behavior: "smooth" })}
                    hideOwnReview
                    type={type}
                />
            </div>
        </Modal>
    );
}

export function openReviewsModal(discordId: string, name: string, type: ReviewType) {
    const modalKey = "vc-rdb-modal-" + Date.now();

    openModalLazy(async () => {
        await requirePaginator();
        return props => (
            <ReviewsModal
                modalKey={modalKey}
                modalProps={props}
                discordId={discordId}
                name={name}
                type={type}
            />
        );
    }, { modalKey });
}
