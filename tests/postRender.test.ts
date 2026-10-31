// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    RENDER_VERSION,
    unavailableResolvers,
    usesLiveData
} from '../packages/mdrs/core/src/index.ts';
import {
    buildPostRender,
    parsePostRender,
    postRenderPath
} from '../packages/lib/src/server/postRender.ts';

const postId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const operationId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('postRenderPath', () => {
    test('maps a stored markdown file to its render file', () => {
        expect(postRenderPath(`posts/${postId}/${operationId}.md`)).toBe(
            `posts/${postId}/${operationId}.render.json`
        );
    });

    test('rejects paths outside the operation layout', () => {
        expect(postRenderPath(null)).toBeNull();
        expect(postRenderPath(`posts/${postId}/notes.md`)).toBeNull();
        expect(postRenderPath(`posts/${postId}/${operationId}.txt`)).toBeNull();
        expect(postRenderPath(`../posts/${postId}/${operationId}.md`)).toBeNull();
    });
});

describe('usesLiveData', () => {
    test('is false without a :::define block, even when prose mentions api.v1', () => {
        expect(usesLiveData('Call api.v1.author to read the profile.')).toBe(false);
    });

    test('is true when the define block reads api.*', () => {
        expect(usesLiveData(':::define\nname: api.v1.author.profile.name\n:::\n\nHi ${name}')).toBe(
            true
        );
    });

    test('is true when the body interpolates api.* next to a define block', () => {
        expect(usesLiveData(':::define\nn: 2\n:::\n\n${api.v1.blog[0].title}')).toBe(true);
    });

    test('is false for define blocks with only local values', () => {
        expect(usesLiveData(':::define\nn: 2\n:::\n\nn is ${n}')).toBe(false);
    });
});

describe('buildPostRender and parsePostRender', () => {
    test('a static post renders once with headings and read time', async () => {
        const render = await buildPostRender(
            '## Setup\n\nSee [setup](#setup).',
            unavailableResolvers()
        );
        expect(render.version).toBe(RENDER_VERSION);
        expect(render.live).toBe(false);
        expect(render.html).toContain('id="mdrs-setup"');
        expect(render.html).toContain('href="#mdrs-setup"');
        expect(render.headings).toEqual([{ id: 'mdrs-setup', text: 'Setup', level: 2 }]);
        expect(render.readTime).toBe('1 min read');
        expect(parsePostRender(JSON.stringify(render))).toEqual(render);
    });

    test('a live-data post is flagged so pages render it per request', async () => {
        const render = await buildPostRender(
            ':::define\nname: api.v1.author.profile.name\n:::\n\nHi ${name}',
            unavailableResolvers()
        );
        expect(render.live).toBe(true);
    });

    test('renders from another engine version are ignored', async () => {
        const render = await buildPostRender('Text', unavailableResolvers());
        expect(parsePostRender(JSON.stringify({ ...render, version: RENDER_VERSION + 1 }))).toBe(
            null
        );
    });

    test('malformed render files are ignored', () => {
        expect(parsePostRender('not json')).toBeNull();
        expect(parsePostRender('null')).toBeNull();
        expect(
            parsePostRender(
                JSON.stringify({
                    version: RENDER_VERSION,
                    live: false,
                    html: '<p>x</p>',
                    readTime: '1 min read',
                    headings: [{ id: 1 }]
                })
            )
        ).toBeNull();
        expect(
            parsePostRender(
                JSON.stringify({
                    version: RENDER_VERSION,
                    live: 'no',
                    html: '<p>x</p>',
                    readTime: '1 min read',
                    headings: []
                })
            )
        ).toBeNull();
        expect(parsePostRender(' '.repeat(4_000_001))).toBeNull();
    });
});
