import {supabase} from '../supabase';
import type {LegalPageData} from '../legalDefaults';

export type {LegalPageData};

export async function getLegalPage(slug: string): Promise<LegalPageData> {
  try {
    const {data, error} = await supabase
      .from('db_legals')
      .select('slug, title, content, updated_at')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      return {slug, title: '', content: ''};
    }

    return {
      slug: data.slug,
      title: data.title || '',
      content: data.content || '',
      updated_at: data.updated_at
    };
  } catch {
    return {slug, title: '', content: ''};
  }
}
