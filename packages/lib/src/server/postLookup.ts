import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_ID_PATTERN, parsePostReference } from '@fkp/domain/postReference.ts';

export { PUBLIC_ID_PATTERN };

export type PostLookupResult<T> =
    | { status: 'found'; post: T }
    | { status: 'invalid' }
    | { status: 'not-found' }
    | { status: 'ambiguous' }
    | { status: 'error'; error: unknown };

export async function findPost<T extends Record<string, unknown>>(
    db: SupabaseClient,
    reference: string,
    columns: string,
    { publishedOnly = true }: { publishedOnly?: boolean } = {}
): Promise<PostLookupResult<T>> {
    const parsed = parsePostReference(reference);
    if (!parsed) return { status: 'invalid' };

    const query = () => {
        const base = db.from('db_posts').select(columns);
        return publishedOnly ? base.eq('published', true) : base;
    };

    const attempts: Array<() => PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (parsed.publicId) attempts.push(() => query().eq('public_id', parsed.publicId!).limit(2));
    if (parsed.slug) attempts.push(() => query().eq('slug', parsed.slug!).limit(2));
    if (parsed.prefix) attempts.push(() => query().like('public_id', `${parsed.prefix}%`).limit(2));

    for (const attempt of attempts) {
        const { data, error } = await attempt();
        if (error) return { status: 'error', error };
        const rows = (data ?? []) as T[];
        if (rows.length > 1) return { status: 'ambiguous' };
        if (rows.length === 1) return { status: 'found', post: rows[0] };
    }
    return { status: 'not-found' };
}

export async function resolvePostUuid(
    db: SupabaseClient,
    publicId: unknown,
    options?: { publishedOnly?: boolean }
): Promise<string | null> {
    if (typeof publicId !== 'string' || !PUBLIC_ID_PATTERN.test(publicId)) return null;
    const result = await findPost<{ id: string }>(db, publicId, 'id', options);
    return result.status === 'found' ? result.post.id : null;
}
