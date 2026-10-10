import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { convertLegacyMarkdownWithNotes } from '../src/lib/legacyMarkdown';
import { renderMarkdown } from '../src/lib/markdown';

const argv = Bun.argv.slice(2);
const mode = argv.find(arg => !arg.startsWith('--')) ?? 'dry-run';
const flag = (name: string) =>
    argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = resolve(flag('dir') ?? '.local/markdown-syntax-migration');
const manifestPath = join(directory, 'manifest.json');

if (!['dry-run', 'apply', 'verify'].includes(mode)) {
    throw new Error(
        'Usage: migrate-markdown-syntax.ts [dry-run|apply|verify] [--dir=PATH] [--show=SLUG_OR_PATH] [--origin=https://production-origin]'
    );
}

const value = (name: string) => {
    const result = process.env[name];
    if (!result) throw new Error(`Missing configuration: ${name}`);
    return result;
};
const project = value('PUBLIC_SUPABASE_URL')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');
const db = createClient(project, value('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
});
const BUCKET = 'blog-posts';

type Kind = 'post' | 'legal';

interface Entry {
    kind: Kind;
    key: string;
    path: string;
    before: string;
    after: string;
    sha256Before: string;
    sha256After: string;
    notes: string[];
    changed: boolean;
    postId?: string;
    slug?: string;
    updatedAt?: string | null;
}

const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex');

async function rows(table: string, columns: string) {
    const result: any[] = [];
    for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
            .from(table)
            .select(columns)
            .range(offset, offset + 499);
        if (error) throw new Error(`Cannot read ${table}: ${error.message}`);
        result.push(...data);
        if (data.length < 500) return result;
    }
}

async function download(path: string): Promise<string | null> {
    const { data, error } = await db.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return new TextDecoder().decode(await data.arrayBuffer());
}

function buildEntry(
    base: Pick<Entry, 'kind' | 'key' | 'path'> & Partial<Entry>,
    before: string
): Entry {
    const { markdown, notes } = convertLegacyMarkdownWithNotes(before);
    return {
        ...base,
        before,
        after: markdown,
        sha256Before: sha256(before),
        sha256After: sha256(markdown),
        notes,
        changed: markdown !== before
    };
}

async function collect(): Promise<{ entries: Entry[]; missing: string[] }> {
    const posts = await rows('db_posts', 'id, slug, storage_path, published');
    const legals = await rows('db_legals', 'slug, content, updated_at');
    const entries: Entry[] = [];
    const missing: string[] = [];

    for (const post of posts) {
        if (!post.storage_path) continue;
        const text = await download(post.storage_path);
        if (text === null) {
            missing.push(post.storage_path);
            continue;
        }
        entries.push(
            buildEntry(
                {
                    kind: 'post',
                    key: post.slug,
                    path: post.storage_path,
                    postId: post.id,
                    slug: post.slug
                },
                text
            )
        );
    }

    for (const legal of legals) {
        entries.push(
            buildEntry(
                {
                    kind: 'legal',
                    key: legal.slug,
                    path: `db_legals/${legal.slug}`,
                    slug: legal.slug,
                    updatedAt: legal.updated_at
                },
                legal.content ?? ''
            )
        );
    }
    return { entries, missing };
}

function changedLines(before: string, after: string): string[] {
    const left = before.split('\n');
    const right = after.split('\n');
    const lines: string[] = [];
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
        if (left[index] !== right[index]) {
            lines.push(`- ${left[index] ?? ''}`, `+ ${right[index] ?? ''}`);
        }
    }
    return lines;
}

function summary(entries: Entry[], missing: string[]) {
    return {
        mode,
        project,
        total: entries.length,
        changed: entries.filter(entry => entry.changed).length,
        unchanged: entries.filter(entry => !entry.changed).length,
        missing,
        objects: entries
            .filter(entry => entry.changed)
            .map(entry => ({
                kind: entry.kind,
                key: entry.key,
                path: entry.path,
                notes: entry.notes,
                changedLines: changedLines(entry.before, entry.after).length / 2
            }))
    };
}

async function writeBackup(entries: Entry[], missing: string[]) {
    await mkdir(join(directory, 'originals'), { recursive: true });
    await mkdir(join(directory, 'converted'), { recursive: true });
    for (const entry of entries) {
        const name = `${entry.kind}__${entry.key}`.replace(/[^\w.-]+/g, '_');
        await writeFile(join(directory, 'originals', `${name}.md`), entry.before);
        await writeFile(join(directory, 'converted', `${name}.md`), entry.after);
    }
    await writeFile(
        manifestPath,
        JSON.stringify(
            {
                createdAt: new Date().toISOString(),
                project,
                missing,
                entries: entries.map(({ before, after, ...rest }) => rest)
            },
            null,
            2
        )
    );
}

async function dryRun() {
    const { entries, missing } = await collect();
    await writeBackup(entries, missing);
    const show = flag('show');
    if (show) {
        const entry = entries.find(item => item.key === show || item.path === show);
        if (!entry) throw new Error(`No object matches ${show}`);
        console.log(changedLines(entry.before, entry.after).join('\n'));
        return;
    }
    console.log(JSON.stringify({ ...summary(entries, missing), backup: directory }, null, 2));
}

async function assertProductionOrigin() {
    const raw = flag('origin');
    if (!raw) throw new Error('apply requires --origin=https://production-origin');
    const origin = new URL(raw);
    if (
        origin.protocol !== 'https:'
        || origin.username
        || origin.password
        || origin.pathname !== '/'
        || origin.search
        || origin.hash
        || origin.hostname.endsWith('.pages.dev')
    ) {
        throw new Error('Use the HTTPS Production origin.');
    }
    const response = await fetch(new URL('/api/v1/blog', origin), {
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Production check failed (${response.status})`);
    const body = await response.text();
    const published = await rows('db_posts', 'slug, published');
    const matches = published.filter(post => post.published && body.includes(`"${post.slug}"`));
    if (!matches.length) {
        throw new Error('The database does not match the Production origin. Aborting.');
    }
}

async function applyPost(entry: Entry) {
    const next = `posts/${entry.postId}/${crypto.randomUUID()}.md`;
    const upload = await db.storage
        .from(BUCKET)
        .upload(next, new Blob([entry.after], { type: 'text/markdown; charset=utf-8' }), {
            upsert: false,
            cacheControl: '3600',
            contentType: 'text/markdown; charset=utf-8'
        });
    if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);
    const update = await db
        .from('db_posts')
        .update({ storage_path: next })
        .eq('id', entry.postId!)
        .eq('storage_path', entry.path)
        .select('id');
    if (update.error || !update.data?.length) {
        await db.storage.from(BUCKET).remove([next]);
        throw new Error(
            `Post ${entry.key} changed while migrating: ${update.error?.message ?? 'no row updated'}`
        );
    }
    const cleanup = await db
        .from('db_post_storage_cleanup')
        .upsert({ storage_path: entry.path, post_id: entry.postId! }, { ignoreDuplicates: true });
    if (cleanup.error) {
        console.error(`Cleanup row not recorded for ${entry.path}: ${cleanup.error.message}`);
    }
}

async function applyLegal(entry: Entry) {
    let query = db
        .from('db_legals')
        .update({ content: entry.after, updated_at: new Date().toISOString() })
        .eq('slug', entry.slug!);
    query = entry.updatedAt ? query.eq('updated_at', entry.updatedAt) : query;
    const result = await query.select('slug');
    if (result.error || !result.data?.length) {
        throw new Error(
            `Legal page ${entry.slug} changed while migrating: ${result.error?.message ?? 'no row updated'}`
        );
    }
}

async function apply() {
    await assertProductionOrigin();
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        entries: Omit<Entry, 'before' | 'after'>[];
    };
    const expected = new Map(
        manifest.entries.map(entry => [`${entry.kind}:${entry.key}`, entry.sha256Before])
    );
    const { entries, missing } = await collect();
    const results: Record<string, string> = {};
    for (const entry of entries.filter(item => item.changed)) {
        const id = `${entry.kind}:${entry.key}`;
        if (expected.get(id) !== entry.sha256Before) {
            results[id] = 'skipped: content changed since the dry-run, run dry-run again';
            continue;
        }
        try {
            if (entry.kind === 'post') await applyPost(entry);
            else await applyLegal(entry);
            results[id] = 'migrated';
        } catch (error) {
            results[id] = `failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    console.log(JSON.stringify({ mode, project, missing, results }, null, 2));
}

async function verify() {
    const { entries, missing } = await collect();
    const problems: string[] = [];
    for (const entry of entries) {
        if (entry.changed) problems.push(`${entry.kind}:${entry.key} still contains legacy syntax`);
        try {
            const html = await renderMarkdown(entry.before);
            const visible = html.replace(/<pre\b[\s\S]*?<\/pre>/g, '');
            if (/^:::|<p>:::/m.test(visible)) {
                problems.push(`${entry.kind}:${entry.key} renders literal ::: markers`);
            }
        } catch (error) {
            problems.push(
                `${entry.kind}:${entry.key} failed to render: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
    console.log(JSON.stringify({ mode, total: entries.length, missing, problems }, null, 2));
    if (problems.length) process.exitCode = 1;
}

if (mode === 'dry-run') await dryRun();
else if (mode === 'apply') await apply();
else await verify();
