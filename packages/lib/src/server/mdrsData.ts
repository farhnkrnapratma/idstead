import type { SupabaseClient } from '@supabase/supabase-js';
import { DefineError, unavailableResolvers, type ApiRegistry } from '@fkp/mdrs';
import { createSupabaseBlogRepository, type BlogRepository } from '@fkp/data';
import { publicPostFields } from '@fkp/domain/blog.ts';
import {
    fetchAuthorProfile,
    fetchCvEntries,
    fetchFundingLinks,
    fetchContactInfo,
    fetchGroupedSkills,
    fetchSocials
} from '#lib/author.ts';
import { sanitizePublicApiData } from '#lib/authorApi.ts';
import { createMdrsResolvers, type MdrsDataLoaders } from '#lib/mdrsResolvers.ts';

async function authorData(db: SupabaseClient) {
    const [profile, cv, funding, contact, skills, socials] = await Promise.all([
        fetchAuthorProfile(db, { includeEmail: true }),
        fetchCvEntries(db),
        fetchFundingLinks(db),
        fetchContactInfo(db),
        fetchGroupedSkills(db),
        fetchSocials(db)
    ]);
    const combined = sanitizePublicApiData({ profile, cv, funding, contact, skills, socials });
    if (profile?.email && combined.profile) combined.profile.email = profile.email;
    return combined;
}

async function blogListData(blog: BlogRepository) {
    const { posts } = await blog.listPublished({ limit: 20 }).catch(() => {
        throw new DefineError('Could not fetch the blog post list.');
    });
    return posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        summary: post.summary,
        tldr: post.tldr,
        collaborators: post.collaborators,
        created_at: post.created_at,
        updated_at: post.updated_at
    }));
}

async function blogPostData(slug: string, blog: BlogRepository) {
    const post = await blog.getPublishedBySlug(slug).catch(() => null);
    if (!post) throw new DefineError(`api.v1.blog['${slug}'] does not resolve to a published post`);
    const content = (await blog.readMarkdown(post.source)) ?? '';
    return { ...publicPostFields(post), content };
}

export function supabaseMdrsLoaders(db: SupabaseClient): MdrsDataLoaders {
    const blog = createSupabaseBlogRepository(db);
    return {
        author: () => authorData(db),
        blogList: () => blogListData(blog),
        blogPost: slug => blogPostData(slug, blog)
    };
}

export function createSupabaseMdrsResolvers(db: SupabaseClient | null | undefined): ApiRegistry {
    return db ? createMdrsResolvers(supabaseMdrsLoaders(db)) : unavailableResolvers();
}
