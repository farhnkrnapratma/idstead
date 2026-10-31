// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as Sentry from '@sentry/cloudflare';
import { dataStores } from '#lib/server/data.ts';
import { notifyNewPost } from '#lib/server/subscriberBroadcast.ts';
import { isNewsletterMessage, type NewsletterMessage } from '#lib/server/newsletterQueue.ts';
import { cleanupBlogAssets } from '#lib/server/blogBannerStorage.ts';
import { cleanupAssets } from '#lib/server/profileAssets.ts';
import { refreshPostRenders } from '#lib/server/postRender.ts';
import { isRenderRefreshMessage } from '#lib/server/renderQueue.ts';
import { mdrsResolvers } from '#lib/server/mdrsData.ts';
import { siteRenderOptions } from '#lib/mdrsOptions.ts';
import { writesFrozen } from '#lib/server/writeFreeze.ts';

export interface Env {
    PUBLIC_SITE_URL?: string;
    PUBLIC_SENTRY_DSN?: string;
    PUBLIC_SENTRY_ENVIRONMENT?: string;
    HOURLY_CRON?: string;
    [key: string]: unknown;
}

async function deliver(message: Message<unknown>, env: Env) {
    if (!isNewsletterMessage(message.body)) {
        console.error('Dropping malformed newsletter message', message.id);
        message.ack();
        return;
    }
    const body: NewsletterMessage = message.body;
    const service = dataStores({ env }).service;
    const result = await notifyNewPost(
        service.writers.newsletter,
        { env },
        body.postId,
        body.force === true
    );
    if (result.reason === 'send-failed')
        Sentry.captureMessage('Newsletter send failed', {
            level: 'warning',
            extra: { postId: body.postId, sent: result.sent, failed: result.failed }
        });
    if (result.reason === 'unavailable' || result.reason === 'send-failed')
        message.retry({ delaySeconds: 300 });
    else message.ack();
}

function deadLetter(message: Message<unknown>) {
    const body = isNewsletterMessage(message.body) ? message.body : null;
    Sentry.captureMessage('Newsletter message dead-lettered', {
        level: 'error',
        extra: {
            postId: body?.postId ?? null,
            force: body?.force === true,
            messageId: message.id,
            attempts: message.attempts
        }
    });
    message.ack();
}

async function refreshRenders(env: Env) {
    const service = dataStores({ env }).service;
    const result = await refreshPostRenders(
        service.renders,
        mdrsResolvers(service),
        siteRenderOptions(env.PUBLIC_SITE_URL)
    );
    if (result.failed)
        Sentry.captureMessage('Post render refresh failed', {
            level: 'warning',
            extra: { ...result }
        });
    return result;
}

async function hourly(env: Env) {
    const service = dataStores({ env }).service;
    await service.maintenance.pruneLockoutFailures().catch(error => Sentry.captureException(error));
}

async function cleanup(env: Env) {
    const service = dataStores({ env }).service;
    const results = await Promise.allSettled([
        cleanupBlogAssets(service.adminPosts, { env } as App.Platform),
        service.maintenance.pruneStaleSubscriptions(),
        service.maintenance.pruneActivityLog(),
        service.oidcAuth.prune(),
        cleanupAssets({ env } as App.Platform),
        refreshRenders(env)
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
            if (batch.queue.endsWith('-dlq')) {
                batch.messages.forEach(deadLetter);
                return;
            }
            if (writesFrozen({ env })) {
                batch.messages.forEach(message => message.retry({ delaySeconds: 300 }));
                return;
            }
            const refreshes = batch.messages.filter(message =>
                isRenderRefreshMessage(message.body)
            );
            if (refreshes.length) {
                try {
                    await refreshRenders(env);
                    refreshes.forEach(message => message.ack());
                } catch (error) {
                    Sentry.captureException(error);
                    refreshes.forEach(message => message.retry({ delaySeconds: 300 }));
                }
            }
            await Promise.all(
                batch.messages
                    .filter(message => !isRenderRefreshMessage(message.body))
                    .map(message =>
                        deliver(message, env).catch(error => {
                            Sentry.captureException(error);
                            message.retry({ delaySeconds: 300 });
                        })
                    )
            );
        },
        async scheduled(controller, env, ctx) {
            if (writesFrozen({ env })) return;
            ctx.waitUntil(controller.cron === env.HOURLY_CRON ? hourly(env) : cleanup(env));
        }
    } satisfies ExportedHandler<Env>
);
