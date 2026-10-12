import type { LayoutServerLoad } from './$types';
import { supabase } from '#lib/supabase.ts';
import { fetchAuthorProfileWithSocials } from '#lib/author.ts';
import { avatarSource } from '#lib/siteIdentity.ts';

export const load: LayoutServerLoad = async () => {
    const author = await fetchAuthorProfileWithSocials(supabase);
    return { author: author ? { ...author, avatar: avatarSource(author) } : author };
};
