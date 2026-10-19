import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostRenderStore, PostSource } from '../blog';
import { DataError } from '../errors';
import { createPostSource, sourceRecord } from '../source';
import { postRenderPath } from './paths';

const BUCKET = 'blog-posts';

export function createSupabaseRenderStore(db: SupabaseClient): PostRenderStore {
    const bucket = () => db.storage.from(BUCKET);

    async function download(path: string | null): Promise<string | null> {
        if (!path) return null;
        const { data, error } = await bucket().download(path);
        return error || !data ? null : data.text();
    }

    return {
        async listRenderCandidates(limit: number): Promise<PostSource[]> {
            const { data, error } = await db
                .from('db_posts')
                .select('id, storage_path')
                .eq('published', true)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw new DataError('renders.listRenderCandidates', error);
            return ((data ?? []) as { id: string; storage_path: string | null }[])
                .filter(row => postRenderPath(row.storage_path) !== null)
                .map(row => createPostSource({ postId: row.id, storagePath: row.storage_path }));
        },

        downloadMarkdown(source: PostSource) {
            return download(sourceRecord(source).storagePath);
        },

        downloadRender(source: PostSource) {
            return download(postRenderPath(sourceRecord(source).storagePath));
        },

        async writeRender(source: PostSource, render: string): Promise<void> {
            const path = postRenderPath(sourceRecord(source).storagePath);
            if (!path) throw new DataError('renders.writeRender', 'The post has no render path.');
            const { error } = await bucket().upload(
                path,
                new Blob([render], { type: 'application/json' }),
                { contentType: 'application/json', upsert: true }
            );
            if (error) throw new DataError('renders.writeRender', error);
        },

        renderPath(source: PostSource) {
            return postRenderPath(sourceRecord(source).storagePath);
        }
    };
}
