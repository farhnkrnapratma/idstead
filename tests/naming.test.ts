import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const LEGACY_NAME = /fkp/i;
const OWNER_HANDLE = /farhnkrnapratma/i;

const MIGRATION_FILES = new Set([
    'apps/web/src/app.html',
    'packages/ui/src/utils/legacyStorageKeys.ts',
    'tests/naming.test.ts'
]);

const INSTANCE_FILES = new Set([
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'SECURITY.md',
    'idstead.jsonc',
    'apps/admin/wrangler.jsonc',
    'apps/api/wrangler.jsonc',
    'apps/jobs/wrangler.jsonc',
    'apps/web/wrangler.jsonc'
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

function mentions(file: string, pattern: RegExp): boolean {
    try {
        return pattern.test(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    } catch {
        return false;
    }
}

describe('Idstead naming', () => {
    test('only the migration and instance files use the old name', () => {
        const offenders = trackedFiles().filter(
            file =>
                !MIGRATION_FILES.has(file)
                && !INSTANCE_FILES.has(file)
                && mentions(file, LEGACY_NAME)
        );
        expect(offenders).toEqual([]);
    });

    test('application code never falls back to the owner handle', () => {
        const offenders = trackedFiles().filter(
            file => /^(apps|packages)\//.test(file) && mentions(file, OWNER_HANDLE)
        );
        expect(offenders).toEqual([]);
    });
});
