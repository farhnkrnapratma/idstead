import {
    DefineError,
    jsToDefineValue,
    unavailableResolvers,
    walkPath,
    type ApiRegistry,
    type DefineValue,
    type PathSegment
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
    return {
        author: path => resolveAuthorPath(path, supabaseClient),
        blog: path => resolveBlogPath(path, supabaseClient)
    };
}

async function resolveAuthorPath(path: PathSegment[], supabaseClient: any): Promise<DefineValue> {
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
    return walkPath(jsToDefineValue(combined), path);
}

async function resolveBlogPath(path: PathSegment[], supabaseClient: any): Promise<DefineValue> {
    const [first, ...rest] = path;

    if (first && first.kind === 'index' && typeof first.value === 'string') {
        const slug = first.value;
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

        const {
            id: _internalId,
            public_id: publicId,
            storage_path: _storagePath,
            ...fields
        } = post;
        return walkPath(jsToDefineValue({ ...fields, id: publicId, content }), rest);
    }

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

    return walkPath(
        jsToDefineValue(
            ((posts ?? []) as Array<Record<string, unknown>>).map(({ public_id, ...post }) => ({
                id: public_id,
                ...post
            }))
        ),
        path
    );
}
