import { describe, expect, test } from 'bun:test';
import { resolveInstanceConfig } from '../packages/domain/src/instance.ts';
import {
    SetupAnswersError,
    instanceSource,
    missingVariables,
    requiredVariables,
    resolveSetupAnswers,
    setupVariables,
    accessApplicationBody,
    accessPolicyBody,
    nextSteps,
    withAccess,
    workerSecrets,
    type WorkerKeys
} from '../tooling/setup/plan.ts';

const workers: WorkerKeys = {
    api: { keys: ['PUBLIC_SENTRY_DSN'], required: ['PUBLIC_SENTRY_DSN'] },
    jobs: {
        keys: ['PUBLIC_SITE_URL', 'RESEND_API_KEY'],
        required: ['PUBLIC_SITE_URL', 'RESEND_API_KEY']
    },
    web: { keys: ['PUBLIC_API_BASE_URL', 'PUBLIC_STATUS_PAGE_HOST', 'IP_SALT'], required: [] },
    admin: { keys: ['PUBLIC_SITE_URL', 'ADMIN_EMAILS'], required: [] }
};

const config = resolveInstanceConfig({ domains: { site: 'example.org' } });

describe('resolveSetupAnswers', () => {
    test('normalises the domain and keeps the admin email', () => {
        expect(
            resolveSetupAnswers({ domain: ' Example.ORG ', adminEmail: ' ada@example.org ' })
        ).toEqual({ domain: 'example.org', adminEmail: 'ada@example.org' });
    });

    test('rejects unknown keys, bad emails and a non-object instance', () => {
        expect(() => resolveSetupAnswers({ domian: 'example.org' })).toThrow(SetupAnswersError);
        expect(() => resolveSetupAnswers({ adminEmail: 'not-an-email' })).toThrow(
            SetupAnswersError
        );
        expect(() => resolveSetupAnswers({ instance: [] })).toThrow(SetupAnswersError);
        expect(() => resolveSetupAnswers('example.org')).toThrow(SetupAnswersError);
    });
});

describe('instanceSource', () => {
    test('is null without a domain or instance', () => {
        expect(instanceSource({ adminEmail: 'ada@example.org' })).toBeNull();
    });

    test('lets the domain answer override the instance site', () => {
        const source = instanceSource({
            domain: 'example.org',
            instance: {
                domains: { site: 'old.example', redirectWww: false },
                jobs: { cron: '0 4 * * *' }
            }
        });
        expect(source).toEqual({
            domains: { site: 'example.org', redirectWww: false },
            jobs: { cron: '0 4 * * *' }
        });
        expect(resolveInstanceConfig(source).domains.admin).toBe('admin.example.org');
    });
});

describe('variables', () => {
    test('derive the site and API URLs from the instance and let the environment override them', () => {
        expect(setupVariables({}, config)).toMatchObject({
            PUBLIC_SITE_URL: 'https://example.org',
            PUBLIC_API_BASE_URL: 'https://api.example.org',
            PUBLIC_ADMIN_URL: 'https://admin.example.org',
            PUBLIC_SENTRY_ENVIRONMENT: 'production'
        });
        expect(
            setupVariables({ PUBLIC_SITE_URL: 'https://www.example.org', EMPTY: ' ' }, config)
        ).not.toHaveProperty('EMPTY');
        expect(
            setupVariables({ PUBLIC_SITE_URL: 'https://www.example.org' }, config)
        ).toMatchObject({ PUBLIC_SITE_URL: 'https://www.example.org' });
    });

    test('turn the admin sign-in flag on when a signing key is set', () => {
        expect(setupVariables({}, config)).not.toHaveProperty('OIDC_ENABLED');
        expect(setupVariables({ OIDC_SIGNING_KEY: '{"kty":"EC"}' }, config)).toMatchObject({
            OIDC_ENABLED: '1'
        });
        expect(
            setupVariables({ OIDC_SIGNING_KEY: '{"kty":"EC"}', OIDC_ENABLED: '0' }, config)
        ).toMatchObject({ OIDC_ENABLED: '0' });
    });

    test('require the core keys and every key a wrangler worker declares', () => {
        expect(requiredVariables(workers)).toEqual(
            expect.arrayContaining(['PUBLIC_SENTRY_DSN', 'RESEND_API_KEY', 'TURNSTILE_SECRET'])
        );
        expect(requiredVariables(workers)).not.toContain('PUBLIC_STATUS_PAGE_HOST');
        const values = setupVariables(
            { PUBLIC_SENTRY_DSN: 'https://key@sentry.example/1' },
            config
        );
        expect(missingVariables(workers, values)).toContain('RESEND_API_KEY');
        expect(missingVariables(workers, values)).not.toContain('PUBLIC_SITE_URL');
    });

    test('give each worker only its own keys that have values', () => {
        const secrets = workerSecrets(
            workers,
            setupVariables({ IP_SALT: 'salt', ADMIN_EMAILS: 'ada@example.org' }, config)
        );
        expect(secrets.web).toEqual({
            IP_SALT: 'salt',
            PUBLIC_API_BASE_URL: 'https://api.example.org'
        });
        expect(secrets.admin).toEqual({
            PUBLIC_SITE_URL: 'https://example.org',
            ADMIN_EMAILS: 'ada@example.org'
        });
        expect(secrets.api).toEqual({});
    });
});

describe('Cloudflare Access setup', () => {
    test('admits only the admin email on the admin host', () => {
        expect(accessPolicyBody('Ada@Example.org')).toMatchObject({
            decision: 'allow',
            include: [{ email: { email: 'ada@example.org' } }]
        });
        expect(accessApplicationBody(config, 'policy-1')).toMatchObject({
            domain: 'admin.example.org',
            type: 'self_hosted',
            policies: [{ id: 'policy-1', precedence: 1 }]
        });
    });

    test('stores the team domain and audience in a valid instance config', () => {
        const access = { teamDomain: 'ada.cloudflareaccess.com', aud: 'c'.repeat(64) };
        const source = withAccess({ domains: { site: 'example.org' } }, access);
        expect(resolveInstanceConfig(source).access).toEqual(access);
    });

    test('next steps no longer mention a password sign-in', () => {
        const text = nextSteps(config).join(' ');
        expect(text).toContain('Cloudflare Access');
        expect(text).not.toMatch(/password|\/login/i);
    });
});
