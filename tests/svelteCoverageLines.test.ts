// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { compileSvelteComponent, svelteSourceLines } from '../tooling/svelteCompile.ts';

const path = 'Example.svelte';
const source = [
    '<script>',
    '    let { show } = $props();',
    '</script>',
    '',
    '{#if show}',
    '    <p>Shown</p>',
    '{:else}',
    '    <p>Hidden</p>',
    '{/if}'
].join('\n');

test('compiled coverage maps back to the component source lines', () => {
    const compiled = compileSvelteComponent(path, source).code.split('\n');
    const hits = new Map(
        compiled.map((line, index) => [index + 1, line.includes('p_1') ? 0 : 1] as const)
    );

    const lines = svelteSourceLines(path, source, hits);

    expect(Math.max(...lines.keys())).toBeLessThanOrEqual(source.split('\n').length);
    expect(lines.get(6)).toBe(1);
    expect(lines.get(8)).toBe(0);
});

test('source lines without any compiled hit data stay out of the report', () => {
    expect(svelteSourceLines(path, source, new Map()).size).toBe(0);
});
