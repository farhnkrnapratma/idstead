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
