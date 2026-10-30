import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(path, 'utf8');

function svelteFiles(dir: string): string[] {
    return [...new Bun.Glob('**/*.svelte').scanSync({ cwd: join(root, dir), absolute: true })];
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
        expect(read(join(root, 'apps/web/src/lib/components/SiteNav.svelte'))).not.toContain(
            'SkipLink'
        );
    });

    test('the root web layout renders the only skip link for every web page', () => {
        const layout = read(join(root, 'apps/web/src/routes/+layout.svelte'));
        expect((layout.match(/<SkipLink\b/g) ?? []).length).toBe(1);
        const pages = [
            ...svelteFiles('apps/web/src/routes'),
            join(root, 'apps/web/src/lib/components/LegalPageLayout.svelte')
        ].filter(path => !path.endsWith('routes/+layout.svelte'));
        for (const path of pages)
            expect({ path: relative(root, path), count: skipLinksIn(path) }).toEqual({
                path: relative(root, path),
                count: 0
            });
    });

    test('every admin page with a main target renders exactly one skip link', () => {
        const counts = svelteFiles('apps/admin/src/routes')
            .filter(path => /\+(page|error)\.svelte$/.test(path))
            .filter(path => read(path).includes('id="main"'))
            .map(path => [relative(root, path), skipLinksIn(path)] as const)
            .filter(([path]) => !redirectOnlyPages.includes(path));

        expect(counts.length).toBeGreaterThan(0);
        for (const [path, count] of counts) expect({ path, count }).toEqual({ path, count: 1 });
    });
});
