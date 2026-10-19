import type { SupabaseClient } from '@supabase/supabase-js';
import { sha256 } from '#lib/blogBanner.ts';
import type { parsePostInput } from './blogPostInput';
import { postRenderPath } from '@fkp/data';

type Input = Awaited<ReturnType<typeof parsePostInput>>;
export type PostOperation = {
    id: string;
    state: 'pending' | 'ready' | 'committed' | 'conflict' | 'rejected';
    result: {
        id: string;
        post_revision?: number;
        banner_version?: string | null;
        slug?: string;
        published?: boolean;
        deleted?: boolean;
    } | null;
};

export class BannerRequiredError extends Error {
    constructor() {
        super('Banner image is required.');
    }
}

export async function savePostOperation(
    db: SupabaseClient,
    actor: string,
    input: Input,
    upload: () => Promise<void>,
    render: string | null = null
) {
    const { data, error } = await db.rpc('db_prepare_post_operation', {
        p_id: input.operationId,
        p_actor: actor,
        p_post_id: input.id,
        p_hash: input.hash,
        p_revision: input.revision,
        p_kind: input.kind,
        p_post: input.post,
        p_banner: input.banner
    });
    if (error) throw error;
    let operation = data as PostOperation;
    if (
        operation.state === 'committed'
        || operation.state === 'conflict'
        || operation.state === 'rejected'
    )
        return operation;
    if (input.kind === 'save' && input.banner.operation === 'keep') {
        const { data: current, error: readError } = await db
            .from('db_posts')
            .select('banner_version, post_revision')
            .eq('id', input.id)
            .maybeSingle();
        if (readError) throw readError;
        if (current?.post_revision === input.revision && !current.banner_version)
            throw new BannerRequiredError();
    }
    if (operation.state === 'pending') {
        if (input.kind === 'save') {
            if (input.image) await upload();
            const path = `posts/${input.id}/${input.operationId}.md`;
            const storage = db.storage.from('blog-posts');
            const { error: uploadError } = await storage.upload(
                path,
                new Blob([input.markdown], { type: 'text/markdown' }),
                { contentType: 'text/markdown', upsert: false }
            );
            if (uploadError) {
                const { data: existing, error: readError } = await storage.download(path);
                if (
                    readError
                    || !existing
                    || (await sha256(await existing.arrayBuffer()))
                        !== (await sha256(new TextEncoder().encode(input.markdown)))
                )
                    throw new Error('Markdown upload failed. Retry the same Save operation.');
            }
            const renderPath = postRenderPath(path);
            if (render && renderPath) {
                const { error: renderError } = await storage.upload(
                    renderPath,
                    new Blob([render], { type: 'application/json' }),
                    { contentType: 'application/json', upsert: true }
                );
                if (renderError) console.error('Post render upload failed:', renderError.message);
            }
        }
        const { error: readyError } = await db.rpc('db_ready_post_operation', {
            p_id: input.operationId,
            p_actor: actor
        });
        if (readyError) throw readyError;
    }
    try {
        const { data: saved, error: commitError } = await db.rpc('db_commit_post_operation', {
            p_id: input.operationId,
            p_actor: actor
        });
        if (commitError) throw commitError;
        operation = saved;
    } catch (error) {
        const { data: saved, error: lookupError } = await db
            .from('db_post_operations')
            .select('id, state, result')
            .eq('id', input.operationId)
            .eq('actor_id', actor)
            .maybeSingle();
        if (lookupError || !saved || !['committed', 'conflict', 'rejected'].includes(saved.state))
            throw error;
        operation = saved as PostOperation;
    }
    return operation;
}
