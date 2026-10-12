import { supabase } from '#lib/supabase.ts';
import type { PageServerLoad } from './$types';
import { avatarSource } from '#lib/siteIdentity.ts';
import type { Project } from '#lib/types.ts';
import { decodeHtmlEntities } from '#lib/utils/formatters.ts';
import { fetchProjects, extractGitHubUsername } from '#lib/server/githubProjects.ts';
import {
    fetchAuthorProfileWithSocials,
    fetchCvEntries,
    fetchFundingLinks,
    fetchContactInfo,
    fetchGroupedSkills,
    fetchActiveCvDocument,
    fetchProjectRepoRules
} from '#lib/author.ts';
import { estimateReadTime } from '#lib/readTime.ts';
import { publicBannerUrl } from '#lib/blogBanner.ts';

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    pinned: boolean;
    storage_path: string;
    banner_version?: string | null;
    bannerPublicUrl?: string | null;
    created_at: string;
    updated_at?: string | null;
    excerpt?: string | null;
    content: string;
    read_time?: string;
    comment_count?: number;
    views_count?: number;
    tags?: string[];
}

export const load: PageServerLoad = async ({ fetch, platform, locals }) => {
    const supabaseClient = (locals as any)?.supabase || supabase;

    const [author, cv, funding, contact, skillsGrouped, cvDocument, repoRules] = await Promise.all([
        fetchAuthorProfileWithSocials(supabaseClient, { includeEmail: true }),
        fetchCvEntries(supabaseClient),
        fetchFundingLinks(supabaseClient),
        fetchContactInfo(supabaseClient),
        fetchGroupedSkills(supabaseClient),
        fetchActiveCvDocument(supabaseClient, fetch),
        fetchProjectRepoRules(supabaseClient)
    ]);

    const githubUsername = extractGitHubUsername(author);
    const projectsPromise =
        githubUsername ?
            fetchProjects(githubUsername, fetch, platform, repoRules.excluded)
        :   Promise.resolve<Project[]>([]);
    const postsPromise = (async () => {
        try {
            const { data, error } = await supabase
                .from('db_posts')
                .select('*')
                .eq('published', true)
                .order('created_at', { ascending: false });
            if (error || !data) return [];

            return await Promise.all(
                data.map(async post => {
                    const readTimePromise = (async () => {
                        try {
                            const { data: urlData } = supabase.storage
                                .from('blog-posts')
                                .getPublicUrl(post.storage_path);
                            const fileRes = await fetch(urlData.publicUrl, {
                                signal: AbortSignal.timeout(3000)
                            }).catch(() => null);
                            if (!fileRes?.ok) return '1 min read';
                            return estimateReadTime(await fileRes.text());
                        } catch (err) {
                            console.error(err);
                            return '1 min read';
                        }
                    })();
                    const commentCountPromise = (async () => {
                        try {
                            const { count } = await supabase
                                .from('db_comments')
                                .select('*', { count: 'exact', head: true })
                                .eq('post_id', post.id)
                                .eq('is_approved', true);
                            return count ?? 0;
                        } catch (err) {
                            console.error(err);
                            return 0;
                        }
                    })();
                    const viewsCountPromise = (async () => {
                        try {
                            const { count } = await supabase
                                .from('db_views')
                                .select('*', { count: 'exact', head: true })
                                .eq('post_id', post.id);
                            return count ?? 0;
                        } catch (err) {
                            console.error(err);
                            return 0;
                        }
                    })();
                    const [readTime, commentCount, viewsCount] = await Promise.all([
                        readTimePromise,
                        commentCountPromise,
                        viewsCountPromise
                    ]);

                    const { id: _internalId, public_id: publicId, ...publicPost } = post;
                    return {
                        ...publicPost,
                        id: publicId as string,
                        bannerPublicUrl: publicBannerUrl(post),
                        tags:
                            Array.isArray(post.tags) ?
                                post.tags.map(decodeHtmlEntities)
                            :   post.tags,
                        read_time: readTime,
                        comment_count: commentCount,
                        views_count: viewsCount
                    };
                })
            );
        } catch (err) {
            console.error(err);
            return [];
        }
    })();
    const [projects, dbPosts] = await Promise.all([projectsPromise, postsPromise]);

    return {
        projects,
        pinnedRepoNames: repoRules.pinned,
        posts: dbPosts,
        author: author ? { ...author, avatar: avatarSource(author) } : author,
        cv,
        funding,
        contact,
        skills: skillsGrouped,
        cvExists: Boolean(cvDocument?.fileUrl)
    };
};
