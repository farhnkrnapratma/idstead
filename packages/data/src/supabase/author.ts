import type { SupabaseClient } from '@supabase/supabase-js';
import {
    LINK_LIMITS,
    openPgpKeyFromRow,
    profileFromRow,
    projectRepoRulesFromRows
} from '@idstead/domain/author.ts';
import { decodeHtmlEntities } from '@idstead/domain/entities.ts';
import type { AuthorRepository } from '../author';
import { DataError } from '../errors';
import {
    authorRepositoryFromReader,
    cvDocumentWithHash,
    type AuthorReader,
    type Row
} from '../authorReader';

export { publicProfile, type AuthorReader, type Row } from '../authorReader';

export function createAuthorReader(
    db: SupabaseClient,
    options: { fetch?: typeof fetch } = {}
): AuthorReader {
    const fetchFn = options.fetch ?? fetch;

    async function rows(operation: string, query: PromiseLike<{ data: unknown; error: unknown }>) {
        const { data, error } = await query;
        if (error) throw new DataError(operation, error);
        return (data ?? []) as Row[];
    }

    async function single(
        operation: string,
        query: PromiseLike<{ data: unknown; error: unknown }>
    ) {
        const { data, error } = await query;
        if (error) throw new DataError(operation, error);
        return (data ?? null) as Row | null;
    }

    return {
        async profile({ includeEmail = false } = {}) {
            const data = await single(
                'author.profile',
                db.from('db_profiles').select('*').limit(1).maybeSingle()
            );
            return data ? profileFromRow(data, { includeEmail }) : null;
        },

        links(category) {
            return rows(
                `author.${category}Links`,
                db
                    .from('db_links')
                    .select('*')
                    .eq('category', category)
                    .order('sort_order', { ascending: true })
                    .limit(LINK_LIMITS[category])
            );
        },

        experience() {
            return rows(
                'author.experience',
                db.from('db_experiences').select('*').order('sort_order', { ascending: true })
            );
        },

        education() {
            return rows(
                'author.education',
                db.from('db_educations').select('*').order('sort_order', { ascending: true })
            );
        },

        skills() {
            return rows(
                'author.skills',
                db
                    .from('db_categories')
                    .select('id, category, sort_order, db_items(id, name, sort_order)')
                    .order('sort_order', { ascending: true })
            );
        },

        async projectRepoRules() {
            const data = await rows(
                'author.projectRepoRules',
                db
                    .from('db_project_repo_rules')
                    .select('rule_type, repo_name')
                    .order('sort_order', { ascending: true })
            );
            return projectRepoRulesFromRows(
                data as Array<{ rule_type: string; repo_name: string }>
            );
        },

        async activeCvDocument() {
            const data = await single(
                'author.activeCvDocument',
                db
                    .from('db_documents')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true })
                    .limit(1)
                    .maybeSingle()
            );
            return data ? cvDocumentWithHash(data, fetchFn) : null;
        },

        async activeOpenPgpKey() {
            const data = await single(
                'author.activeOpenPgpKey',
                db
                    .from('db_openpgp_keys')
                    .select(
                        'fingerprint, armored, user_ids, algorithm, key_created_at, expires_at, keyservers'
                    )
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle()
            );
            return data ? openPgpKeyFromRow(data) : null;
        },

        async siteUrl() {
            const data = await single(
                'author.siteUrl',
                db.from('db_profiles').select('site_url').limit(1).maybeSingle()
            );
            return decodeHtmlEntities(data?.site_url || '');
        }
    };
}

export function createSupabaseAuthorRepository(
    db: SupabaseClient,
    options: { fetch?: typeof fetch } = {}
): AuthorRepository {
    return authorRepositoryFromReader(createAuthorReader(db, options));
}
