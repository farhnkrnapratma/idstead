import type { SupabaseClient } from '@supabase/supabase-js';
import type { LegalPage, LegalPageRepository, LegalPageWriter } from '../legal';
import { DataError } from '../errors';

const LEGALS = 'db_legals';

type LegalRow = { slug: string; title: string | null; content: string | null; updated_at?: string };

function legalPage(row: LegalRow): LegalPage {
    return {
        slug: row.slug,
        title: row.title || '',
        content: row.content || '',
        ...(row.updated_at ? { updated_at: row.updated_at } : {})
    };
}

export function createSupabaseLegalPageRepository(db: SupabaseClient): LegalPageRepository {
    return {
        async page(slug: string) {
            const { data, error } = await db
                .from(LEGALS)
                .select('slug, title, content, updated_at')
                .eq('slug', slug)
                .maybeSingle();
            if (error) throw new DataError('legal.page', error);
            return data ? legalPage(data as LegalRow) : null;
        },

        async pages() {
            const { data, error } = await db
                .from(LEGALS)
                .select('slug, title, content, updated_at')
                .order('slug', { ascending: true });
            if (error) throw new DataError('legal.pages', error);
            return ((data ?? []) as LegalRow[]).map(legalPage);
        }
    };
}

export function createSupabaseLegalPageWriter(db: SupabaseClient): LegalPageWriter {
    return {
        async save(page) {
            const { error } = await db.rpc('db_save_legal', {
                p_slug: page.slug,
                p_title: page.title,
                p_content: page.content
            });
            return error ?
                    { status: 'rejected', message: error.message || 'Save failed.' }
                :   { status: 'saved' };
        }
    };
}
