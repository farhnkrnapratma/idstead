// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { LegalPage, LegalPageRepository, LegalPageWriter } from '../legal';
import { DataError } from '../errors';
import type { D1Like, D1Row } from './client';

function legalPage(row: D1Row): LegalPage {
    return {
        slug: String(row.slug),
        title: typeof row.title === 'string' ? row.title : '',
        content: typeof row.content === 'string' ? row.content : '',
        ...(typeof row.updated_at === 'string' ? { updated_at: row.updated_at } : {})
    };
}

export function createD1LegalPageRepository(db: D1Like): LegalPageRepository {
    return {
        async page(slug: string) {
            try {
                const row = await db
                    .prepare(
                        'SELECT slug, title, content, updated_at FROM db_legals WHERE slug = ?1'
                    )
                    .bind(slug)
                    .first();
                return row ? legalPage(row) : null;
            } catch (error) {
                throw new DataError('legal.page', error);
            }
        },

        async pages() {
            try {
                const { results } = await db
                    .prepare('SELECT slug, title, content, updated_at FROM db_legals ORDER BY slug')
                    .all();
                return results.map(legalPage);
            } catch (error) {
                throw new DataError('legal.pages', error);
            }
        }
    };
}

export function createD1LegalPageWriter(db: D1Like): LegalPageWriter {
    return {
        async save(page) {
            try {
                await db
                    .prepare(
                        `INSERT INTO db_legals (slug, title, content, updated_at)
                         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                         ON CONFLICT (slug) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = excluded.updated_at`
                    )
                    .bind(page.slug, page.title, page.content)
                    .run();
                return { status: 'saved' };
            } catch (error) {
                return {
                    status: 'rejected',
                    message:
                        error instanceof Error && error.message ? error.message : 'Save failed.'
                };
            }
        }
    };
}
