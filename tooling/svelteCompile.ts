// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { decode } from '@jridgewell/sourcemap-codec';
import { compile } from 'svelte/compiler';

export function compileSvelteComponent(path: string, source: string) {
    return compile(source, { filename: path, generate: 'client', dev: false }).js;
}

export function svelteSourceLines(
    path: string,
    source: string,
    compiledLines: Map<number, number>
): Map<number, number> {
    const { map } = compileSvelteComponent(path, source);
    const lines = new Map<number, number>();
    decode(map.mappings).forEach((segments, index) => {
        const hits = compiledLines.get(index + 1);
        if (hits === undefined) return;
        for (const segment of segments) {
            if (segment.length < 4) continue;
            const line = (segment[2] ?? 0) + 1;
            lines.set(line, Math.max(lines.get(line) ?? 0, hits));
        }
    });
    return lines;
}
