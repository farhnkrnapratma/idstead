import { describe, expect, test } from 'bun:test';
import type {
    AdminActivityStore,
    AdminNotifier,
    BlogRepository,
    FeedbackRecorder
} from '../../packages/data/src/index.ts';

export interface ActivitySeed {
    posts: Array<{ uuid: string; publicId: string; slug: string }>;
    legalPages: string[];
    notifications: Array<{ id: string; kind: string; read: boolean; createdAt: string }>;
}

export type ActivityStoresFactory = (seed: ActivitySeed) => {
    blog: BlogRepository;
    feedback: FeedbackRecorder;
    notifier: AdminNotifier;
    activity: AdminActivityStore;
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const ACTIVITY_SEED: ActivitySeed = {
    posts: [{ uuid: uuid(1), publicId: 'a'.repeat(64), slug: 'hello' }],
    legalPages: ['privacy', 'terms'],
    notifications: [
        { id: uuid(21), kind: 'comment_new', read: false, createdAt: '2026-10-01T00:00:00Z' },
        { id: uuid(22), kind: 'helpful', read: true, createdAt: '2026-10-02T00:00:00Z' },
        { id: uuid(23), kind: 'comment_report', read: false, createdAt: '2026-10-03T00:00:00Z' }
    ]
};

const vote = (operation: number, value: 'yes' | 'no' = 'yes') => ({
    operationId: uuid(100 + operation),
    vote: value,
    ipHash: 'f'.repeat(64)
});

export function activityContract(name: string, factory: ActivityStoresFactory) {
    describe(`${name}: FeedbackRecorder contract`, () => {
        test('records a vote once and replays the same operation', async () => {
            const { blog, feedback } = factory(ACTIVITY_SEED);
            const post = (await blog.getPublishedBySlug('hello'))!;
            const target = { type: 'article' as const, post };
            expect(await feedback.record(target, vote(1))).toEqual({
                status: 'saved',
                recorded: true,
                replayed: false
            });
            expect(await feedback.record(target, vote(1))).toEqual({
                status: 'saved',
                recorded: true,
                replayed: true
            });
            expect(await feedback.record(target, vote(1, 'no'))).toEqual({
                status: 'operation-conflict'
            });
        });

        test('records legal pages and refuses unknown ones', async () => {
            const { feedback } = factory(ACTIVITY_SEED);
            expect(
                await feedback.record({ type: 'legal', page: 'privacy' }, vote(2, 'no'))
            ).toMatchObject({ status: 'saved', recorded: true });
            expect(await feedback.record({ type: 'legal', page: 'security' }, vote(3))).toEqual({
                status: 'target-not-found'
            });
        });
    });

    describe(`${name}: admin notification contract`, () => {
        test('marks notifications read once', async () => {
            const { notifier, activity } = factory(ACTIVITY_SEED);
            await notifier.notify('contact_message');
            expect(await activity.markRead(uuid(21))).toBe(1);
            expect(await activity.markRead(uuid(21))).toBe(0);
            expect(await activity.markRead(uuid(22))).toBe(0);
            expect(await activity.markAllRead()).toBe(2);
            expect(await activity.markAllRead()).toBe(0);
        });

        test('pins and removes notifications by ID', async () => {
            const { activity } = factory(ACTIVITY_SEED);
            expect(await activity.setPinned(uuid(23), true)).toBe(1);
            expect(await activity.setPinned(uuid(23), false)).toBe(1);
            expect(await activity.remove(uuid(23))).toBe(1);
            expect(await activity.remove(uuid(23))).toBe(0);
            expect(await activity.setPinned(uuid(23), true)).toBe(0);
        });
    });
}
