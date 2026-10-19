import { renderMarkdown } from '@fkp/mdrs';
import { createMdrsResolvers } from '#lib/mdrsResolvers.ts';
import { supabase } from '#lib/supabase.ts';

export function renderMdrsPreview(markdown: string): Promise<string> {
    return renderMarkdown(markdown, createMdrsResolvers(supabase));
}
