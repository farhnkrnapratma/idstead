import { describe, expect, test } from 'bun:test';
import { $ } from 'bun';

const ROOT = new URL('..', import.meta.url).pathname;
const LEGACY_NAME = /fkp/i;
const OWNER_HANDLE = /farhnkrnapratma/i;

const MIGRATION_FILES = new Set(['apps/web/src/app.html', 'tests/naming.test.ts']);

const INSTANCE_FILES = new Set([
    'CLAUDE.md',
    'README.md',
    'SECURITY.md',
    'idstead.jsonc',
    'apps/admin/wrangler.jsonc',
    'apps/api/wrangler.jsonc',
    'apps/jobs/wrangler.jsonc',
    'apps/web/wrangler.jsonc'
]);

const trackedFiles = (await $`git ls-files`.cwd(ROOT).quiet().text())
    .split('\n')
    .filter(file => file && file !== 'bun.lock');

async function mentioning(files: string[], pattern: RegExp): Promise<string[]> {
    const matches = await Promise.all(
        files.map(file =>
            Bun.file(`${ROOT}${file}`)
                .text()
                .then(
                    text => pattern.test(text),
                    () => false
                )
        )
    );
    return files.filter((_, index) => matches[index]);
}

describe('Idstead naming', () => {
    test('only the migration and instance files use the old name', async () => {
        const offenders = await mentioning(
            trackedFiles.filter(file => !MIGRATION_FILES.has(file) && !INSTANCE_FILES.has(file)),
            LEGACY_NAME
        );
        expect(offenders).toEqual([]);
    });

    test('application code never falls back to the owner handle', async () => {
        const offenders = await mentioning(
            trackedFiles.filter(
                file => /^(apps|packages)\//.test(file) && !INSTANCE_FILES.has(file)
            ),
            OWNER_HANDLE
        );
        expect(offenders).toEqual([]);
    });
});
