import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

const root = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
    return [
        ...new Bun.Glob('**/*.{svelte,ts,html}').scanSync({ cwd: join(root, dir), absolute: true })
    ];
}

const adminSources = [
    ...sources('apps/admin/src'),
    ...sources('packages/lib/src/components/admin')
];
const read = (path: string) => Bun.file(join(root, path)).text();

describe('Admin keyboard shortcuts', () => {
    test('admin code never registers, renders or advertises shortcuts', async () => {
        const texts = await Promise.all(adminSources.map(file => Bun.file(file).text()));
        const forbidden = [
            'use:shortcut',
            'ShortcutCatalogDialog',
            'ShortcutModeIndicator',
            'ShortcutBadge',
            'installSubmitShortcut',
            'aria-keyshortcuts',
            "group: 'sidebar'"
        ];
        const hits = adminSources.flatMap((file, index) => {
            const text = texts[index];
            return forbidden
                .filter(token => text.includes(token))
                .map(token => `${file}: ${token}`);
        });
        expect(adminSources.length).toBeGreaterThan(40);
        expect(hits).toEqual([]);
    });

    test('the admin root layout turns the shortcut system off before children mount', async () => {
        const layout = await read('apps/admin/src/routes/+layout.svelte');
        expect(layout).toMatch(/^ {4}shortcutStore\.disable\(\);$/m);
        expect(layout).not.toContain('platformStore');
    });

    test('a disabled store and action never listen or register', async () => {
        const store = await read('packages/ui/src/stores/shortcutStore.svelte.ts');
        expect(store).toContain("if (disabled) return '';");
        expect(store).toContain('if (disabled || listening ||');
        expect(await read('packages/ui/src/utils/shortcut.svelte.ts')).toContain(
            '!shortcutStore.enabled ||'
        );
    });

    test('the shared catalog keeps no admin-only section or chord group', async () => {
        expect(await read('packages/ui/src/shortcuts.ts')).not.toContain('sidebar:');
        const catalog = await read('packages/ui/src/shortcutCatalog.ts');
        expect(catalog).not.toContain("'admin'");
        expect(catalog).not.toContain('adminPage');
    });

    test('the public web app keeps its shortcut system', async () => {
        const layout = await read('apps/web/src/routes/+layout.svelte');
        expect(layout).toContain('ShortcutCatalogDialog');
        expect(layout).not.toContain('shortcutStore.disable');
    });
});
