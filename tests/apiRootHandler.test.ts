// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { getRoot } from '../packages/lib/src/server/api/root.ts';

const ctxFor = (search: string, siteUrl: () => Promise<string>) => {
    const url = new URL(`https://api.example.com/v1${search}`);
    return {
        url,
        request: new Request(url),
        repos: { author: { siteUrl } },
        fetch: globalThis.fetch
    } as never;
};

const readme = 'Base {{API_BASE_URL}} for {{SITE_URL}}';

test('serves the index as JSON on request and the rendered README by default', async () => {
    const json = await getRoot(
        ctxFor('?output=json', async () => 'https://example.com/'),
        readme
    );
    expect(json.headers.get('content-type')).toContain('application/json');

    const markdown = await getRoot(
        ctxFor('', async () => 'https://example.com/'),
        readme
    );
    expect(await markdown.text()).toBe('Base https://api.example.com for https://example.com');
});

test('renders the README without a site URL when the profile cannot be read', async () => {
    const response = await getRoot(
        ctxFor('', async () => {
            throw new Error('db');
        }),
        readme
    );
    expect(await response.text()).toContain('Base https://api.example.com for ');
});
