import type { InstanceConfig } from '../../packages/domain/src/instance.ts';

export const APPS = ['api', 'jobs', 'web', 'admin'] as const;
export type App = (typeof APPS)[number];
export type Variables = Record<string, string | undefined>;
export type WorkerKeys = Record<App, { keys: string[]; required: string[] }>;

export const LEGAL_SLUGS = ['privacy', 'terms', 'security'] as const;

export const CORE_VARIABLES = [
    'PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'IP_SALT',
    'PUBLIC_TURNSTILE_SITE_KEY',
    'TURNSTILE_SECRET'
];

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

export function legalTemplate(markdown: string, slug: string): { title: string; content: string } {
    const heading = markdown.match(/^# (.+)\n+/m);
    const title = heading?.[1]?.trim() || slug.charAt(0).toUpperCase() + slug.slice(1);
    const content = heading ? markdown.replace(heading[0], '') : markdown;
    return { title, content };
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.!';

export function temporaryPassword(length = 24): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    const limit = 256 - (256 % PASSWORD_ALPHABET.length);
    let password = '';
    for (const byte of bytes) {
        if (byte >= limit) continue;
        password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
        if (password.length === length) return password;
    }
    return password + temporaryPassword(length - password.length);
}

export function nextSteps(config: InstanceConfig): string[] {
    const { site, admin, api } = config.domains;
    return [
        `Supabase Auth > URL Configuration: add https://${admin} to the redirect URLs, and to the passkey relying party origins if you sign in with passkeys.`,
        `Supabase Auth > Attack Protection: turn on CAPTCHA with Turnstile and paste the same secret as TURNSTILE_SECRET.`,
        `Turnstile: allow the hostnames ${site} and ${admin} on the widget whose site key is PUBLIC_TURNSTILE_SITE_KEY.`,
        `Resend: verify the domain of SUBSCRIBER_FROM_EMAIL before the newsletter or contact form sends mail.`,
        `Sign in at https://${admin}/login, change the temporary password, and enrol an authenticator or passkey under Account settings.`,
        `Fill in your profile in the admin portal, review the legal pages, then check https://${site} and https://${api}/v1.`
    ];
}
