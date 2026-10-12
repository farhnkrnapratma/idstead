export const POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const POST_SLUG_MAX_LENGTH = 100;

export function slugifyTitle(title: string): string {
    return title
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, POST_SLUG_MAX_LENGTH)
        .replace(/-+$/, '');
}

export function isValidPostSlug(slug: string): boolean {
    return slug.length <= POST_SLUG_MAX_LENGTH && POST_SLUG_PATTERN.test(slug);
}

export interface SlugChange {
    id: string;
    title: string;
    from: string;
    to: string;
}

export function planSlugRegeneration(
    posts: ReadonlyArray<{ id: string; title: string; slug: string }>
): SlugChange[] {
    const taken = new Set<string>();
    const changes: SlugChange[] = [];
    for (const post of posts) {
        const base = slugifyTitle(post.title) || post.slug;
        let candidate = base;
        for (let n = 2; taken.has(candidate); n++) {
            const suffix = `-${n}`;
            candidate = `${base.slice(0, POST_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`;
        }
        taken.add(candidate);
        if (candidate !== post.slug)
            changes.push({ id: post.id, title: post.title, from: post.slug, to: candidate });
    }
    return changes;
}
