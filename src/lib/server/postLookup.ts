import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidPostSlug } from '#lib/slug.ts';

export const PUBLIC_ID_PATTERN = /^[0-9a-f]{64}$/;
export const PUBLIC_ID_PREFIX_PATTERN = /^[0-9a-f]{7,63}$/;

export type PostLookupResult<T> =
    | { status: 'found'; post: T }
    | { status: 'invalid' }
    | { status: 'not-found' }
    | { status: 'ambiguous' }
    | { status: 'error'; error: unknown };

export function isPostReference(value: string): boolean {
    return PUBLIC_ID_PATTERN.test(value) || isValidPostSlug(value);
}

export async function findPost<T extends Record<string, unknown>>(
    db: SupabaseClient,
    reference: string,
    columns: string,
    { publishedOnly = true }: { publishedOnly?: boolean } = {}
): Promise<PostLookupResult<T>> {
    const value = reference.trim().toLowerCase();
    if (!isPostReference(value)) return { status: 'invalid' };

    const query = () => {
        const base = db.from('db_posts').select(columns);
        return publishedOnly ? base.eq('published', true) : base;
    };

    const attempts: Array<() => PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (PUBLIC_ID_PATTERN.test(value)) attempts.push(() => query().eq('public_id', value).limit(2));
    if (isValidPostSlug(value)) attempts.push(() => query().eq('slug', value).limit(2));
    if (PUBLIC_ID_PREFIX_PATTERN.test(value))
        attempts.push(() => query().like('public_id', `${value}%`).limit(2));

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
