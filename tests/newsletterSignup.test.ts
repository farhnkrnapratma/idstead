import { describe, expect, test } from 'bun:test';
import { newsletterSignupVisible } from '../packages/domain/src/newsletter.ts';

describe('newsletterSignupVisible', () => {
    test('shows the signup only with email delivery, a profile and a published post', () => {
        expect(
            newsletterSignupVisible({ configured: true, hasAuthor: true, hasPublishedPosts: true })
        ).toBe(true);
        for (const missing of ['configured', 'hasAuthor', 'hasPublishedPosts'] as const)
            expect(
                newsletterSignupVisible({
                    configured: true,
                    hasAuthor: true,
                    hasPublishedPosts: true,
                    [missing]: false
                })
            ).toBe(false);
    });
});
