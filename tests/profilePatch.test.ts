// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { ProfileInputError, profilePatch } from '../packages/lib/src/server/profilePatch.ts';

const full = {
    name: ' Ada Lovelace ',
    username: '@ada lovelace',
    headline: 'Engineer',
    job_title: 'Analyst',
    bio: 'Bio',
    email: 'ada@example.com',
    city: 'London',
    postal_code: 'N1',
    country: 'UK',
    site_url: 'https://example.com/',
    pronunciation: ''
};

function failure(payload: Record<string, unknown>, current: Record<string, unknown> | null) {
    try {
        profilePatch(payload, current);
    } catch (error) {
        expect(error).toBeInstanceOf(ProfileInputError);
        return (error as ProfileInputError).fields;
    }
    throw new Error('expected a failure');
}

describe('profilePatch', () => {
    test('normalises a full create payload', () => {
        const patch = profilePatch({ id: 'p', revision: 1, ...full }, null);
        expect(patch).toMatchObject({
            id: 'p',
            revision: 1,
            name: 'Ada Lovelace',
            username: 'adalovelace',
            site_url: 'https://example.com',
            pronunciation: '',
            manifest_settings: { display: 'standalone' }
        });
    });

    test('only patches changed fields on update', () => {
        const current = {
            ...full,
            name: 'Ada Lovelace',
            username: 'ada',
            site_url: 'https://example.com',
            manifest_settings: { display: 'standalone' }
        };
        const unchanged = profilePatch({ id: 'p', revision: 2, name: 'Ada Lovelace' }, current);
        expect(unchanged).toEqual({ id: 'p', revision: 2 });
        const changed = profilePatch(
            { id: 'p', revision: 2, bio: 'New', username: 'ada', pronunciation: 'ay-da' },
            current
        );
        expect(changed).toMatchObject({ bio: 'New', pronunciation: 'ay-da' });
        expect(changed).not.toHaveProperty('username');
        expect(profilePatch({ pronunciation: undefined }, { ...current })).not.toHaveProperty(
            'pronunciation'
        );
        const reset = profilePatch(
            { id: 'p', revision: 2, manifest_settings: { display: 'standalone' } },
            { ...current, manifest_settings: { display: 'browser' } }
        );
        expect(reset.manifest_settings).toEqual({ display: 'standalone' });
    });

    test('rejects unknown fields', () => {
        expect(failure({ ...full, extra: 1 }, null)).toEqual({ profile: 'Unknown profile field.' });
    });

    test('rejects invalid values per field', () => {
        const errors = failure(
            {
                ...full,
                name: 5,
                username: '   ',
                headline: 'x'.repeat(251),
                job_title: 'bad\u0000',
                bio: 'x'.repeat(5001),
                email: 'nope',
                city: 'a\u007f',
                postal_code: 'a\u000bb',
                country: 'a\u000cb',
                site_url: 'ftp://example.com'
            },
            null
        );
        expect(Object.keys(errors).sort()).toEqual([
            'bio',
            'city',
            'country',
            'email',
            'headline',
            'job_title',
            'name',
            'postal_code',
            'site_url',
            'username'
        ]);
        expect(errors.name).toBe('Invalid name.');
        expect(errors.email).toBe('Please enter a valid email address.');
        expect(errors.site_url).toBe('Site URL must be an HTTP or HTTPS origin.');
        expect(errors.job_title).toBe('Invalid job title.');
    });

    test('rejects site urls that are not plain origins', () => {
        for (const site_url of [
            'https://user:pw@example.com',
            'https://user@example.com',
            'https://example.com/path',
            'https://example.com/?q=1',
            'https://example.com/#x',
            'not a url'
        ]) {
            expect(failure({ ...full, site_url }, null).site_url).toContain('HTTP');
        }
        expect(profilePatch({ ...full, site_url: 'http://example.com:8080' }, null).site_url).toBe(
            'http://example.com:8080'
        );
    });

    test('rejects control characters in the pronunciation', () => {
        expect(failure({ ...full, pronunciation: 'a\u001fb' }, null).pronunciation).toBe(
            'Invalid pronunciation.'
        );
        expect(failure({ ...full, pronunciation: 'x'.repeat(251) }, null).pronunciation).toContain(
            'Invalid'
        );
    });

    test('validates manifest settings', () => {
        for (const manifest_settings of [
            null,
            [],
            'standalone',
            { display: 'bogus' },
            { display: 'standalone', extra: 1 }
        ]) {
            expect(failure({ ...full, manifest_settings }, null).manifest_settings).toBe(
                'Invalid display setting.'
            );
        }
        const patch = profilePatch(
            {
                ...full,
                manifest_settings: {
                    display: 'browser',
                    theme_color: '#fff',
                    background_color: '#000'
                }
            },
            null
        );
        expect(patch.manifest_settings).toEqual({ display: 'standalone' });
    });

    test('uses the first error as the message', () => {
        try {
            profilePatch({ ...full, name: 5 }, null);
        } catch (error) {
            expect((error as Error).message).toBe('Invalid name.');
        }
    });
});
