import { supabase } from '#lib/supabase.ts';
import { fetchAuthorProfile, fetchContactInfo } from '#lib/author.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const [contact, profile] = await Promise.all([
        fetchContactInfo(supabase),
        fetchAuthorProfile(supabase, { includeEmail: true })
    ]);
    const hasEmailChannel = contact.some(
        item => item.platform.toLowerCase() === 'email' || item.href.startsWith('mailto:')
    );
    return { contact, canSendMessage: hasEmailChannel || Boolean(profile?.email?.trim()) };
};
