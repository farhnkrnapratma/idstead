import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { format, resolveConfig } from 'prettier';
import {
    InstanceConfigError,
    resolveInstanceConfig,
    type InstanceConfig
} from '../packages/domain/src/instance.ts';
import { renderWranglerConfigs } from './configure.ts';
import {
    APPS,
    LEGAL_SLUGS,
    SetupAnswersError,
    instanceSource,
    legalTitle,
    missingVariables,
    nextSteps,
    resolveSetupAnswers,
    setupVariables,
    temporaryPassword,
    workerSecrets,
    type App,
    type SetupAnswers,
    type WorkerKeys
} from './setup/plan.ts';

const ROOT = path.resolve(import.meta.dir, '..');
const CONFIG_FILE = path.join(ROOT, 'idstead.jsonc');
const USAGE = 'Usage: bun run setup [dry-run|apply] [--answers=FILE] [--skip-deploy]';

const argv = Bun.argv.slice(2);
const mode = argv.find(arg => !arg.startsWith('--')) ?? 'dry-run';
const answersFile = argv.find(arg => arg.startsWith('--answers='))?.slice('--answers='.length);
const skipDeploy = argv.includes('--skip-deploy');
const apply = mode === 'apply';

class SetupStop extends Error {}

function step(title: string) {
    console.log(`\n▸ ${title}`);
}

function note(message: string) {
    console.log(`  ${message}`);
}

function planned(message: string) {
    console.log(`  ${apply ? '✓' : '·'} ${apply ? message : `would ${message}`}`);
}

async function run(command: string[], options: { cwd?: string; inherit?: boolean } = {}) {
    const child = Bun.spawn(command, {
        cwd: options.cwd ?? ROOT,
        stdin: 'ignore',
        stdout: options.inherit ? 'inherit' : 'pipe',
        stderr: options.inherit ? 'inherit' : 'pipe'
    });
    const [code, stdout, stderr] = await Promise.all([
        child.exited,
        options.inherit ? '' : new Response(child.stdout).text(),
        options.inherit ? '' : new Response(child.stderr).text()
    ]);
    return { code, output: `${stdout}${stderr}`.trim() };
}

async function readAnswers(): Promise<SetupAnswers> {
    if (!answersFile) return {};
    try {
        return resolveSetupAnswers(Bun.JSONC.parse(await readFile(answersFile, 'utf8')));
    } catch (error) {
        if (error instanceof SetupAnswersError)
            throw new SetupStop(`${answersFile}: ${error.message}`);
        throw error;
    }
}

function ask(question: string): string | undefined {
    if (!process.stdin.isTTY) return undefined;
    return prompt(question)?.trim() || undefined;
}

async function instanceConfig(answers: SetupAnswers): Promise<InstanceConfig> {
    step('Instance configuration');
    const existing = existsSync(CONFIG_FILE) ? await readFile(CONFIG_FILE, 'utf8') : null;
    let source = instanceSource(answers);
    if (!source && existing) source = Bun.JSONC.parse(existing) as Record<string, unknown>;
    if (!source) {
        const domain = ask('Domain of the public site (for example example.com):');
        if (!domain)
            throw new SetupStop(
                'No idstead.jsonc and no domain. Pass --answers with "domain", or copy idstead.example.jsonc to idstead.jsonc.'
            );
        source = instanceSource({ domain: domain.toLowerCase() });
    }
    let config: InstanceConfig;
    try {
        config = resolveInstanceConfig(source);
    } catch (error) {
        if (error instanceof InstanceConfigError)
            throw new SetupStop(`idstead.jsonc: ${error.message}`);
        throw error;
    }
    const content = await format(JSON.stringify(source), {
        ...(await resolveConfig(CONFIG_FILE)),
        filepath: CONFIG_FILE
    });
    if (existing && JSON.stringify(Bun.JSONC.parse(existing)) === JSON.stringify(source))
        note(`idstead.jsonc is up to date (site ${config.domains.site}).`);
    else {
        if (apply) await writeFile(CONFIG_FILE, content);
        planned(`write idstead.jsonc for ${config.domains.site}`);
    }
    const rendered = await renderWranglerConfigs(config);
    for (const [file, text] of Object.entries(rendered)) {
        const current = await readFile(file, 'utf8').catch(() => '');
        if (current === text) continue;
        if (apply) await writeFile(file, text);
        planned(`render ${path.relative(ROOT, file)}`);
    }
    return config;
}

async function workerKeys(): Promise<WorkerKeys> {
    const keys = {} as WorkerKeys;
    for (const app of APPS) {
        if (app === 'web' || app === 'admin') {
            const module = (await import(path.join(ROOT, 'apps', app, 'src/env.ts'))) as {
                variables: Record<string, unknown>;
            };
            keys[app] = { keys: Object.keys(module.variables), required: [] };
            continue;
        }
        const template = Bun.JSONC.parse(
            await readFile(path.join(ROOT, 'apps', app, 'wrangler.template.jsonc'), 'utf8')
        ) as { secrets?: { required?: string[] } };
        const required = template.secrets?.required ?? [];
        keys[app] = { keys: required, required };
    }
    return keys;
}

async function variables(config: InstanceConfig, keys: WorkerKeys) {
    step('Environment variables');
    const values = setupVariables(process.env, config);
    const missing = missingVariables(keys, values);
    if (missing.length)
        throw new SetupStop(
            `Missing: ${missing.join(', ')}. Set them in .env or your secret manager (.env.example lists every key) and run setup again.`
        );
    note('Every required variable is set.');
    return values;
}

async function cloudflare(config: InstanceConfig) {
    step('Cloudflare account');
    const whoami = await run(['bunx', 'wrangler', 'whoami', '--json']);
    if (whoami.code !== 0)
        throw new SetupStop('Wrangler is not signed in. Run bunx wrangler login.');
    note('Wrangler is signed in.');

    step('R2 bucket and queues');
    const bucket = config.cloudflare.assetBucket;
    if ((await run(['bunx', 'wrangler', 'r2', 'bucket', 'info', bucket])).code === 0)
        note(`Bucket ${bucket} exists.`);
    else {
        if (apply) await mustRun(['bunx', 'wrangler', 'r2', 'bucket', 'create', bucket]);
        planned(`create the R2 bucket ${bucket}`);
    }
    const queue = config.cloudflare.newsletterQueue;
    for (const name of [queue, `${queue}-dlq`]) {
        if ((await run(['bunx', 'wrangler', 'queues', 'info', name])).code === 0)
            note(`Queue ${name} exists.`);
        else {
            if (apply) await mustRun(['bunx', 'wrangler', 'queues', 'create', name]);
            planned(`create the queue ${name}`);
        }
    }
}

async function mustRun(command: string[], options: { cwd?: string; inherit?: boolean } = {}) {
    const result = await run(command, options);
    if (result.code !== 0)
        throw new SetupStop(
            `${command.join(' ')} failed:\n${result.output || `exit ${result.code}`}`
        );
    return result;
}

function serviceClient(values: Record<string, string>) {
    return createClient(values.PUBLIC_SUPABASE_URL, values.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

async function database(db: SupabaseClient) {
    step('Database');
    const { error } = await db.from('db_legals').select('slug').limit(1);
    if (error)
        throw new SetupStop(
            `The Supabase project has no Idstead schema (${error.message}). The migrations in supabase/migrations/ assume an existing schema, so a new project cannot be set up from them yet.`
        );
    note('The Idstead schema is present.');
}

async function findUser(db: SupabaseClient, email: string) {
    for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new SetupStop(`Listing Supabase users failed: ${error.message}`);
        const user = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase());
        if (user || data.users.length < 200) return user ?? null;
    }
}

async function adminUser(db: SupabaseClient, answers: SetupAnswers) {
    step('Admin account');
    const email = answers.adminEmail ?? ask('Email address for the admin account:');
    if (!email) throw new SetupStop('No admin email. Pass --answers with "adminEmail".');
    const user = await findUser(db, email);
    if (user?.app_metadata?.role === 'admin') {
        note(`${email} is already an admin.`);
        return;
    }
    if (user) {
        if (apply) {
            const { error } = await db.auth.admin.updateUserById(user.id, {
                app_metadata: { ...user.app_metadata, role: 'admin' }
            });
            if (error) throw new SetupStop(`Granting the admin role failed: ${error.message}`);
        }
        planned(`grant the admin role to the existing user ${email}`);
        return;
    }
    if (!apply) {
        planned(`create the admin user ${email} with a temporary password`);
        return;
    }
    const password = temporaryPassword();
    const { error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: 'admin' }
    });
    if (error) throw new SetupStop(`Creating the admin user failed: ${error.message}`);
    planned(`create the admin user ${email}`);
    note(`Temporary password (shown once): ${password}`);
}

async function legalPages(db: SupabaseClient) {
    step('Legal pages');
    const { data, error } = await db
        .from('db_legals')
        .select('slug')
        .in('slug', [...LEGAL_SLUGS]);
    if (error) throw new SetupStop(`Reading legal pages failed: ${error.message}`);
    const present = new Set((data ?? []).map(row => row.slug as string));
    for (const slug of LEGAL_SLUGS) {
        if (present.has(slug)) {
            note(`/${slug} already has content; left as is.`);
            continue;
        }
        const content = await readFile(path.join(ROOT, 'templates/legal', `${slug}.md`), 'utf8');
        if (apply) {
            const { error: insertError } = await db
                .from('db_legals')
                .insert({ slug, title: legalTitle(content, slug), content });
            if (insertError) throw new SetupStop(`Saving /${slug} failed: ${insertError.message}`);
        }
        planned(`add /${slug} from templates/legal/${slug}.md`);
    }
}

async function deploy(config: InstanceConfig, secrets: Record<App, Record<string, string>>) {
    step('Build and deploy');
    if (skipDeploy) {
        note('Skipped (--skip-deploy).');
        return;
    }
    if (!apply) {
        for (const app of APPS)
            planned(
                `deploy ${config.cloudflare.workers[app]} with ${Object.keys(secrets[app]).length} secrets`
            );
        return;
    }
    await mustRun(['bun', 'run', 'build'], { inherit: true });
    const directory = await mkdtemp(path.join(tmpdir(), 'idstead-setup-'));
    try {
        for (const app of APPS) {
            const file = path.join(directory, `${app}.json`);
            await writeFile(file, JSON.stringify(secrets[app]), { mode: 0o600 });
            await chmod(file, 0o600);
            await mustRun(['bunx', 'wrangler', 'deploy', '--secrets-file', file], {
                cwd: path.join(ROOT, 'apps', app),
                inherit: true
            });
            planned(`deploy ${config.cloudflare.workers[app]}`);
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

async function main() {
    if (!['dry-run', 'apply'].includes(mode)) throw new SetupStop(USAGE);
    console.log(
        apply ? 'Setting up Idstead.' : (
            'Dry run: nothing is changed. Run with "apply" to make these changes.'
        )
    );
    const answers = await readAnswers();
    const config = await instanceConfig(answers);
    const keys = await workerKeys();
    const values = await variables(config, keys);
    await cloudflare(config);
    const db = serviceClient(values);
    await database(db);
    await adminUser(db, answers);
    await legalPages(db);
    await deploy(config, workerSecrets(keys, values));
    step('Next steps');
    for (const [index, line] of nextSteps(config).entries()) note(`${index + 1}. ${line}`);
}

try {
    await main();
} catch (error) {
    if (!(error instanceof SetupStop)) throw error;
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
}
