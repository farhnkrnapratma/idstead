import { workerBinding } from '#lib/server/workerEnv.ts';

export interface NewsletterMessage {
    postId: string;
    force?: boolean;
}

interface QueueProducer<T> {
    send(body: T): Promise<unknown>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isNewsletterMessage(value: unknown): value is NewsletterMessage {
    if (!value || typeof value !== 'object') return false;
    const message = value as Record<string, unknown>;
    return (
        typeof message.postId === 'string'
        && UUID_PATTERN.test(message.postId)
        && (message.force === undefined || typeof message.force === 'boolean')
    );
}

export async function enqueueNewsletter(message: NewsletterMessage): Promise<boolean> {
    const queue = await workerBinding<QueueProducer<NewsletterMessage>>('NEWSLETTER_QUEUE');
    if (!queue) return false;
    await queue.send(message);
    return true;
}
