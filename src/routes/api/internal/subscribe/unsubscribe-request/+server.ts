import type {RequestHandler} from './$types';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {verifyTurnstileToken} from '$lib/server/turnstile';
import {requestUnsubscribe} from '$lib/server/unsubscribeRequest';
import {
  resendApiKey,
  senderAddress,
  sendEmail,
  unsubscribeEmail
} from '$lib/server/subscribers';
import {fetchAuthorProfile} from '$lib/author';
import {supabase} from '$lib/supabase';

export const POST: RequestHandler = ({
  request,
  url,
  platform,
  getClientAddress
}) => {
  const apiKey = resendApiKey(platform);
  const from = senderAddress(platform);
  return requestUnsubscribe({
    request,
    url,
    db: getSupabaseAdminClient(platform),
    verify: token => verifyTurnstileToken(token, getClientAddress(), platform),
    send:
      apiKey && from ?
        async (email, token) => {
          const profile = await fetchAuthorProfile(supabase);
          return sendEmail(apiKey, from, {
            to: email,
            ...unsubscribeEmail(
              profile?.name?.trim() || url.hostname,
              `${url.origin}/unsubscribe?token=${token}`
            )
          });
        }
      : null
  });
};
