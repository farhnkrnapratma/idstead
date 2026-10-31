// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { PostSource } from './blog';

export interface SourceRecord {
    postId: string;
    storagePath: string | null;
}

const records = new WeakMap<PostSource, SourceRecord>();

export function createPostSource(record: SourceRecord): PostSource {
    const source: PostSource = Object.freeze({ kind: 'post-source' });
    records.set(source, record);
    return source;
}

export function sourceRecord(source: PostSource): SourceRecord {
    const record = records.get(source);
    if (!record) throw new Error('Unknown post source.');
    return record;
}

export function isPostSource(value: unknown): value is PostSource {
    return typeof value === 'object' && value !== null && records.has(value as PostSource);
}
