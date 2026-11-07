// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { lenient } from '../../tests/lenient.ts';

const NOW = '2026-05-01T10:00:00.000Z';

export const posts = [
    {
        id: 'post-1',
        title: 'First post',
        slug: 'first-post',
        published: true,
        pinned: true,
        created_at: '2026-01-02T10:00:00.000Z',
        updated_at: '2026-02-03T10:00:00.000Z',
        banner_version: 'b1',
        post_revision: 3,
        excerpt: 'An excerpt',
        tags: ['svelte', 'tests'],
        read_minutes: 4,
        comment_count: 3,
        views_count: 120,
        helpful_yes: 7,
        helpful_no: 2
    },
    {
        id: 'post-2',
        title: 'Draft post',
        slug: 'draft-post',
        published: false,
        pinned: false,
        created_at: '2026-03-02T10:00:00.000Z',
        updated_at: null,
        banner_version: null,
        post_revision: 1,
        excerpt: null,
        tags: null,
        read_minutes: null,
        comment_count: 0,
        views_count: 0,
        helpful_yes: 0,
        helpful_no: 0
    }
];

export const comment = (id: string, parent: string | null, extra: object = {}) => ({
    id,
    post_id: 'post-1',
    parent_id: parent,
    author_name: parent ? 'Admin' : 'Reader',
    content: `Comment ${id}`,
    is_anonymous: false,
    is_admin: parent !== null,
    is_approved: true,
    created_at: NOW,
    posts: { title: 'First post' },
    reports: parent ? 0 : 2,
    ...extra
});

export const notification = (id: string, kind: string, extra: object = {}) => ({
    id,
    kind,
    post_id: 'post-1',
    comment_id: 'c1',
    source_id: null,
    page_type: 'article',
    page_id: 'post-1',
    page_title: 'First post',
    page_url: '/blog/first-post',
    meta: { reason: 'spam', vote: 'yes', author: 'Reader', comment: 'Hi', details: 'More' },
    created_at: NOW,
    read_at: null,
    pinned_at: null,
    report_status: 'open',
    ...extra
});

export const row = (id: string, extra: object = {}) => ({
    id,
    title: `Row ${id}`,
    latest: NOW,
    total: 2,
    postId: 'post-1',
    author: 'Reader',
    content: 'Content',
    reason: 'spam',
    details: 'Details',
    helpful: 3,
    unhelpful: 1,
    unread: 1,
    kind: 'comment_report',
    targetType: 'article',
    targetId: 'post-1',
    vote: 'yes',
    event: notification(`${id}-event`, 'comment_report'),
    commentedAt: NOW,
    ...extra
});

export const bucket = (day: number) => ({
    bucket: `2026-04-${String(day).padStart(2, '0')}`,
    views: day * 3,
    helpful: day,
    unhelpful: day % 3,
    reports: { spam: day % 2 },
    partial: day === 9
});

export const totals = {
    helpful: 12,
    unhelpful: 3,
    openReports: 2,
    reportedComments: 2,
    published: 1,
    posts: 2,
    allTimeReads: 900,
    allTimeHelpful: 40,
    allTimeUnhelpful: 8
};

export const workspace = (section: string, id?: string) => {
    if (section === 'comments')
        return {
            items: [
                { comment: comment('c1', null), ...row('c1') },
                { comment: comment('c2', 'c1'), ...row('c2') }
            ],
            page: 1,
            total: 2,
            asOf: NOW
        };
    if (section === 'summary' || section === 'overview')
        return {
            ...totals,
            reads: 300,
            series: Array.from({ length: 14 }, (_, i) => bucket(i + 1)),
            topPages: [
                { metric: 'Views', page: 'First post', value: '120', href: '/blog/first-post' }
            ],
            from: '2026-04-01',
            to: '2026-04-30',
            timeZone: 'UTC',
            updatedAt: NOW,
            items: [row('s1'), row('s2')],
            page: 1,
            total: 2,
            asOf: NOW
        };
    return {
        items: [row(`${section}-1`), row(`${section}-2`, { unread: 0, vote: 'no' })],
        page: 1,
        total: 2,
        asOf: NOW,
        scope: { from: '2026-04-01', to: '2026-04-30' },
        context: id ? row(id) : null,
        savedNotification: notification('saved', 'comment_new'),
        reasons: [{ reason: 'spam', count: 2 }],
        series: Array.from({ length: 7 }, (_, i) => bucket(i + 1))
    };
};

const span = (year: number) => ({
    startMonth: 'January',
    startYear: year,
    endMonth: 'June',
    endYear: year + 1
});

export const snapshot = {
    profile: {
        id: 'author-1',
        revision: 4,
        name: 'Ada Lovelace',
        username: 'ada',
        headline: 'Engineer',
        jobTitle: 'Developer',
        bio: 'Bio text',
        avatar: '/avatar.png',
        email: 'ada@example.com',
        city: 'London',
        postalCode: '12345',
        country: 'UK',
        siteUrl: 'https://example.com',
        avatarVersion: 'a1',
        bannerVersion: 'b1',
        pronunciation: 'AY-da'
    },
    identity: {
        avatar: { id: 'a1', sourceName: 'me.png', createdAt: NOW },
        banner: { id: 'b1', sourceName: 'banner.png', createdAt: NOW }
    },
    resume: {
        experience: [
            {
                id: 'e1',
                title: 'Engineer',
                type: 'Full-time',
                company: 'Example',
                ...span(2020),
                currentlyIn: false,
                location: 'Remote',
                locType: 'Remote',
                description: 'Built things'
            },
            {
                id: 'e2',
                title: 'Lead',
                type: 'Full-time',
                company: 'Other',
                startMonth: 'July',
                startYear: 2022,
                endMonth: null,
                endYear: null,
                currentlyIn: true,
                location: 'Berlin',
                locType: 'Hybrid',
                description: ''
            }
        ],
        education: [
            {
                id: 'ed1',
                institution: 'Uni',
                degree: 'BSc',
                field: 'Math',
                ...span(2015),
                currentlyIn: false,
                grade: 'A',
                activities: 'Chess',
                description: 'Studied'
            }
        ]
    },
    skills: [
        { id: 's1', category: 'Languages', skills: ['TypeScript', 'Rust'] },
        { id: 's2', category: 'Tools', skills: ['Git'] }
    ],
    social: [{ id: 'so1', platform: 'GitHub', url: 'https://github.com/ada', icon: 'github' }],
    funding: [
        {
            id: 'f1',
            platform: 'GitHub Sponsors',
            displayValue: 'ada',
            url: 'https://github.com/sponsors/ada',
            icon: 'heart',
            description: 'Support'
        }
    ],
    contact: [
        {
            id: 'c1',
            platform: 'Email',
            displayValue: 'ada@example.com',
            href: 'mailto:ada@example.com',
            icon: 'mail'
        }
    ],
    repoRules: { excluded: ['hidden'], pinned: ['shown'] },
    resumeDocument: {
        id: 'r1',
        filename: 'resume.pdf',
        fileUrl: '/resume.pdf',
        hash: 'abc',
        version: '1',
        signedAt: NOW,
        signerFingerprint: null,
        checksums: null,
        isActive: true
    },
    openPgpKey: null
};

export const legal = {
    pages: ['privacy', 'terms', 'security', 'ai-disclosure'].map(slug => ({
        slug,
        title: slug,
        content: `# ${slug}\n\nBody`,
        updated_at: NOW
    }))
};

export const projects = { projects: [{ name: 'shown', pinned: true, excluded: false }] };

export function respond(url: URL, method: string) {
    const path = url.pathname.replace('/api/internal/admin/', '');
    const section = url.searchParams.get('section') ?? '';
    if (path === 'author') return snapshot;
    if (path === 'posts/list') return { posts };
    if (path === 'legal') return legal;
    if (path === 'projects') return projects;
    if (path === 'workspace') return workspace(section, url.searchParams.get('id') ?? undefined);
    if (path === 'notifications')
        return {
            items: [notification('n1', 'comment_report'), notification('n2', 'contact_message')],
            nextCursor: null,
            total: 2,
            unreadCount: 2,
            revision: 'r1'
        };
    if (path === 'activity') return { items: [], total: 0, page: 1, asOf: NOW, nextCursor: null };
    if (path === 'settings') return {};
    return method === 'GET' ? lenient(2) : { success: true };
}
