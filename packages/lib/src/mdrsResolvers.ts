import {
    DefineError,
    jsToDefineValue,
    unavailableResolvers,
    walkPath,
    type ApiRegistry,
    type DefineValue
} from '@fkp/mdrs';
import {
    fetchAuthorProfile,
    fetchCvEntries,
    fetchFundingLinks,
    fetchContactInfo,
    fetchGroupedSkills,
    fetchSocials
} from '#lib/author.ts';
import { sanitizePublicApiData } from '#lib/authorApi.ts';

export function createMdrsResolvers(supabaseClient: any): ApiRegistry {
    if (!supabaseClient) return unavailableResolvers();
    let author: Promise<DefineValue> | null = null;
    let blogList: Promise<DefineValue> | null = null;
    const blogPosts = new Map<string, Promise<DefineValue>>();
    return {
        author: async path => {
            author ??= fetchAuthorValue(supabaseClient);
            return walkPath(await author, path);
        },
        blog: async path => {
            const [first, ...rest] = path;
            if (first && first.kind === 'index' && typeof first.value === 'string') {
                const slug = first.value;
                if (!blogPosts.has(slug)) blogPosts.set(slug, fetchBlogPost(slug, supabaseClient));
                return walkPath(await blogPosts.get(slug)!, rest);
            }
            blogList ??= fetchBlogList(supabaseClient);
            return walkPath(await blogList, path);
        }
    };
}

async function fetchAuthorValue(supabaseClient: any): Promise<DefineValue> {
    const [profile, cv, funding, contact, skills, socials] = await Promise.all([
        fetchAuthorProfile(supabaseClient, { includeEmail: true }),
        fetchCvEntries(supabaseClient),
        fetchFundingLinks(supabaseClient),
        fetchContactInfo(supabaseClient),
        fetchGroupedSkills(supabaseClient),
        fetchSocials(supabaseClient)
    ]);
    const combined = sanitizePublicApiData({ profile, cv, funding, contact, skills, socials });
    if (profile?.email && combined.profile) {
        combined.profile.email = profile.email;
    }
    return jsToDefineValue(combined);
}

async function fetchBlogPost(slug: string, supabaseClient: any): Promise<DefineValue> {
    const { data: post, error } = await supabaseClient
        .from('db_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();

    if (error || !post) {
        throw new DefineError(`api.v1.blog['${slug}'] does not resolve to a published post`);
    }

    let content = '';
    if (post.storage_path) {
        try {
            const { data: urlData } = supabaseClient.storage
                .from('blog-posts')
                .getPublicUrl(post.storage_path);
            const fileRes = await fetch(urlData.publicUrl);
            if (fileRes.ok) content = await fileRes.text();
        } catch {}
    }

    const { id: _internalId, public_id: publicId, storage_path: _storagePath, ...fields } = post;
    return jsToDefineValue({ ...fields, id: publicId, content });
}

async function fetchBlogList(supabaseClient: any): Promise<DefineValue> {
    const { data: posts, error } = await supabaseClient
        .from('db_posts')
        .select(
            'public_id, title, slug, excerpt, summary, tldr, collaborators, created_at, updated_at'
        )
        .eq('published', true)
        .order('created_at', { ascending: false })
        .range(0, 19);

    if (error) {
        throw new DefineError('Could not fetch the blog post list.');
    }

    return jsToDefineValue(
        ((posts ?? []) as Array<Record<string, unknown>>).map(({ public_id, ...post }) => ({
            id: public_id,
            ...post
        }))
    );
}
