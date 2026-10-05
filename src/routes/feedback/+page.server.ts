import type {PageServerLoad} from './$types';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfile, fetchContactInfo} from '$lib/author';

export const load: PageServerLoad = async () => {
  const [contactInfo, authorProfile] = await Promise.all([
    fetchContactInfo(supabase),
    fetchAuthorProfile(supabase, {includeEmail: true})
  ]);
  const emailItem = contactInfo.find(
    c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
  );
  const contactEmail =
    emailItem ?
      (emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')).trim()
    : (authorProfile?.email || '').trim();

  return {contactEmail};
};
