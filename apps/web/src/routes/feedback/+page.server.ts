import type { PageServerLoad } from './$types';
import { publicRepositories } from '#lib/server/repositories.ts';

export const load: PageServerLoad = async ({ fetch }) => {
    const { author } = publicRepositories(fetch);
    const [contactInfo, authorProfile] = await Promise.all([
        author.contactLinks().catch(() => []),
        author.profile({ includeEmail: true }).catch(() => null)
    ]);
    const emailItem = contactInfo.find(
        c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
    );
    const contactEmail =
        emailItem ?
            (emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')).trim()
        :   (authorProfile?.email || '').trim();

    return { contactEmail };
};
