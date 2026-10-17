export interface PublicPostFields {
    id: string;
    title: string;
    slug: string;
    pinned: boolean;
    created_at: string;
    updated_at: string | null;
    excerpt: string | null;
    tags: string[];
    collaborators: string[];
    summary: string | null;
    tldr: string[];
}

export function publicPostFields(post: Record<string, unknown>): PublicPostFields {
    const strings = (value: unknown) =>
        Array.isArray(value) ?
            value.filter((item): item is string => typeof item === 'string')
        :   [];
    const text = (value: unknown) => (typeof value === 'string' ? value : null);
    return {
        id: String(post.public_id),
        title: String(post.title ?? ''),
        slug: String(post.slug ?? ''),
        pinned: post.pinned === true,
        created_at: String(post.created_at ?? ''),
        updated_at: text(post.updated_at),
        excerpt: text(post.excerpt),
        tags: strings(post.tags),
        collaborators: strings(post.collaborators),
        summary: text(post.summary),
        tldr: strings(post.tldr)
    };
}
