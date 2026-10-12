import { createClient } from '@supabase/supabase-js';
import { planSlugRegeneration } from '../src/lib/slug';

const mode = Bun.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'dry-run';
if (!['dry-run', 'apply'].includes(mode))
    throw new Error('Usage: regenerate-post-slugs.ts [dry-run|apply]');

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

const { data: posts, error } = await db
    .from('db_posts')
    .select('id, title, slug, storage_path')
    .order('created_at', { ascending: true })
    .order('id');
if (error) throw new Error(`Cannot read db_posts: ${error.message}`);

const changes = planSlugRegeneration(posts ?? []);
if (!changes.length) {
    console.log(`All ${posts?.length ?? 0} post slugs already match their titles.`);
    process.exit(0);
}

for (const change of changes) console.log(`${change.from} -> ${change.to}  (${change.title})`);

const renamed = new Map(changes.map(change => [change.from, change.to]));
for (const post of posts ?? []) {
    if (!post.storage_path) continue;
    const { data: file } = await db.storage.from('blog-posts').download(post.storage_path);
    const markdown = file ? await file.text() : '';
    for (const [from, to] of renamed)
        if (new RegExp(`/blog/${from}(?![a-z0-9-])`).test(markdown))
            console.log(
                `  link to /blog/${from} in "${post.title}" must be updated to /blog/${to}`
            );
}

if (mode === 'dry-run') {
    console.log(`\nDry run: ${changes.length} slug(s) would change. Run with "apply" to save.`);
    process.exit(0);
}

for (const change of changes) {
    const { error: updateError } = await db
        .from('db_posts')
        .update({ slug: change.to })
        .eq('id', change.id)
        .eq('slug', change.from);
    if (updateError) throw new Error(`Cannot rename ${change.from}: ${updateError.message}`);
}
console.log(`\nRenamed ${changes.length} slug(s). Old URLs now return 404.`);
