import { error } from '@sveltejs/kit';
import { publicRepositories } from './repositories';

export async function readSiteProfile() {
    const profile = await publicRepositories()
        .author.profile({ includeEmail: true })
        .catch(() => null);
    if (!profile) error(503, 'Site metadata is temporarily unavailable.');
    let canonical: URL;
    try {
        canonical = new URL(profile.siteUrl);
        if (
            !['https:', 'http:'].includes(canonical.protocol)
            || canonical.username
            || canonical.password
        )
            throw new Error();
    } catch {
        error(503, 'Site metadata is temporarily unavailable.');
    }
    return {
        name: profile.name,
        username: profile.username,
        bio: profile.bio,
        headline: profile.headline,
        email: profile.email,
        manifest_settings: profile.manifestSettings,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
        siteUrl: canonical.origin
    };
}

export async function readPublishedPosts() {
    const { blog } = publicRepositories();
    const posts: {
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        summary: string | null;
        created_at: string;
        updated_at: string | null;
    }[] = [];
    try {
        for (let offset = 0; ; offset += 500) {
            const page = await blog.listPublished({ limit: 500, offset });
            posts.push(
                ...page.posts.map(post => ({
                    slug: post.slug,
                    title: post.title,
                    excerpt: post.excerpt,
                    summary: post.summary,
                    created_at: post.created_at,
                    updated_at: post.updated_at,
                    id: post.id
                }))
            );
            if (page.posts.length < 500) break;
        }
    } catch {
        error(503, 'Published content is temporarily unavailable.');
    }
    return posts;
}

export function validDate(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function markdownText(value: string): string {
    return value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>]/g, '\\$&');
}

export { publicResponse } from './publicResponse';
