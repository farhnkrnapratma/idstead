import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

const root = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
    return readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
        .filter(entry => entry.isFile() && /\.(svelte|ts|html)$/.test(entry.name))
        .map(entry => join(entry.parentPath, entry.name));
}

const adminSources = [
    ...sources('apps/admin/src'),
    ...sources('packages/lib/src/components/admin')
];
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Admin keyboard shortcuts', () => {
    test('admin code never registers, renders or advertises shortcuts', () => {
        const forbidden = [
            'use:shortcut',
            'ShortcutCatalogDialog',
            'ShortcutModeIndicator',
            'ShortcutBadge',
            'installSubmitShortcut',
            'aria-keyshortcuts',
            "group: 'sidebar'"
        ];
        const hits = adminSources.flatMap(file => {
            const text = readFileSync(file, 'utf8');
            return forbidden
                .filter(token => text.includes(token))
                .map(token => `${file}: ${token}`);
        });
        expect(adminSources.length).toBeGreaterThan(40);
        expect(hits).toEqual([]);
    });

    test('the admin root layout turns the shortcut system off before children mount', () => {
        const layout = read('apps/admin/src/routes/+layout.svelte');
        expect(layout).toMatch(/^ {4}shortcutStore\.disable\(\);$/m);
        expect(layout).not.toContain('platformStore');
    });

    test('a disabled store and action never listen or register', () => {
        const store = read('packages/lib/src/stores/shortcutStore.svelte.ts');
        expect(store).toContain("if (disabled) return '';");
        expect(store).toContain('if (disabled || listening ||');
        expect(read('packages/lib/src/utils/shortcut.svelte.ts')).toContain(
            '!shortcutStore.enabled ||'
        );
    });

    test('the shared catalog keeps no admin-only section or chord group', () => {
        expect(read('packages/lib/src/shortcuts.ts')).not.toContain('sidebar:');
        const catalog = read('packages/lib/src/shortcutCatalog.ts');
        expect(catalog).not.toContain("'admin'");
        expect(catalog).not.toContain('adminPage');
    });

    test('the public web app keeps its shortcut system', () => {
        const layout = read('apps/web/src/routes/+layout.svelte');
        expect(layout).toContain('ShortcutCatalogDialog');
        expect(layout).not.toContain('shortcutStore.disable');
    });
});
