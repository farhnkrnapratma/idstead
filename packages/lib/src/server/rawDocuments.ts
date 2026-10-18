import { supabase } from '#lib/supabase.ts';
import { getLegalPage } from '#lib/server/legalPages.ts';
import { isValidPostSlug } from '#lib/slug.ts';
import { markdownToPlainText } from '@fkp/mdrs';

export type DocumentFormat = 'md' | 'txt';

function documentResponse(body: string, format: DocumentFormat) {
    return new Response(body, {
        headers: {
            'Content-Type':
                format === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=3600',
            'X-Robots-Tag': 'noindex'
        }
    });
}

function notFound() {
    return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

export async function blogDocument(slug: string, format: DocumentFormat, fetchFn: typeof fetch) {
    if (!isValidPostSlug(slug)) return notFound();
    const { data: post, error } = await supabase
        .from('db_posts')
        .select('title, excerpt, storage_path')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
    if (error || !post) return notFound();

    let markdown = '';
    if (post.storage_path) {
        try {
            const { data } = supabase.storage.from('blog-posts').getPublicUrl(post.storage_path);
            const response = await fetchFn(data.publicUrl);
            if (response.ok) markdown = await response.text();
        } catch (err) {
            console.error('Could not read post markdown:', err);
        }
    }
    const body = markdown || post.excerpt || '';

    if (format === 'txt')
        return documentResponse(
            `${post.title}\n\n${post.excerpt ? `${post.excerpt}\n\n` : ''}${markdownToPlainText(body)}`,
            'txt'
        );
    return documentResponse(`# ${post.title}\n\n${body}`, 'md');
}

export async function legalDocument(slug: string, format: DocumentFormat) {
    const page = await getLegalPage(slug);
    if (!page.content) return notFound();
    if (format === 'txt') {
        const text = markdownToPlainText(page.content);
        return documentResponse(page.title ? `${page.title}\n\n${text}` : text, 'txt');
    }
    return documentResponse(page.content, 'md');
}
