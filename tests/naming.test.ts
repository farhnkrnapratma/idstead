import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const LEGACY_NAME = /fkp/i;

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

function mentionsLegacyName(file: string): boolean {
    try {
        return LEGACY_NAME.test(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    } catch {
        return false;
    }
}

describe('Idstead naming', () => {
    test('only the migration and instance files use the old name', () => {
        const offenders = trackedFiles().filter(
            file =>
                !MIGRATION_FILES.has(file) && !INSTANCE_FILES.has(file) && mentionsLegacyName(file)
        );
        expect(offenders).toEqual([]);
    });
});
