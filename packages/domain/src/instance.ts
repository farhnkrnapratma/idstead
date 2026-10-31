export interface InstanceConfig {
    domains: { site: string; admin: string; api: string; redirectWww: boolean };
    cloudflare: {
        workers: { web: string; admin: string; api: string; jobs: string };
        assetBucket: string;
        newsletterQueue: string;
        database: { name: string; id: string | null };
        rateLimitNamespaces: { web: number; admin: number; api: number };
    };
    jobs: { cron: string; hourlyCron: string };
    access: { teamDomain: string; aud: string } | null;
    source: string | null;
}

export class InstanceConfigError extends Error {}

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESOURCE_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const CRON = /^(?:\S+\s+){4}\S+$/;
const ACCESS_AUD = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Raw = Record<string, unknown>;

function record(value: unknown, path: string): Raw {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new InstanceConfigError(`${path} must be an object.`);
    return value as Raw;
}

function text(value: unknown, path: string, pattern: RegExp, fallback?: string): string {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'string' || !pattern.test(value))
        throw new InstanceConfigError(`${path} is missing or invalid.`);
    return value;
}

function namespace(value: unknown, path: string, fallback: number): number {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || (value as number) < 1)
        throw new InstanceConfigError(`${path} must be a positive integer.`);
    return value as number;
}

export function resolveInstanceConfig(value: unknown): InstanceConfig {
    const root = record(value, 'config');
    const domains = record(root.domains, 'domains');
    const cloudflare = record(root.cloudflare, 'cloudflare');
    const workers = record(cloudflare.workers, 'cloudflare.workers');
    const namespaces = record(cloudflare.rateLimitNamespaces, 'cloudflare.rateLimitNamespaces');
    const database = record(cloudflare.database, 'cloudflare.database');
    const jobs = record(root.jobs, 'jobs');
    const site = text(domains.site, 'domains.site', HOSTNAME);
    if (domains.redirectWww !== undefined && typeof domains.redirectWww !== 'boolean')
        throw new InstanceConfigError('domains.redirectWww must be a boolean.');
    const queue = text(
        cloudflare.newsletterQueue,
        'cloudflare.newsletterQueue',
        RESOURCE_NAME,
        'idstead-newsletter'
    );
    if (queue.endsWith('-dlq'))
        throw new InstanceConfigError('cloudflare.newsletterQueue must not end with -dlq.');
    return {
        domains: {
            site,
            admin: text(domains.admin, 'domains.admin', HOSTNAME, `admin.${site}`),
            api: text(domains.api, 'domains.api', HOSTNAME, `api.${site}`),
            redirectWww: (domains.redirectWww as boolean | undefined) ?? true
        },
        cloudflare: {
            workers: {
                web: text(workers.web, 'cloudflare.workers.web', RESOURCE_NAME, 'idstead-web'),
                admin: text(
                    workers.admin,
                    'cloudflare.workers.admin',
                    RESOURCE_NAME,
                    'idstead-admin'
                ),
                api: text(workers.api, 'cloudflare.workers.api', RESOURCE_NAME, 'idstead-api'),
                jobs: text(workers.jobs, 'cloudflare.workers.jobs', RESOURCE_NAME, 'idstead-jobs')
            },
            assetBucket: text(
                cloudflare.assetBucket,
                'cloudflare.assetBucket',
                RESOURCE_NAME,
                'idstead-assets'
            ),
            newsletterQueue: queue,
            database: {
                name: text(database.name, 'cloudflare.database.name', RESOURCE_NAME, 'idstead'),
                id:
                    database.id === undefined ?
                        null
                    :   text(database.id, 'cloudflare.database.id', UUID)
            },
            rateLimitNamespaces: {
                web: namespace(namespaces.web, 'cloudflare.rateLimitNamespaces.web', 1001),
                api: namespace(namespaces.api, 'cloudflare.rateLimitNamespaces.api', 1002),
                admin: namespace(namespaces.admin, 'cloudflare.rateLimitNamespaces.admin', 1003)
            }
        },
        jobs: jobSchedules(jobs),
        access: accessSettings(root.access),
        source: sourceUrl(root.source)
    };
}

function accessSettings(value: unknown): InstanceConfig['access'] {
    if (value === undefined || value === null) return null;
    const access = record(value, 'access');
    const teamDomain = text(access.teamDomain, 'access.teamDomain', HOSTNAME);
    if (!teamDomain.endsWith('.cloudflareaccess.com'))
        throw new InstanceConfigError('access.teamDomain must end with .cloudflareaccess.com.');
    return { teamDomain, aud: text(access.aud, 'access.aud', ACCESS_AUD) };
}

function sourceUrl(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const url = typeof value === 'string' && URL.canParse(value) ? new URL(value) : null;
    if (!url || url.protocol !== 'https:' || url.username || url.password)
        throw new InstanceConfigError('source must be an https:// URL.');
    return url.href;
}

function jobSchedules(jobs: Raw): InstanceConfig['jobs'] {
    const cron = text(jobs.cron, 'jobs.cron', CRON, '17 3 * * *');
    const hourlyCron = text(jobs.hourlyCron, 'jobs.hourlyCron', CRON, '37 * * * *');
    if (cron === hourlyCron)
        throw new InstanceConfigError('jobs.cron and jobs.hourlyCron must be different.');
    return { cron, hourlyCron };
}

export function instanceVariables(config: InstanceConfig): Record<string, string> {
    return {
        'domains.site': config.domains.site,
        'domains.admin': config.domains.admin,
        'domains.api': config.domains.api,
        'workers.web': config.cloudflare.workers.web,
        'workers.admin': config.cloudflare.workers.admin,
        'workers.api': config.cloudflare.workers.api,
        'workers.jobs': config.cloudflare.workers.jobs,
        assetBucket: config.cloudflare.assetBucket,
        newsletterQueue: config.cloudflare.newsletterQueue,
        newsletterDeadLetterQueue: `${config.cloudflare.newsletterQueue}-dlq`,
        'rateLimitNamespaces.web': String(config.cloudflare.rateLimitNamespaces.web),
        'rateLimitNamespaces.admin': String(config.cloudflare.rateLimitNamespaces.admin),
        'rateLimitNamespaces.api': String(config.cloudflare.rateLimitNamespaces.api),
        'jobs.cron': config.jobs.cron,
        'jobs.hourlyCron': config.jobs.hourlyCron,
        'access.teamDomain': config.access?.teamDomain ?? '',
        'access.aud': config.access?.aud ?? '',
        source: config.source ?? ''
    };
}
