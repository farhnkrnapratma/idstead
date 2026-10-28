import { DefineError, unavailableResolvers, type ApiRegistry } from '@mdrs/core';
import type { AuthorRepository, BlogRepository, Repositories } from '@idstead/data';
import { publicPostFields } from '@idstead/domain/blog.ts';
import { sanitizePublicApiData } from '#lib/authorApi.ts';
import { createMdrsResolvers, type MdrsDataLoaders } from '#lib/mdrsResolvers.ts';

async function authorData(author: AuthorRepository) {
    const [profile, cv, funding, contact, skills, socials] = await Promise.all([
        author.profile({ includeEmail: true }).catch(() => null),
        author.cvEntries().catch(() => ({ experience: [], education: [] })),
        author.fundingLinks().catch(() => []),
        author.contactLinks().catch(() => []),
        author.skillGroups().catch(() => []),
        author.socialLinks().catch(() => [])
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

export type MdrsRepositories = Pick<Repositories, 'author' | 'blog'>;

export function mdrsLoaders({ author, blog }: MdrsRepositories): MdrsDataLoaders {
    return {
        author: () => authorData(author),
        blogList: () => blogListData(blog),
        blogPost: slug => blogPostData(slug, blog)
    };
}

export function mdrsResolvers(repos: MdrsRepositories | null | undefined): ApiRegistry {
    return repos ? createMdrsResolvers(mdrsLoaders(repos)) : unavailableResolvers();
}
