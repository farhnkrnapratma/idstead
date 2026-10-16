import { describe, expect, test } from 'bun:test';
import {
    cvSnapshot,
    cvVersionBump,
    formatCvVersion,
    nextCvVersion,
    parseCvVersion,
    type CvSnapshot
} from '../packages/lib/src/cvVersion.ts';

function base(): CvSnapshot {
    return cvSnapshot({
        profile: {
            name: 'Ada',
            title: 'Engineer',
            bio: 'Builds things.',
            email: 'a@example.com',
            website: 'https://example.com',
            location: 'Jakarta'
        },
        avatar: 'v1',
        links: ['https://github.com/ada'],
        experiences: [
            {
                title: 'Engineer',
                company: 'Acme',
                type: 'Full-time',
                start_date: '2024-01',
                end_date: '',
                currently_in: true,
                description: 'Work.'
            }
        ],
        educations: [
            {
                institution: 'Uni',
                degree: 'BSc',
                field: 'CS',
                start_date: '2019',
                end_date: '2023',
                description: ''
            }
        ],
        skills: [{ category: 'Languages', items: ['TypeScript'] }],
        projects: [{ name: 'www', url: 'https://github.com/ada/www', desc: 'Site', lang: 'TS' }]
    });
}

function edit(change: (snapshot: CvSnapshot) => void) {
    const snapshot = structuredClone(base());
    change(snapshot);
    return snapshot;
}

describe('cvVersionBump', () => {
    test('identical content needs no new version', () => {
        expect(cvVersionBump(base(), base())).toBeNull();
    });

    test('without an earlier snapshot the next version is minor', () => {
        expect(cvVersionBump(null, base())?.level).toBe('minor');
    });

    test.each([
        ['name', (s: CvSnapshot) => (s.profile.name = 'Ada L.'), 'Name changed'],
        ['job title', (s: CvSnapshot) => (s.profile.title = 'Lead'), 'Job title changed'],
        [
            'new experience',
            (s: CvSnapshot) => s.experiences.push({ ...s.experiences[0], company: 'Beta' }),
            'Experience added'
        ],
        ['removed experience', (s: CvSnapshot) => s.experiences.pop(), 'Experience removed'],
        [
            'ended job',
            (s: CvSnapshot) => {
                s.experiences[0].current = false;
                s.experiences[0].end = '2026-10';
            },
            'Experience changed'
        ],
        ['new degree', (s: CvSnapshot) => (s.educations[0].degree = 'MSc'), 'Education changed']
    ])('%s is major', (_label, change, reason) => {
        expect(cvVersionBump(base(), edit(change))).toEqual({ level: 'major', reasons: [reason] });
    });

    test.each([
        ['bio', (s: CvSnapshot) => (s.profile.bio = 'Builds more.'), 'Bio changed'],
        [
            'experience description',
            (s: CvSnapshot) => (s.experiences[0].description = 'More work.'),
            'Experience details changed'
        ],
        ['grade', (s: CvSnapshot) => (s.educations[0].grade = '3.9'), 'Education details changed'],
        ['skills', (s: CvSnapshot) => s.skills[0].items.push('Go'), 'Skills changed'],
        ['projects', (s: CvSnapshot) => (s.projects = []), 'Projects changed'],
        ['photo', (s: CvSnapshot) => (s.profile.avatar = 'v2'), 'Profile photo changed'],
        [
            'links',
            (s: CvSnapshot) => s.links.push('https://linkedin.com/in/ada'),
            'Contact details or links changed'
        ],
        ['template', (s: CvSnapshot) => (s.template = 2), 'PDF template changed']
    ])('%s is minor', (_label, change, reason) => {
        expect(cvVersionBump(base(), edit(change))).toEqual({ level: 'minor', reasons: [reason] });
    });

    test('major wins over minor', () => {
        const next = edit(s => {
            s.profile.bio = 'x';
            s.profile.title = 'CTO';
        });
        expect(cvVersionBump(base(), next)?.level).toBe('major');
    });
});

describe('CV version numbers', () => {
    test('parse new and legacy filenames', () => {
        expect(parseCvVersion('CV-Ada-1234567-v2.3.pdf')).toEqual({ major: 2, minor: 3 });
        expect(parseCvVersion('CV-Ada-1234567-v1.0.13.pdf')).toEqual({ major: 1, minor: 0 });
        expect(parseCvVersion('cv.pdf')).toBeNull();
    });

    test('bump and format', () => {
        expect(formatCvVersion(nextCvVersion(null, 'major'))).toBe('1.0');
        expect(formatCvVersion(nextCvVersion({ major: 1, minor: 4 }, 'minor'))).toBe('1.5');
        expect(formatCvVersion(nextCvVersion({ major: 1, minor: 4 }, 'major'))).toBe('2.0');
    });
});
