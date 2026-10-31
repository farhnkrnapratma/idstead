// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { decodeHtmlEntities } from '@mdrs/core';

export type CommentFilter = 'all' | 'replied' | 'unanswered' | 'admin' | 'reported';
export type CommentSort = 'date' | 'replies' | 'author';
export type CommentSortDirection = 'asc' | 'desc';

interface FilterableComment {
    content: string;
    created_at: string;
    is_admin?: boolean;
    reports?: number | null;
}

interface Thread<T> {
    comment: T;
    children: { comment: T }[];
}

export interface ArrangeOptions<T> {
    query: string;
    filter: CommentFilter;
    sort: CommentSort;
    direction: CommentSortDirection;
    nameOf: (comment: T) => string;
}

function normalize(value: string) {
    return value.trim().toLowerCase();
}

export function commentMatchesQuery<T extends FilterableComment>(
    comment: T,
    query: string,
    nameOf: (comment: T) => string
) {
    const needle = normalize(query);
    if (!needle) return true;
    return (
        normalize(decodeHtmlEntities(comment.content)).includes(needle)
        || normalize(nameOf(comment)).includes(needle)
    );
}

function members<T>(thread: Thread<T>) {
    return [thread.comment, ...thread.children.map(child => child.comment)];
}

function matchesFilter<T extends FilterableComment>(thread: Thread<T>, filter: CommentFilter) {
    if (filter === 'replied') return thread.children.length > 0;
    if (filter === 'unanswered') return thread.children.length === 0;
    if (filter === 'admin') return members(thread).some(item => item.is_admin);
    if (filter === 'reported') return members(thread).some(item => Number(item.reports) > 0);
    return true;
}

export function arrangeThreads<T extends FilterableComment, N extends Thread<T>>(
    threads: N[],
    { query, filter, sort, direction, nameOf }: ArrangeOptions<T>
): N[] {
    const sign = direction === 'asc' ? 1 : -1;
    const byDate = (a: N, b: N) =>
        Date.parse(a.comment.created_at) - Date.parse(b.comment.created_at);
    return threads
        .filter(
            thread =>
                matchesFilter(thread, filter)
                && members(thread).some(item => commentMatchesQuery(item, query, nameOf))
        )
        .sort((a, b) => {
            const primary =
                sort === 'replies' ? a.children.length - b.children.length
                : sort === 'author' ? nameOf(a.comment).localeCompare(nameOf(b.comment))
                : byDate(a, b);
            return primary !== 0 ? sign * primary : byDate(a, b);
        });
}

export function countThreadComments<T>(threads: Thread<T>[]) {
    return threads.reduce((sum, thread) => sum + 1 + thread.children.length, 0);
}
