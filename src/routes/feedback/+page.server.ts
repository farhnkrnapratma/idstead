import type {Actions, PageServerLoad} from './$types';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfile, fetchContactInfo} from '$lib/author';
import {fail} from '@sveltejs/kit';

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

export const actions: Actions = {
  default: async ({request, url: requestUrl}) => {
    const data = await request.formData();
    const name = data.get('name')?.toString().trim() || '';
    const email = data.get('email')?.toString().trim() || '';
    const url = data.get('url')?.toString().trim() || '';
    const message = data.get('message')?.toString().trim() || '';

    if (!name || !email || !url || !message) {
      return fail(400, {missing: true});
    }

    const [contactInfo, authorProfile] = await Promise.all([
      fetchContactInfo(supabase),
      fetchAuthorProfile(supabase, {includeEmail: true})
    ]);
    const emailItem = contactInfo.find(
      c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
    );
    const contactEmail =
      emailItem ?
        (
          emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')
        ).trim()
      : (authorProfile?.email || '').trim();

    if (!contactEmail) {
      return fail(500, {unavailable: true});
    }

    const referer =
      request.headers.get('referer')
      || request.headers.get('origin')
      || requestUrl.origin;

    try {
      const res = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(contactEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Referer: referer
          },
          body: JSON.stringify({
            name,
            email,
            url,
            message,
            _subject: 'New feedback report from website!',
            _captcha: 'false'
          })
        }
      );

      const resData = await res.json().catch(() => null);
      if (
        !res.ok
        || resData?.success === 'false'
        || resData?.success === false
      ) {
        return fail(500, {
          failed: true,
          message:
            typeof resData?.message === 'string' ? resData.message : undefined
        });
      }

      return {success: true};
    } catch {
      return fail(500, {failed: true});
    }
  }
};
