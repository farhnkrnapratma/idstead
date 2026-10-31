// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { NewsletterStore } from '@idstead/data';
import { notifyNewPost } from './subscriberBroadcast';
import { runInBackground } from './workerEnv';
import { enqueueNewsletter } from './newsletterQueue';
import { enqueueRenderRefresh } from './renderQueue';

export async function queuePostEffects(
    newsletter: NewsletterStore,
    platform: App.Platform | undefined,
    {
        postId,
        published,
        wasPublished
    }: { postId: string; published: boolean; wasPublished: boolean }
) {
    if (published) {
        const queued = await enqueueNewsletter({ postId }).catch(error => {
            console.error('Could not queue the subscriber broadcast:', error);
            return false;
        });
        if (!queued)
            await runInBackground(
                notifyNewPost(newsletter, platform, postId).catch(error => {
                    console.error('Subscriber broadcast failed:', error);
                })
            );
    }
    if (published || wasPublished)
        await enqueueRenderRefresh().catch(error => {
            console.error('Could not queue the post render refresh:', error);
        });
}
