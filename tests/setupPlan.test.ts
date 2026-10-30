import { describe, expect, test } from 'bun:test';
import { resolveInstanceConfig } from '../packages/domain/src/instance.ts';
import { LEGAL_SLUGS as SITE_LEGAL_SLUGS } from '../packages/domain/src/legal.ts';
import {
    LEGAL_SLUGS,
    SetupAnswersError,
    instanceSource,
    legalTemplate,
    missingVariables,
    requiredVariables,
    resolveSetupAnswers,
    setupVariables,
    temporaryPassword,
    workerSecrets,
    type WorkerKeys
} from '../tooling/setup/plan.ts';
import { passwordPolicyError } from '../packages/domain/src/passwordPolicy.ts';

const workers: WorkerKeys = {
    api: { keys: ['PUBLIC_SUPABASE_URL'], required: ['PUBLIC_SUPABASE_URL'] },
    jobs: {
        keys: ['PUBLIC_SITE_URL', 'RESEND_API_KEY'],
        required: ['PUBLIC_SITE_URL', 'RESEND_API_KEY']
    },
    web: { keys: ['PUBLIC_API_BASE_URL', 'PUBLIC_GA_MEASUREMENT_ID', 'IP_SALT'], required: [] },
    admin: { keys: ['PUBLIC_SITE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], required: [] }
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
            expect.arrayContaining(['PUBLIC_SUPABASE_URL', 'RESEND_API_KEY', 'TURNSTILE_SECRET'])
        );
        expect(requiredVariables(workers)).not.toContain('PUBLIC_GA_MEASUREMENT_ID');
        const values = setupVariables({ PUBLIC_SUPABASE_URL: 'https://db.example' }, config);
        expect(missingVariables(workers, values)).toContain('RESEND_API_KEY');
        expect(missingVariables(workers, values)).not.toContain('PUBLIC_SITE_URL');
    });

    test('give each worker only its own keys that have values', () => {
        const secrets = workerSecrets(
            workers,
            setupVariables({ IP_SALT: 'salt', SUPABASE_SERVICE_ROLE_KEY: 'service' }, config)
        );
        expect(secrets.web).toEqual({
            IP_SALT: 'salt',
            PUBLIC_API_BASE_URL: 'https://api.example.org'
        });
        expect(secrets.admin).toEqual({
            PUBLIC_SITE_URL: 'https://example.org',
            SUPABASE_SERVICE_ROLE_KEY: 'service'
        });
        expect(secrets.api).toEqual({});
    });
});

describe('content helpers', () => {
    test('legalTemplate takes the title from the first heading and removes it', () => {
        expect(
            legalTemplate(':::define\na: 1\n:::\n\n# Privacy Policy\n\nText', 'privacy')
        ).toEqual({ title: 'Privacy Policy', content: ':::define\na: 1\n:::\n\nText' });
        expect(legalTemplate('No heading', 'terms')).toEqual({
            title: 'Terms',
            content: 'No heading'
        });
    });

    test('seeds every legal page the site serves from a template', async () => {
        expect([...LEGAL_SLUGS].sort()).toEqual([...SITE_LEGAL_SLUGS].sort());
        for (const slug of LEGAL_SLUGS)
            expect(
                await Bun.file(new URL(`../templates/legal/${slug}.md`, import.meta.url)).exists()
            ).toBe(true);
    });

    test('temporaryPassword meets the admin password policy', () => {
        const passwords = Array.from({ length: 20 }, () => temporaryPassword());
        for (const password of passwords) {
            expect(password).toHaveLength(24);
            expect(passwordPolicyError(password)).toBe('');
        }
        expect(new Set(passwords).size).toBe(passwords.length);
    });
});
