import type { InstanceConfig } from '../../packages/domain/src/instance.ts';

export const APPS = ['api', 'jobs', 'web', 'admin'] as const;
export type App = (typeof APPS)[number];
export type Variables = Record<string, string | undefined>;
export type WorkerKeys = Record<App, { keys: string[]; required: string[] }>;

export const CORE_VARIABLES = ['IP_SALT', 'PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET'];

export interface SetupAnswers {
    domain?: string;
    adminEmail?: string;
    instance?: Record<string, unknown>;
}

export class SetupAnswersError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resolveSetupAnswers(value: unknown): SetupAnswers {
    if (!isRecord(value)) throw new SetupAnswersError('answers must be an object.');
    const known = new Set(['domain', 'adminEmail', 'instance']);
    const unknown = Object.keys(value).filter(key => !known.has(key));
    if (unknown.length) throw new SetupAnswersError(`unknown answers: ${unknown.join(', ')}.`);
    const { domain, adminEmail, instance } = value;
    if (domain !== undefined && typeof domain !== 'string')
        throw new SetupAnswersError('domain must be a string.');
    if (
        adminEmail !== undefined
        && (typeof adminEmail !== 'string' || !EMAIL.test(adminEmail.trim()))
    )
        throw new SetupAnswersError('adminEmail must be an email address.');
    if (instance !== undefined && !isRecord(instance))
        throw new SetupAnswersError('instance must be an object shaped like idstead.jsonc.');
    return {
        ...(domain === undefined ? {} : { domain: domain.trim().toLowerCase() }),
        ...(adminEmail === undefined ? {} : { adminEmail: adminEmail.trim() }),
        ...(instance === undefined ? {} : { instance })
    };
}

export function instanceSource(answers: SetupAnswers): Record<string, unknown> | null {
    if (!answers.domain && !answers.instance) return null;
    const instance = answers.instance ?? {};
    const domains = isRecord(instance.domains) ? instance.domains : {};
    return {
        ...instance,
        domains: { ...domains, ...(answers.domain ? { site: answers.domain } : {}) }
    };
}

export function setupVariables(env: Variables, config: InstanceConfig): Record<string, string> {
    const variables: Record<string, string> = {
        PUBLIC_SITE_URL: `https://${config.domains.site}`,
        PUBLIC_API_BASE_URL: `https://${config.domains.api}`,
        PUBLIC_ADMIN_URL: `https://${config.domains.admin}`,
        PUBLIC_SENTRY_ENVIRONMENT: 'production'
    };
    for (const [key, value] of Object.entries(env))
        if (/^[A-Z][A-Z0-9_]*$/.test(key) && value?.trim()) variables[key] = value.trim();
    if (variables.OIDC_SIGNING_KEY && !variables.OIDC_ENABLED) variables.OIDC_ENABLED = '1';
    return variables;
}

export function requiredVariables(workers: WorkerKeys): string[] {
    return [...new Set([...CORE_VARIABLES, ...APPS.flatMap(app => workers[app].required)])].sort();
}

export function missingVariables(workers: WorkerKeys, variables: Record<string, string>): string[] {
    return requiredVariables(workers).filter(key => !variables[key]);
}

export function workerSecrets(
    workers: WorkerKeys,
    variables: Record<string, string>
): Record<App, Record<string, string>> {
    return Object.fromEntries(
        APPS.map(app => [
            app,
            Object.fromEntries(
                workers[app].keys
                    .filter(key => variables[key])
                    .sort()
                    .map(key => [key, variables[key]])
            )
        ])
    ) as Record<App, Record<string, string>>;
}

const ACCESS_APP_NAME = 'Idstead admin';
const ACCESS_POLICY_NAME = 'Idstead owner';

export function accessPolicyBody(adminEmail: string) {
    return {
        name: ACCESS_POLICY_NAME,
        decision: 'allow',
        include: [{ email: { email: adminEmail.toLowerCase() } }],
        session_duration: '24h'
    };
}

export function accessApplicationBody(config: InstanceConfig, policyId: string) {
    return {
        name: ACCESS_APP_NAME,
        domain: config.domains.admin,
        type: 'self_hosted',
        session_duration: '24h',
        app_launcher_visible: false,
        policies: [{ id: policyId, precedence: 1 }]
    };
}

export function withAccess(
    source: Record<string, unknown>,
    access: { teamDomain: string; aud: string }
): Record<string, unknown> {
    return { ...source, access };
}

export function nextSteps(config: InstanceConfig): string[] {
    const { site, admin, api } = config.domains;
    return [
        `Cloudflare Zero Trust > Access settings: require two-factor authentication (passkey, security key or authenticator app) for the ${admin} application, or turn on two-factor authentication for your Cloudflare account if you sign in with Cloudflare.`,
        `Turnstile: allow the hostname ${site} on the widget whose site key is PUBLIC_TURNSTILE_SITE_KEY.`,
        `Resend: verify the domain of SUBSCRIBER_FROM_EMAIL before the newsletter or contact form sends mail.`,
        `Open https://${admin}, sign in through Cloudflare Access with the admin email, then fill in your profile and write the legal pages.`,
        `Check https://${site} and https://${api}/v1.`
    ];
}
