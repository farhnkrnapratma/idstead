import {
    createSupabaseNewsletterStore,
    createSupabaseSubscriberRepository
} from '../packages/data/src/supabase/subscribers.ts';
import {
    subscriberRepositoryContract,
    type SubscriberSeed
} from './contracts/subscriberRepository.contract.ts';
import { fakeSupabase } from './support/fakeSupabase.ts';

function supabaseFromSeed(seed: SubscriberSeed) {
    let sequence = 0;
    const { db } = fakeSupabase(
        {
            db_subscribers: seed.subscribers.map((subscriber, i) => ({
                id: `subscriber-${i}`,
                email: subscriber.email,
                status: subscriber.status,
                unsubscribe_token: subscriber.unsubscribeToken,
                confirm_token_hash: subscriber.confirmTokenHash ?? null,
                confirm_sent_at: subscriber.confirmSentAt ?? null
            })),
            db_posts: seed.posts.map(post => ({
                id: post.id,
                title: post.title,
                slug: post.slug,
                excerpt: post.excerpt,
                published: post.published,
                subscribers_notified_at: post.sentAt
            }))
        },
        {},
        { defaults: { db_subscribers: () => ({ id: `subscriber-new-${++sequence}` }) } }
    );
    return {
        subscribers: createSupabaseSubscriberRepository(db),
        newsletter: createSupabaseNewsletterStore(db)
    };
}

subscriberRepositoryContract('Supabase adapter', supabaseFromSeed);
