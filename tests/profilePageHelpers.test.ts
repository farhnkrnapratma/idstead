// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { formatMonthAbbrev } from '../packages/domain/src/author.ts';
import { formatPeriod, normalizeSkillGroups } from '../apps/web/src/lib/profilePageHelpers.ts';

describe('normalizeSkillGroups', () => {
    test('returns nothing for values that are not lists', () => {
        expect(normalizeSkillGroups(null)).toEqual([]);
        expect(normalizeSkillGroups({ category: 'x' })).toEqual([]);
    });

    test('groups plain strings under Skills as written', () => {
        expect(normalizeSkillGroups(['R&amp;D'])).toEqual([
            { category: 'Skills', items: ['R&amp;D'] }
        ]);
    });

    test('decodes entities in object categories and items', () => {
        expect(
            normalizeSkillGroups([{ category: 'Tech &amp; Tools', items: ['R&amp;D'] }])
        ).toEqual([{ category: 'Tech & Tools', items: ['R&D'] }]);
    });

    test('fills missing categories and items and drops non-string items', () => {
        const groups = normalizeSkillGroups([
            null,
            { items: ['A'] },
            { category: 'Tools', items: ['Git', 3, 'Bun'] },
            { category: 7 }
        ]);
        expect(groups).toEqual([
            { category: 'General', items: [] },
            { category: 'General', items: [] },
            { category: 'General', items: ['A'] },
            { category: 'Tools', items: ['Git', 'Bun'] }
        ]);
    });

    test('orders groups by how many items they hold', () => {
        const groups = normalizeSkillGroups([
            { category: 'Big', items: ['a', 'b', 'c'] },
            { category: 'Small', items: ['a'] }
        ]);
        expect(groups.map(group => group.category)).toEqual(['Small', 'Big']);
    });
});

describe('formatPeriod', () => {
    const start = formatMonthAbbrev('January');
    const end = formatMonthAbbrev('March');

    test('shows an open period as present', () => {
        expect(formatPeriod('January', 2020, null, null, true)).toBe(`${start} 2020 - Present`);
    });

    test('joins the start and end when both are known', () => {
        expect(formatPeriod('January', 2020, 'March', 2022)).toBe(`${start} 2020 - ${end} 2022`);
    });

    test('shows whichever side is known alone', () => {
        expect(formatPeriod('January', 2020)).toBe(`${start} 2020`);
        expect(formatPeriod(undefined, null, 'March', 2022)).toBe(`${end} 2022`);
    });

    test('is empty without any date', () => {
        expect(formatPeriod()).toBe('');
    });
});
