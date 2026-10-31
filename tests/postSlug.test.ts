// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    isValidPostSlug,
    planSlugRegeneration,
    slugifyTitle
} from '../packages/domain/src/slug.ts';

describe('post slugs', () => {
    test('keeps numbers from the title', () => {
        expect(slugifyTitle('Update GNOME 51')).toBe('update-gnome-51');
        expect(slugifyTitle("October Is One of Linux's Best Months")).toBe(
            'october-is-one-of-linuxs-best-months'
        );
        expect(slugifyTitle('  Café -- 2026 / Recap ')).toBe('cafe-2026-recap');
    });

    test('accepts lowercase alphanumeric slugs only', () => {
        expect(isValidPostSlug('update-gnome-51')).toBe(true);
        expect(isValidPostSlug('2026')).toBe(true);
        expect(isValidPostSlug('Update-GNOME')).toBe(false);
        expect(isValidPostSlug('bad--slug')).toBe(false);
        expect(isValidPostSlug('-lead')).toBe(false);
        expect(isValidPostSlug('a'.repeat(101))).toBe(false);
    });
});

describe('slug regeneration plan', () => {
    test('restores numbers and leaves matching slugs alone', () => {
        expect(
            planSlugRegeneration([
                { id: '1', title: 'Update GNOME 51', slug: 'update-gnome' },
                { id: '2', title: 'Hello World', slug: 'hello-world' }
            ])
        ).toEqual([
            { id: '1', title: 'Update GNOME 51', from: 'update-gnome', to: 'update-gnome-51' }
        ]);
    });

    test('suffixes collisions in creation order', () => {
        expect(
            planSlugRegeneration([
                { id: '1', title: 'Recap 2026', slug: 'recap' },
                { id: '2', title: 'Recap 2026!', slug: 'recap-again' }
            ]).map(change => change.to)
        ).toEqual(['recap-2026', 'recap-2026-2']);
    });
});
