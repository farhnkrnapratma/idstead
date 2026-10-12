import * as Sentry from '@sentry/cloudflare';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { notifyNewPost } from '#lib/server/subscriberBroadcast.ts';
import { isNewsletterMessage, type NewsletterMessage } from '#lib/server/newsletterQueue.ts';
import { cleanupBlogAssets } from '#lib/server/blogBannerStorage.ts';
import { cleanupAssets } from '#lib/server/profileAssets.ts';

export interface Env {
    PUBLIC_SITE_URL?: string;
    PUBLIC_SENTRY_DSN?: string;
    PUBLIC_SENTRY_ENVIRONMENT?: string;
    [key: string]: unknown;
}

const DEFAULT_SITE_URL = 'https://fkp.my.id';

async function deliver(message: Message<unknown>, env: Env) {
    if (!isNewsletterMessage(message.body)) {
        console.error('Dropping malformed newsletter message', message.id);
        message.ack();
        return;
    }
    const body: NewsletterMessage = message.body;
    const db = getSupabaseAdminClient({ env });
    if (!db) {
        message.retry({ delaySeconds: 300 });
        return;
    }
    const result = await notifyNewPost(
        db,
        { env },
        env.PUBLIC_SITE_URL || DEFAULT_SITE_URL,
        body.postId,
        body.force === true
    );
    if (result.reason === 'unavailable') message.retry({ delaySeconds: 300 });
    else message.ack();
}

async function cleanup(env: Env) {
    const db = getSupabaseAdminClient({ env });
    const results = await Promise.allSettled([
        db ? cleanupBlogAssets(db, { env } as App.Platform) : Promise.resolve(null),
        cleanupAssets({ env } as App.Platform)
    ]);
    results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .forEach(result => Sentry.captureException(result.reason));
}

export default Sentry.withSentry<Env>(
    env => ({
        dsn: env.PUBLIC_SENTRY_DSN || '',
        environment: env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
        tracesSampleRate: 1.0
    }),
    {
        async fetch() {
            return new Response('Not found', { status: 404 });
        },
        async queue(batch, env) {
            await Promise.all(
                batch.messages.map(message =>
                    deliver(message, env).catch(error => {
                        Sentry.captureException(error);
                        message.retry({ delaySeconds: 300 });
                    })
                )
            );
        },
        async scheduled(_controller, env, ctx) {
            ctx.waitUntil(cleanup(env));
        }
    } satisfies ExportedHandler<Env>
);
