import { describe, expect, test } from 'bun:test';
import { sanitizePublicApiData } from '../packages/lib/src/authorApi';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe('sanitizePublicApiData', () => {
    test('drops every asset version and row ID from the public profile', () => {
        const profile = sanitizePublicApiData({
            id: '095f788c-811a-4cd2-9d70-91bee2312198',
            avatarVersion: '63275289-33d2-4381-946a-3d2a2da64f37',
            bannerVersion: '63275289-33d2-4381-946a-3d2a2da64f37',
            name: 'Ada',
            socialLinks: [{ id: '19b41459-6dc4-4db6-b18a-4deed85eed50', url: 'https://x.test' }]
        });

        expect(JSON.stringify(profile)).not.toMatch(UUID_RE);
        expect(profile).toEqual({ name: 'Ada', socialLinks: [{ url: 'https://x.test' }] });
    });
});
