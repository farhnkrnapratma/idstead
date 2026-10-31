// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { formatMonthAbbrev } from '#lib/author.ts';
import { decodeHtmlEntities } from '@mdrs/core';

export interface SkillGroup {
    category: string;
    items: string[];
}

export function normalizeSkillGroups(rawSkills: unknown): SkillGroup[] {
    if (!Array.isArray(rawSkills)) return [];

    return rawSkills
        .map(skill => {
            if (typeof skill === 'string') {
                return { category: 'Skills', items: [skill] };
            }

            const category =
                (
                    typeof skill === 'object'
                    && skill !== null
                    && 'category' in skill
                    && typeof skill.category === 'string'
                ) ?
                    skill.category
                :   'General';

            const items =
                (
                    typeof skill === 'object'
                    && skill !== null
                    && 'items' in skill
                    && Array.isArray(skill.items)
                ) ?
                    skill.items
                        .filter((item: unknown): item is string => typeof item === 'string')
                        .map((item: string) => decodeHtmlEntities(item))
                :   [];

            return { category: decodeHtmlEntities(category), items };
        })
        .sort((a, b) => a.items.length - b.items.length);
}

export function formatPeriod(
    startMonth?: string,
    startYear?: number | null,
    endMonth?: string | null,
    endYear?: number | null,
    currentlyIn?: boolean
): string {
    const sMonth = formatMonthAbbrev(startMonth);
    const eMonth = formatMonthAbbrev(endMonth);
    const start = [sMonth, startYear].filter(Boolean).join(' ');
    if (currentlyIn) return `${start} - Present`;

    const end = [eMonth, endYear].filter(Boolean).join(' ');
    if (start && end) return `${start} - ${end}`;
    if (start) return start;
    if (end) return end;
    return '';
}
