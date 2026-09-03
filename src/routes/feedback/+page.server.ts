import type {Actions, PageServerLoad} from './$types';
import {supabase} from '$lib/supabase';
import {fetchContactInfo} from '$lib/author';
import {fail} from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const contactInfo = await fetchContactInfo(supabase);
  const emailItem = contactInfo.find(
    c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
  );
  const contactEmail =
    emailItem ?
      (emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')).trim()
    : '';

  return {contactEmail};
};

export const actions: Actions = {
  default: async ({request}) => {
    const data = await request.formData();
    const name = data.get('name')?.toString().trim() || '';
    const email = data.get('email')?.toString().trim() || '';
    const url = data.get('url')?.toString().trim() || '';
    const message = data.get('message')?.toString().trim() || '';

    if (!name || !email || !url || !message) {
      return fail(400, {missing: true});
    }

    const contactInfo = await fetchContactInfo(supabase);
    const emailItem = contactInfo.find(
      c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
    );
    const contactEmail =
      emailItem ?
        (
          emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')
        ).trim()
      : '';

    if (!contactEmail) {
      return fail(500, {unavailable: true});
    }

    try {
      const res = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(contactEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            name,
            email,
            url,
            message,
            _subject: 'New feedback report from website!'
          })
        }
      );

      if (!res.ok) {
        return fail(500, {failed: true});
      }

      return {success: true};
    } catch {
      return fail(500, {failed: true});
    }
  }
};
