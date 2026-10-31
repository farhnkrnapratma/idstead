// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export const RESUME_TEMPLATE_VERSION = 2;

export interface ResumeSnapshot {
    template: number;
    profile: {
        name: string;
        title: string;
        bio: string;
        email: string;
        website: string;
        location: string;
        avatar: string | null;
    };
    links: string[];
    experiences: {
        title: string;
        company: string;
        type: string;
        location: string;
        locType: string;
        start: string;
        end: string;
        current: boolean;
        description: string;
    }[];
    educations: {
        institution: string;
        degree: string;
        field: string;
        grade: string;
        start: string;
        end: string;
        current: boolean;
        description: string;
    }[];
    skills: { category: string; items: string[] }[];
    projects: { name: string; url: string; desc: string; lang: string }[];
}

export interface ResumeVersion {
    major: number;
    minor: number;
}

export type ResumeBump = { level: 'major' | 'minor'; reasons: string[] } | null;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function resumeSnapshot(input: {
    profile: Record<string, unknown>;
    avatar: string | null;
    links: string[];
    experiences: Record<string, unknown>[];
    educations: Record<string, unknown>[];
    skills: { category: string; items: string[] }[];
    projects: { name: string; url: string; desc?: string | null; lang?: string | null }[];
}): ResumeSnapshot {
    return {
        template: RESUME_TEMPLATE_VERSION,
        profile: {
            name: text(input.profile.name),
            title: text(input.profile.title),
            bio: text(input.profile.bio),
            email: text(input.profile.email),
            website: text(input.profile.website),
            location: text(input.profile.location),
            avatar: input.avatar
        },
        links: input.links.map(text),
        experiences: input.experiences.map(item => ({
            title: text(item.title),
            company: text(item.company),
            type: text(item.type),
            location: text(item.location),
            locType: text(item.loc_type),
            start: text(item.start_date),
            end: text(item.end_date),
            current: Boolean(item.currently_in),
            description: text(item.description)
        })),
        educations: input.educations.map(item => ({
            institution: text(item.institution),
            degree: text(item.degree),
            field: text(item.field),
            grade: text(item.grade),
            start: text(item.start_date),
            end: text(item.end_date),
            current: Boolean(item.currently_in),
            description: text(item.description)
        })),
        skills: input.skills.map(group => ({
            category: text(group.category),
            items: group.items.map(text)
        })),
        projects: input.projects.map(project => ({
            name: text(project.name),
            url: text(project.url),
            desc: text(project.desc),
            lang: text(project.lang)
        }))
    };
}

function same(a: unknown, b: unknown) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function identities<T>(items: T[], key: (item: T) => string) {
    return items.map(key).sort();
}

const experienceKey = (item: ResumeSnapshot['experiences'][number]) =>
    [item.company, item.title, item.type, item.start, item.end, item.current].join('|');

const educationKey = (item: ResumeSnapshot['educations'][number]) =>
    [item.institution, item.degree, item.field, item.start, item.end, item.current].join('|');

function difference(previous: string[], next: string[]) {
    const remaining = [...previous];
    let added = 0;
    for (const key of next) {
        const index = remaining.indexOf(key);
        if (index === -1) added++;
        else remaining.splice(index, 1);
    }
    return { added, removed: remaining.length };
}

function describe(kind: string, previous: string[], next: string[]) {
    const { added, removed } = difference(previous, next);
    if (!added && !removed) return null;
    if (added && removed && previous.length === next.length) return `${kind} changed`;
    if (added && removed) return `${kind} added and removed`;
    return added ? `${kind} added` : `${kind} removed`;
}

export function resumeVersionBump(
    previous: ResumeSnapshot | null,
    next: ResumeSnapshot
): ResumeBump {
    if (!previous) return { level: 'minor', reasons: ['No earlier snapshot to compare with'] };
    const major: string[] = [];
    if (previous.profile.name !== next.profile.name) major.push('Name changed');
    if (previous.profile.title !== next.profile.title) major.push('Job title changed');
    const experience = describe(
        'Experience',
        identities(previous.experiences, experienceKey),
        identities(next.experiences, experienceKey)
    );
    if (experience) major.push(experience);
    const education = describe(
        'Education',
        identities(previous.educations, educationKey),
        identities(next.educations, educationKey)
    );
    if (education) major.push(education);
    if (major.length) return { level: 'major', reasons: major };

    const minor: string[] = [];
    const { profile: before } = previous;
    const { profile: after } = next;
    if (before.bio !== after.bio) minor.push('Bio changed');
    if (
        before.email !== after.email
        || before.website !== after.website
        || before.location !== after.location
        || !same(previous.links, next.links)
    )
        minor.push('Contact details or links changed');
    if (before.avatar !== after.avatar) minor.push('Profile photo changed');
    if (!same(previous.experiences, next.experiences)) minor.push('Experience details changed');
    if (!same(previous.educations, next.educations)) minor.push('Education details changed');
    if (!same(previous.skills, next.skills)) minor.push('Skills changed');
    if (!same(previous.projects, next.projects)) minor.push('Projects changed');
    if (previous.template !== next.template) minor.push('PDF template changed');
    return minor.length ? { level: 'minor', reasons: minor } : null;
}

export function parseResumeVersion(filename?: string | null): ResumeVersion | null {
    const match = filename?.match(/-v(\d+)\.(\d+)\.pdf$/i);
    return match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
}

export function nextResumeVersion(current: ResumeVersion | null, level: 'major' | 'minor') {
    if (!current) return { major: 1, minor: 0 };
    return level === 'major' ?
            { major: current.major + 1, minor: 0 }
        :   { major: current.major, minor: current.minor + 1 };
}

export function formatResumeVersion(version: ResumeVersion) {
    return `${version.major}.${version.minor}`;
}
