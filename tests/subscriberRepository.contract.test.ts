import {
    subscriberRepositoryContract,
    type SubscriberSeed
} from './contracts/subscriberRepository.contract.ts';
import {
    createD1NewsletterStore,
    createD1SubscriberRepository
} from '../packages/data/src/d1/subscribers.ts';
import { d1Shim, insertRows } from './support/d1.ts';

function d1FromSeed(seed: SubscriberSeed) {
    const { db, sqlite } = d1Shim();
    insertRows(
        sqlite,
        'db_subscribers',
        seed.subscribers.map(subscriber => ({
            email: subscriber.email,
            status: subscriber.status,
            unsubscribe_token: subscriber.unsubscribeToken,
            confirm_token_hash: subscriber.confirmTokenHash ?? null,
            confirm_sent_at: subscriber.confirmSentAt ?? null
        }))
    );
    insertRows(
        sqlite,
        'db_posts',
        seed.posts.map(post => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? (post.published ? 'Excerpt' : null),
            published: post.published,
            storage_path: `posts/${post.id}/content.md`,
            subscribers_notified_at: post.sentAt
        }))
    );
    return {
        subscribers: createD1SubscriberRepository(db),
        newsletter: createD1NewsletterStore(db)
    };
}

subscriberRepositoryContract('D1 adapter', d1FromSeed);
