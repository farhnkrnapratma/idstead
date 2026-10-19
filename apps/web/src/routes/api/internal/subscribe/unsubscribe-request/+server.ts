import { publicRepositories } from '#lib/server/repositories.ts';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { verifyTurnstileToken } from '#lib/server/turnstile.ts';
import { requestUnsubscribe } from '#lib/server/unsubscribeRequest.ts';
import {
    resendApiKey,
    senderAddress,
    sendEmail,
    unsubscribeEmail
} from '#lib/server/subscribers.ts';

export const POST: RequestHandler = ({ request, url, platform, getClientAddress }) => {
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
                    const profile = await publicRepositories()
                        .author.profile()
                        .catch(() => null);
                    return sendEmail(apiKey, from, {
                        to: email,
                        ...unsubscribeEmail(
                            profile?.name?.trim() || url.hostname,
                            `${url.origin}/unsubscribe?token=${token}`
                        )
                    });
                }
            :   null
    });
};
