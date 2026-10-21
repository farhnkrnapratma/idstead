import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const LEGACY_NAME = /fkp/i;

const MIGRATION_FILES = new Set([
    'apps/web/src/app.html',
    'packages/ui/src/utils/legacyStorageKeys.ts',
    'tests/naming.test.ts'
]);

const INSTANCE_FILES = new Set([
    'README.md',
    'SECURITY.md',
    'idstead.jsonc',
    'apps/admin/wrangler.jsonc',
    'apps/api/wrangler.jsonc',
    'apps/jobs/wrangler.jsonc',
    'apps/web/wrangler.jsonc'
]);

const PENDING_FILES = new Set([
    'AGENTS.md',
    'CLAUDE.md',
    'docs/001-architecture/001-component-map.md',
    'docs/001-architecture/002-web-middleware-pipeline.md',
    'docs/001-architecture/003-page-render.md',
    'docs/001-architecture/004-public-write-endpoints.md',
    'docs/001-architecture/005-public-api.md',
    'docs/001-architecture/006-admin-login-mfa.md',
    'docs/001-architecture/007-publish-post.md',
    'docs/001-architecture/008-asset-pipeline.md',
    'docs/001-architecture/010-endpoint-reference.md',
    'docs/001-architecture/011-cv-documents.md',
    'docs/003-api/002-ard.md',
    'docs/003-api/README.md',
    'docs/004-development/001-local-setup.md',
    'docs/004-development/002-environment.md',
    'docs/004-development/003-testing.md',
    'docs/005-operations/001-deployment.md',
    'docs/005-operations/002-newsletter.md',
    'docs/006-security.md'
]);

function trackedFiles(): string[] {
    const result = Bun.spawnSync(['git', 'ls-files'], {
        cwd: new URL('..', import.meta.url).pathname
    });
    return new TextDecoder()
        .decode(result.stdout)
        .split('\n')
        .filter(file => file && file !== 'bun.lock' && !file.startsWith('supabase/migrations/'));
}

function mentionsLegacyName(file: string): boolean {
    try {
        return LEGACY_NAME.test(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    } catch {
        return false;
    }
}

describe('Idstead naming', () => {
    const offenders = trackedFiles().filter(
        file => !MIGRATION_FILES.has(file) && !INSTANCE_FILES.has(file) && mentionsLegacyName(file)
    );

    test('only allowlisted files still use the old name', () => {
        expect(offenders.filter(file => !PENDING_FILES.has(file))).toEqual([]);
    });

    test('the pending list only names files that still need the rename', () => {
        expect([...PENDING_FILES].filter(file => !offenders.includes(file))).toEqual([]);
    });
});
