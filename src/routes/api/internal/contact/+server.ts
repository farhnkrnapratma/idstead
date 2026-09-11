import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {verifyTurnstileToken} from '$lib/server/turnstile';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfile, fetchContactInfo} from '$lib/author';

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_URL = 2048;
const MAX_MESSAGE = 5000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactKind = 'message' | 'feedback';

const SUBJECTS: Record<ContactKind, string> = {
  message: 'New message from portfolio website!',
  feedback: 'New feedback report from website!'
};

const NOTIFICATION_KINDS: Record<ContactKind, string> = {
  message: 'contact_message',
  feedback: 'feedback_report'
};

async function resolveContactEmail(): Promise<string> {
  const [contactInfo, authorProfile] = await Promise.all([
    fetchContactInfo(supabase),
    fetchAuthorProfile(supabase, {includeEmail: true})
  ]);
  const emailItem = contactInfo.find(
    c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
  );
  return emailItem ?
      (emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')).trim()
    : (authorProfile?.email || '').trim();
}

export const POST: RequestHandler = async ({
  request,
  url,
  platform,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
  }

  const kind: ContactKind =
    body?.kind === 'feedback' ? 'feedback'
    : body?.kind === 'message' ? 'message'
    : ('' as ContactKind);

  if (!kind) {
    return apiError(
      400,
      'CONTACT_KIND_INVALID',
      'kind must be "message" or "feedback".'
    );
  }

  const turnstileToken =
    typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    getClientAddress(),
    platform
  );
  if (!turnstileOk) {
    return apiError(
      403,
      'CONTACT_TURNSTILE_FAILED',
      'Turnstile verification failed.'
    );
  }

  const name =
    typeof body?.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  const email =
    typeof body?.email === 'string' ?
      body.email.trim().slice(0, MAX_EMAIL)
    : '';
  const message =
    typeof body?.message === 'string' ?
      body.message.trim().slice(0, MAX_MESSAGE)
    : '';
  const pageUrl =
    typeof body?.url === 'string' ? body.url.trim().slice(0, MAX_URL) : '';

  if (!name) {
    return apiError(400, 'CONTACT_NAME_REQUIRED', 'name is required.');
  }
  if (!email || !EMAIL_RE.test(email)) {
    return apiError(
      400,
      'CONTACT_EMAIL_INVALID',
      'email must be a valid email address.'
    );
  }
  if (!message) {
    return apiError(400, 'CONTACT_MESSAGE_REQUIRED', 'message is required.');
  }
  if (kind === 'feedback' && !pageUrl) {
    return apiError(
      400,
      'CONTACT_URL_REQUIRED',
      'url is required for feedback reports.'
    );
  }

  let contactEmail: string;
  try {
    contactEmail = await resolveContactEmail();
  } catch (err) {
    console.error('Failed to resolve contact email:', err);
    return apiError(
      500,
      'CONTACT_RECIPIENT_LOOKUP_FAILED',
      'Could not resolve the recipient address.'
    );
  }

  if (!contactEmail) {
    return apiError(
      503,
      'CONTACT_UNAVAILABLE',
      'Message submission is currently unavailable.'
    );
  }

  const referer =
    request.headers.get('referer')
    || request.headers.get('origin')
    || url.origin;

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
          ...(pageUrl ? {url: pageUrl} : {}),
          message,
          _subject: SUBJECTS[kind],
          _captcha: 'false'
        })
      }
    );

    const data: any = await res.json().catch(() => null);
    if (!res.ok || data?.success === 'false' || data?.success === false) {
      console.error('FormSubmit rejected the submission:', data);
      return apiError(
        502,
        'CONTACT_DELIVERY_FAILED',
        'The message could not be delivered.'
      );
    }
  } catch (err) {
    console.error('FormSubmit request failed:', err);
    return apiError(
      502,
      'CONTACT_DELIVERY_FAILED',
      'The message could not be delivered.'
    );
  }

  const adminClient = getSupabaseAdminClient(platform);
  if (adminClient) {
    const {error} = await adminClient
      .from('db_admin_notifications')
      .insert({kind: NOTIFICATION_KINDS[kind]});
    if (error) {
      console.error('Failed to record admin notification:', error);
    }
  }

  return json({success: true}, {status: 201});
};
