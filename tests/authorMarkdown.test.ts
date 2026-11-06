// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { generateAuthorMarkdown, sanitizePublicApiData } from '../packages/lib/src/authorApi.ts';

describe('generateAuthorMarkdown', () => {
    test('renders nothing for empty data', () => {
        expect(generateAuthorMarkdown({})).toBe('');
        expect(generateAuthorMarkdown({ resume: {}, skills: [], funding: [], contact: [] })).toBe(
            ''
        );
    });

    test('renders the profile with and without optional fields', () => {
        const full = generateAuthorMarkdown({
            profile: {
                name: 'Ada',
                pronunciation: 'AY-duh',
                headline: 'Engineer',
                bio: 'Writes code.',
                city: 'London',
                postalCode: 'N1',
                country: 'UK',
                siteUrl: 'https://ada.test'
            }
        });
        expect(full).toContain('# Ada (AY-duh)');
        expect(full).toContain('**Headline**: Engineer');
        expect(full).toContain('> Writes code.');
        expect(full).toContain('- **City**: London');
        expect(full).toContain('- **Postal Code**: N1');
        expect(full).toContain('- **Country**: UK');
        expect(full).toContain('- **Website**: https://ada.test');
        expect(generateAuthorMarkdown({ profile: {} })).toBe('# Profile\n\n\n');
    });

    test('renders work experience and education', () => {
        const markdown = generateAuthorMarkdown({
            resume: {
                experience: [
                    {
                        title: 'Dev',
                        company: 'Acme',
                        startMonth: 'Jan',
                        startYear: 2020,
                        endMonth: 'Feb',
                        endYear: 2022,
                        location: 'Remote',
                        locType: 'remote',
                        description: 'Built things.'
                    },
                    { title: 'Lead', company: 'Beta', currentlyIn: true }
                ],
                education: [
                    {
                        degree: 'BSc',
                        field: 'Math',
                        institution: 'Uni',
                        startYear: 2016,
                        endYear: 2020,
                        grade: '4.0',
                        description: 'Honors.'
                    },
                    { degree: 'MSc', field: 'CS', institution: 'Tech', currentlyIn: true }
                ]
            }
        });
        expect(markdown).toContain('### Dev — Acme');
        expect(markdown).toContain('*Jan 2020 – Feb 2022 | Remote (remote)*');
        expect(markdown).toContain('Built things.');
        expect(markdown).toContain('* – Present*');
        expect(markdown).toContain('### BSc in Math — Uni');
        expect(markdown).toContain('*2016 – 2020 | GPA: 4.0*');
        expect(markdown).toContain('Honors.');
        expect(markdown).toContain('### MSc in CS — Tech');
    });

    test('renders education alone and experience alone', () => {
        const onlyEducation = generateAuthorMarkdown({
            resume: { education: [{ degree: 'BSc', field: 'Math', institution: 'Uni' }] }
        });
        expect(onlyEducation).not.toContain('Work Experience');
        expect(onlyEducation).toContain('## Education');
        const onlyExperience = generateAuthorMarkdown({
            resume: { experience: [{ title: 'Dev', company: 'Acme' }], education: [] }
        });
        expect(onlyExperience).toContain('## Work Experience');
        expect(onlyExperience).not.toContain('## Education');
    });

    test('renders skills, funding, contact and socials', () => {
        const markdown = generateAuthorMarkdown({
            skills: [
                { category: 'Languages', items: ['TS', 'Rust'] },
                { category: 'Tools', skills: ['Git'] },
                { category: 'Other' }
            ],
            funding: [
                { platform: 'GitHub', displayValue: '@ada', url: 'https://gh.test/ada' },
                { url: 'https://fund.test' }
            ],
            contact: [
                { platform: 'Mail', displayValue: 'a@b.co', href: 'mailto:a@b.co' },
                { label: 'Site', value: 'ada.test', url: 'https://ada.test' },
                {}
            ],
            socials: [{ platform: 'Mastodon', url: 'https://m.test/@ada' }]
        });
        expect(markdown).toContain('- **Languages**: TS, Rust');
        expect(markdown).toContain('- **Tools**: Git');
        expect(markdown).toContain('- **Other**: ');
        expect(markdown).toContain('- **GitHub**: [@ada](https://gh.test/ada)');
        expect(markdown).toContain('- **Funding**: [https://fund.test](https://fund.test)');
        expect(markdown).toContain('- **Mail**: [a@b.co](mailto:a@b.co)');
        expect(markdown).toContain('- **Site**: [ada.test](https://ada.test)');
        expect(markdown).toContain('- **Contact**: [undefined](#)');
        expect(markdown).toContain('- **Mastodon**: https://m.test/@ada');
    });
});

describe('sanitizePublicApiData', () => {
    test('drops internal fields, empty descriptions and empty containers', () => {
        expect(
            sanitizePublicApiData({
                id: 'x',
                email: 'a@b.co',
                name: 'Ada',
                description: '  ',
                tags: [],
                nested: { updatedAt: 'now' },
                list: [{ name: 'kept' }, null]
            })
        ).toEqual({ name: 'Ada', list: [{ name: 'kept' }] });
    });

    test('drops currentlyIn once an end date exists', () => {
        expect(
            sanitizePublicApiData({
                endMonth: 'Jan',
                endYear: 2020,
                currentlyIn: false,
                title: 'x'
            })
        ).toEqual({ endMonth: 'Jan', endYear: 2020, title: 'x' });
        expect(sanitizePublicApiData({ currentlyIn: true, title: 'x' })).toEqual({
            currentlyIn: true,
            title: 'x'
        });
        expect(sanitizePublicApiData('text')).toBe('text');
    });
});
