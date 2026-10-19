import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(path, 'utf8');

function svelteFiles(dir: string): string[] {
    return readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.svelte'))
        .map(entry => join(entry.parentPath, entry.name));
}

const redirectOnlyPages = ['apps/admin/src/routes/(admin)/new/+page.svelte'];
const components = svelteFiles('packages/lib/src');
const renderers = components.filter(path => /<SkipLink\b/.test(read(path)));

function skipLinksIn(path: string, seen = new Set<string>()): number {
    if (seen.has(path)) return 0;
    seen.add(path);
    const source = read(path);
    let total = (source.match(/<SkipLink\b/g) ?? []).length;
    for (const component of renderers) {
        if (component === path) continue;
        const name = component.split('/').pop()!.replace('.svelte', '');
        const uses = (source.match(new RegExp(`<${name}\\b`, 'g')) ?? []).length;
        total += uses * skipLinksIn(component, new Set(seen));
    }
    return total;
}

describe('Skip link', () => {
    test('shared navigation never renders its own skip link', () => {
        expect(read(join(root, 'apps/web/src/lib/components/TopNav.svelte'))).not.toContain(
            'SkipLink'
        );
    });

    test('the (site) layout renders the only skip link for its pages', () => {
        const layout = read(join(root, 'apps/web/src/routes/(site)/+layout.svelte'));
        expect((layout.match(/<SkipLink\b/g) ?? []).length).toBe(1);
        for (const path of svelteFiles('apps/web/src/routes/(site)').filter(path =>
            path.endsWith('+page.svelte')
        ))
            expect({
                path: relative(root, path),
                skipLink: read(path).includes('<SkipLink')
            }).toEqual({ path: relative(root, path), skipLink: false });
    });

    test('every page with a main target renders exactly one skip link', () => {
        const pages = [
            ...svelteFiles('apps/web/src/routes'),
            ...svelteFiles('apps/admin/src/routes'),
            join(root, 'apps/web/src/lib/components/LegalPageLayout.svelte')
        ].filter(path => /\+(page|error)\.svelte$|LegalPageLayout\.svelte$/.test(path));

        const counts = pages
            .filter(path => read(path).includes('id="main"'))
            .map(path => [relative(root, path), skipLinksIn(path)] as const)
            .filter(([path]) => !redirectOnlyPages.includes(path));

        expect(counts.length).toBeGreaterThan(0);
        for (const [path, count] of counts) expect({ path, count }).toEqual({ path, count: 1 });
    });
});
