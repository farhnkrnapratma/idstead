import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderReadme } from '../packages/lib/src/server/api/root.ts';

const readme = readFileSync(new URL('../apps/api/src/README.md', import.meta.url), 'utf8');

describe('API README template', () => {
    test('fills every placeholder with the instance URLs', () => {
        const rendered = renderReadme(readme, {
            apiBase: 'https://api.example.com/',
            siteUrl: 'https://example.com/'
        });
        expect(rendered).not.toContain('{{');
        expect(rendered).toContain('curl https://api.example.com/v1/blog');
        expect(rendered).toContain('https://example.com/security');
    });

    test('names no instance domain itself', () => {
        expect(readme).toContain('{{API_BASE_URL}}');
        expect(readme).not.toMatch(/https:\/\/(?:api\.)?[a-z0-9-]+\.my\.id/);
    });
});
