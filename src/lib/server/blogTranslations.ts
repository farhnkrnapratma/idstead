import type {SupabaseClient} from '@supabase/supabase-js';
import {
  TRANSLATION_LOCALES,
  type TranslationLocale
} from '$lib/server/blogTranslate';

export function isTranslationLocale(value: string): value is TranslationLocale {
  return (TRANSLATION_LOCALES as string[]).includes(value);
}

export interface ResolvedTranslation {
  language: 'en' | TranslationLocale;
  requestedLanguage: TranslationLocale | null;
  machineTranslated: boolean;
  title: string | null;
  excerpt: string | null;
  summary: string | null;
  tldr: string[] | null;
  storagePath: string | null;
}

function englishFallback(
  requestedLanguage: TranslationLocale | null
): ResolvedTranslation {
  return {
    language: 'en',
    requestedLanguage,
    machineTranslated: false,
    title: null,
    excerpt: null,
    summary: null,
    tldr: null,
    storagePath: null
  };
}

export async function resolveTranslation(
  supabase: SupabaseClient,
  postId: string,
  lang: string | null
): Promise<ResolvedTranslation> {
  if (!lang) return englishFallback(null);
  if (!isTranslationLocale(lang)) return englishFallback(null);

  const {data} = await supabase
    .from('db_post_translations')
    .select('title, excerpt, summary, tldr, storage_path')
    .eq('post_id', postId)
    .eq('locale', lang)
    .maybeSingle();

  if (!data) return englishFallback(lang);

  return {
    language: lang,
    requestedLanguage: lang,
    machineTranslated: true,
    title: data.title,
    excerpt: data.excerpt,
    summary: data.summary,
    tldr: data.tldr,
    storagePath: data.storage_path
  };
}

export async function resolveTranslationsBulk(
  supabase: SupabaseClient,
  postIds: string[],
  lang: string | null
): Promise<Map<string, ResolvedTranslation>> {
  const map = new Map<string, ResolvedTranslation>();
  if (!lang || !isTranslationLocale(lang) || postIds.length === 0) return map;

  const {data} = await supabase
    .from('db_post_translations')
    .select('post_id, title, excerpt, summary, tldr, storage_path')
    .in('post_id', postIds)
    .eq('locale', lang);

  for (const row of data ?? []) {
    map.set(row.post_id, {
      language: lang,
      requestedLanguage: lang,
      machineTranslated: true,
      title: row.title,
      excerpt: row.excerpt,
      summary: row.summary,
      tldr: row.tldr,
      storagePath: row.storage_path
    });
  }
  return map;
}
