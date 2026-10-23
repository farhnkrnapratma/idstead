import {
    LINK_LIMITS,
    openPgpKeyFromRow,
    profileFromRow,
    projectRepoRulesFromRows
} from '@idstead/domain/author.ts';
import { decodeHtmlEntities } from '@idstead/domain/entities.ts';
import type { AuthorRepository } from '../author';
import {
    authorRepositoryFromReader,
    cvDocumentWithHash,
    type AuthorReader,
    type Row
} from '../authorReader';
import { DataError } from '../errors';
import type { D1Like } from './client';

export function parseJsonColumns(row: Row, columns: string[]): Row {
    const parsed: Row = { ...row };
    for (const column of columns) {
        if (typeof parsed[column] !== 'string') continue;
        try {
            parsed[column] = JSON.parse(parsed[column]);
        } catch {
            parsed[column] = null;
        }
    }
    return parsed;
}

export function booleanColumns(row: Row, columns: string[]): Row {
    const converted: Row = { ...row };
    for (const column of columns)
        if (column in converted && converted[column] !== null)
            converted[column] = converted[column] === 1 || converted[column] === true;
    return converted;
}

export function profileRow(row: Row): Row {
    return parseJsonColumns(row, ['manifest_settings']);
}

export function cvEntryRow(row: Row): Row {
    return booleanColumns(row, ['currently_in']);
}

export function documentRow(row: Row): Row {
    return booleanColumns(parseJsonColumns(row, ['checksums']), ['is_active']);
}

export function openPgpKeyRow(row: Row): Row {
    return booleanColumns(parseJsonColumns(row, ['user_ids', 'keyservers']), ['is_active']);
}

export function createD1AuthorReader(
    db: D1Like,
    options: { fetch?: typeof fetch } = {}
): AuthorReader {
    const fetchFn = options.fetch ?? fetch;

    async function all(operation: string, sql: string, ...params: unknown[]) {
        try {
            return (
                await db
                    .prepare(sql)
                    .bind(...params)
                    .all<Row>()
            ).results;
        } catch (error) {
            throw new DataError(operation, error);
        }
    }

    async function first(operation: string, sql: string, ...params: unknown[]) {
        try {
            return await db
                .prepare(sql)
                .bind(...params)
                .first<Row>();
        } catch (error) {
            throw new DataError(operation, error);
        }
    }

    return {
        async profile({ includeEmail = false } = {}) {
            const row = await first(
                'author.profile',
                'SELECT * FROM db_profiles WHERE avatar_version IS NOT NULL LIMIT 1'
            );
            return row ? profileFromRow(profileRow(row), { includeEmail }) : null;
        },

        links(category) {
            return all(
                `author.${category}Links`,
                'SELECT * FROM db_links WHERE category = ?1 ORDER BY sort_order LIMIT ?2',
                category,
                LINK_LIMITS[category]
            );
        },

        async experience() {
            return (
                await all('author.experience', 'SELECT * FROM db_experiences ORDER BY sort_order')
            ).map(cvEntryRow);
        },

        async education() {
            return (
                await all('author.education', 'SELECT * FROM db_educations ORDER BY sort_order')
            ).map(cvEntryRow);
        },

        async skills() {
            const [categories, items] = await Promise.all([
                all(
                    'author.skills',
                    'SELECT id, category, sort_order FROM db_categories ORDER BY sort_order'
                ),
                all(
                    'author.skills',
                    'SELECT id, category_id, name, sort_order FROM db_items ORDER BY sort_order'
                )
            ]);
            return categories.map(category => ({
                ...category,
                db_items: items
                    .filter(item => item.category_id === category.id)
                    .map(({ category_id: _categoryId, ...item }) => item)
            }));
        },

        async projectRepoRules() {
            const rows = await all(
                'author.projectRepoRules',
                'SELECT rule_type, repo_name FROM db_project_repo_rules ORDER BY sort_order'
            );
            return projectRepoRulesFromRows(
                rows as Array<{ rule_type: string; repo_name: string }>
            );
        },

        async activeCvDocument() {
            const row = await first(
                'author.activeCvDocument',
                'SELECT * FROM db_documents WHERE is_active = 1 ORDER BY sort_order LIMIT 1'
            );
            return row ? cvDocumentWithHash(documentRow(row), fetchFn) : null;
        },

        async activeOpenPgpKey() {
            const row = await first(
                'author.activeOpenPgpKey',
                'SELECT fingerprint, armored, user_ids, algorithm, key_created_at, expires_at, keyservers FROM db_openpgp_keys WHERE is_active = 1 LIMIT 1'
            );
            return row ? openPgpKeyFromRow(openPgpKeyRow(row)) : null;
        },

        async siteUrl() {
            const row = await first('author.siteUrl', 'SELECT site_url FROM db_profiles LIMIT 1');
            return decodeHtmlEntities(String(row?.site_url ?? ''));
        }
    };
}

export function createD1AuthorRepository(
    db: D1Like,
    options: { fetch?: typeof fetch } = {}
): AuthorRepository {
    return authorRepositoryFromReader(createD1AuthorReader(db, options));
}
