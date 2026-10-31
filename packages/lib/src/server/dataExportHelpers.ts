// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

const STAMP_PATTERN = /^\d{8}-\d{6}$/;
const MEDIA_PATTERN =
    /!\[([^\]]*)\]\((?:https?:\/\/[^\s)/]+)?\/blog\/content\/([0-9a-f]{64})\.(webp|mp4|webm)((?:\s+"[^"]*")?)\)/g;
const VIDEO_PATTERN =
    /(<video\b[^>]*?\bsrc=")(?:https?:\/\/[^\s"/]+)?\/blog\/content\/([0-9a-f]{64})\.(mp4|webm)(")/g;

export function parseStamp(value: string | null, now = new Date()) {
    if (value && STAMP_PATTERN.test(value)) return value;
    return now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

export function safeSegment(value: string) {
    return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '') || 'untitled';
}

export function slugifyAlt(alt: string, fallback: string, used: Set<string>) {
    const base =
        alt
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || fallback;
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}-${n}`;
    used.add(name);
    return name;
}

export function createMediaCollector() {
    const used = { images: new Set<string>(), videos: new Set<string>() };
    const files = new Map<string, string>();

    function place(kind: 'images' | 'videos', alt: string, hash: string, ext: string) {
        const key = `blog/content/${hash}.${ext}`;
        let path = files.get(key);
        if (!path) {
            const name = slugifyAlt(alt, kind === 'images' ? 'image' : 'video', used[kind]);
            path = `assets/${kind}/${name}.${ext}`;
            files.set(key, path);
        }
        return path;
    }

    function rewrite(markdown: string) {
        return markdown
            .replace(
                MEDIA_PATTERN,
                (_match, alt: string, hash: string, ext: string, title: string) =>
                    `![${alt}](${place(ext === 'webp' ? 'images' : 'videos', alt, hash, ext)}${title})`
            )
            .replace(
                VIDEO_PATTERN,
                (_match, open: string, hash: string, ext: string, close: string) =>
                    `${open}${place('videos', '', hash, ext)}${close}`
            );
    }

    return { rewrite, files };
}

export type CommentRow = {
    id: string;
    parent_id: string | null;
    author_name: string;
    content: string;
    is_anonymous: boolean;
    is_admin: boolean;
    is_approved: boolean;
    created_at: string;
};

export type CommentNode = {
    author: string;
    content: string;
    isAnonymous: boolean;
    isAdmin: boolean;
    isApproved: boolean;
    createdAt: string;
    replies: CommentNode[];
};

export function nestComments(rows: CommentRow[]) {
    const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const nodes = new Map<string, CommentNode>();
    for (const row of sorted)
        nodes.set(row.id, {
            author: row.author_name,
            content: row.content,
            isAnonymous: row.is_anonymous,
            isAdmin: row.is_admin,
            isApproved: row.is_approved,
            createdAt: row.created_at,
            replies: []
        });
    const roots: CommentNode[] = [];
    for (const row of sorted) {
        const node = nodes.get(row.id)!;
        const parent = row.parent_id ? nodes.get(row.parent_id) : undefined;
        (parent ? parent.replies : roots).push(node);
    }
    return roots;
}

export function stripKeys(value: unknown, keys: readonly string[]): unknown {
    if (Array.isArray(value)) return value.map(item => stripKeys(item, keys));
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !keys.includes(key))
                .map(([key, item]) => [key, stripKeys(item, keys)])
        );
    return value;
}

export function voteFile(events: { vote: string; created_at: string }[]) {
    return {
        totals: {
            yes: events.filter(e => e.vote === 'yes').length,
            no: events.filter(e => e.vote === 'no').length
        },
        votes: events.map(e => ({ vote: e.vote, createdAt: e.created_at }))
    };
}

const isEmpty = (value: unknown) =>
    value === null
    || value === undefined
    || value === ''
    || (typeof value === 'object' && Object.keys(value).length === 0);

export function compact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(compact).filter(item => !isEmpty(item));
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, item]) => [key, compact(item)])
                .filter(([, item]) => !isEmpty(item))
        );
    return value;
}

export function errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error) return String(error.message);
    return String(error);
}
