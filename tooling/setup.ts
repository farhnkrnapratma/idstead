import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';
import { format, resolveConfig } from 'prettier';
import {
    InstanceConfigError,
    resolveInstanceConfig,
    type InstanceConfig
} from '../packages/domain/src/instance.ts';
import { renderWranglerConfigs } from './configure.ts';
import { isSigningKey } from './oidc-key.ts';
import {
    APPS,
    SetupAnswersError,
    instanceSource,
    missingVariables,
    nextSteps,
    resolveSetupAnswers,
    setupVariables,
    accessApplicationBody,
    accessPolicyBody,
    withAccess,
    workerSecrets,
    type App,
    type SetupAnswers,
    type WorkerKeys
} from './setup/plan.ts';

const ROOT = path.resolve(import.meta.dir, '..');
const CONFIG_FILE = path.join(ROOT, 'idstead.jsonc');
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
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
    const shell = $`${command} < /dev/null`.cwd(options.cwd ?? ROOT).nothrow();
    if (options.inherit) return { code: (await shell).exitCode, output: '' };
    const { exitCode, stdout, stderr } = await shell.quiet();
    return { code: exitCode, output: `${stdout}${stderr}`.trim() };
}

async function readAnswers(): Promise<SetupAnswers> {
    if (!answersFile) return {};
    try {
        return resolveSetupAnswers(Bun.JSONC.parse(await Bun.file(answersFile).text()));
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
    const configFile = Bun.file(CONFIG_FILE);
    const existing = (await configFile.exists()) ? await configFile.text() : null;
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
        if (apply) await Bun.write(CONFIG_FILE, content);
        planned(`write idstead.jsonc for ${config.domains.site}`);
    }
    const rendered = await renderWranglerConfigs(config);
    for (const [file, text] of Object.entries(rendered)) {
        const current = await Bun.file(file)
            .text()
            .catch(() => '');
        if (current === text) continue;
        if (apply) await Bun.write(file, text);
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
            await Bun.file(path.join(ROOT, 'apps', app, 'wrangler.template.jsonc')).text()
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
    if (!values.OIDC_SIGNING_KEY)
        note(
            'OIDC_SIGNING_KEY is not set, so Sign in with Idstead stays off. bun tooling/oidc-key.ts prints a key to store in your secret manager.'
        );
    else if (!(await isSigningKey(values.OIDC_SIGNING_KEY)))
        throw new SetupStop(
            'OIDC_SIGNING_KEY is not a private P-256 JWK. bun tooling/oidc-key.ts prints one.'
        );
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

async function databaseId(name: string): Promise<string | null> {
    const listed = await mustRun(['bunx', 'wrangler', 'd1', 'list', '--json']);
    const databases = JSON.parse(listed.output.slice(listed.output.indexOf('['))) as {
        name: string;
        uuid: string;
    }[];
    return databases.find(item => item.name === name)?.uuid ?? null;
}

async function saveInstance(
    update: (source: Record<string, unknown>) => Record<string, unknown>
): Promise<InstanceConfig> {
    const source = update(
        Bun.JSONC.parse(await Bun.file(CONFIG_FILE).text()) as Record<string, unknown>
    );
    await Bun.write(
        CONFIG_FILE,
        await format(JSON.stringify(source), {
            ...(await resolveConfig(CONFIG_FILE)),
            filepath: CONFIG_FILE
        })
    );
    const updated = resolveInstanceConfig(source);
    for (const [file, text] of Object.entries(await renderWranglerConfigs(updated)))
        await Bun.write(file, text);
    return updated;
}

function saveDatabaseId(config: InstanceConfig, id: string): Promise<InstanceConfig> {
    return saveInstance(source => {
        const cloudflare = (source.cloudflare ?? {}) as Record<string, unknown>;
        const database = (cloudflare.database ?? {}) as Record<string, unknown>;
        return {
            ...source,
            cloudflare: {
                ...cloudflare,
                database: { ...database, name: config.cloudflare.database.name, id }
            }
        };
    });
}

async function database(config: InstanceConfig): Promise<InstanceConfig> {
    step('D1 database');
    const { name, id } = config.cloudflare.database;
    let current = config;
    if (id) note(`idstead.jsonc binds the database ${name} (${id}).`);
    else {
        let found = await databaseId(name);
        if (!found) {
            if (!apply) {
                planned(`create the D1 database ${name} and write its ID to idstead.jsonc`);
                planned('apply the D1 migrations');
                return config;
            }
            await mustRun(['bunx', 'wrangler', 'd1', 'create', name]);
            found = await databaseId(name);
            if (!found) throw new SetupStop(`The D1 database ${name} was not created.`);
            planned(`create the D1 database ${name}`);
        } else note(`Database ${name} exists.`);
        if (apply) current = await saveDatabaseId(config, found);
        planned(`write the database ID to idstead.jsonc and render the Wrangler configs`);
    }
    if (apply)
        await mustRun(['bunx', 'wrangler', 'd1', 'migrations', 'apply', name, '--remote'], {
            cwd: path.join(ROOT, 'apps/web')
        });
    planned('apply the D1 migrations');
    return current;
}

async function cloudflareApi<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${CLOUDFLARE_API}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        result?: T;
        errors?: { message?: string }[];
    } | null;
    if (!response.ok || !body?.success || body.result === undefined)
        throw new SetupStop(
            `Cloudflare API ${init.method ?? 'GET'} ${path} failed: ${
                body?.errors?.map(error => error.message).join('; ') || `HTTP ${response.status}`
            }`
        );
    return body.result;
}

async function adminAccess(
    config: InstanceConfig,
    answers: SetupAnswers,
    values: Record<string, string>
): Promise<InstanceConfig> {
    step('Admin sign-in (Cloudflare Access)');
    const admin = config.domains.admin;
    const email =
        answers.adminEmail
        ?? values.ADMIN_EMAILS?.split(',')[0]?.trim()
        ?? ask('Email address that may sign in to the admin:');
    if (!email && !apply && !config.access) {
        planned(`create the Access application for ${admin} once the admin email is known`);
        return config;
    }
    if (!email) throw new SetupStop('No admin email. Pass --answers with "adminEmail".');
    values.ADMIN_EMAILS ||= email.toLowerCase();
    if (config.access) {
        note(`idstead.jsonc uses the Access application on ${config.access.teamDomain}.`);
        return config;
    }
    const account = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!process.env.CLOUDFLARE_API_TOKEN || !account) {
        if (!apply) {
            planned(`create the Access application for ${admin} that admits ${email}`);
            return config;
        }
        throw new SetupStop(
            `Set CLOUDFLARE_API_TOKEN (Access: Apps and Policies Write, Access: Organizations, Identity Providers, and Groups Read) and CLOUDFLARE_ACCOUNT_ID, or add a self-hosted Access application for ${admin} in Cloudflare Zero Trust and write "access": { "teamDomain", "aud" } to idstead.jsonc.`
        );
    }
    const organization = await cloudflareApi<{ auth_domain?: string }>(
        `/accounts/${account}/access/organizations`
    ).catch(() => null);
    const teamDomain = organization?.auth_domain?.toLowerCase();
    if (!teamDomain)
        throw new SetupStop(
            'This Cloudflare account has no Zero Trust organization. Open Cloudflare Zero Trust once, pick a team name and the Free plan, then run setup again.'
        );
    note(`Zero Trust team domain: ${teamDomain}.`);
    const apps = await cloudflareApi<{ domain?: string; aud?: string }[]>(
        `/accounts/${account}/access/apps`
    );
    let app = apps.find(item => item.domain?.toLowerCase() === admin);
    if (app) note(`An Access application already covers ${admin}.`);
    else {
        if (!apply) {
            planned(`create the Access application for ${admin} that admits ${email}`);
            planned('write the Access team domain and audience to idstead.jsonc');
            return config;
        }
        const policy = await cloudflareApi<{ id: string }>(`/accounts/${account}/access/policies`, {
            method: 'POST',
            body: JSON.stringify(accessPolicyBody(email))
        });
        app = await cloudflareApi<{ domain?: string; aud?: string }>(
            `/accounts/${account}/access/apps`,
            { method: 'POST', body: JSON.stringify(accessApplicationBody(config, policy.id)) }
        );
        planned(`create the Access application for ${admin} that admits ${email}`);
    }
    if (!app.aud) throw new SetupStop(`The Access application for ${admin} has no audience tag.`);
    if (!apply) {
        planned('write the Access team domain and audience to idstead.jsonc');
        return config;
    }
    const aud = app.aud;
    const updated = await saveInstance(source => withAccess(source, { teamDomain, aud }));
    planned('write the Access team domain and audience to idstead.jsonc');
    return updated;
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
            await Bun.write(file, JSON.stringify(secrets[app]), { mode: 0o600 });
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
    const withDatabase = await database(config);
    const ready = await adminAccess(withDatabase, answers, values);
    await deploy(ready, workerSecrets(keys, values));
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
