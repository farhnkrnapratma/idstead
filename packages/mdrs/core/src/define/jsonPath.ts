// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { DefineError } from './errors';

type JsonSegment = string | number;

const SEGMENT_RE = /\.?\[(\d+)\]|\.?\[("(?:[^"\\]|\\.)*")\]|\.([A-Za-z_$][\w$]*)/y;

function parseJsonPath(path: string): JsonSegment[] {
    if (!path.startsWith('.')) throw new DefineError(`get() path '${path}' must start with '.'`);
    if (path === '.')
        throw new DefineError(`get() path '${path}' must select a value, e.g. '.name'`);
    const segments: JsonSegment[] = [];
    SEGMENT_RE.lastIndex = 0;
    while (SEGMENT_RE.lastIndex < path.length) {
        const start = SEGMENT_RE.lastIndex;
        const match = SEGMENT_RE.exec(path);
        if (!match) throw new DefineError(`Invalid get() path '${path}' at position ${start}`);
        if (match[1] !== undefined) segments.push(Number(match[1]));
        else if (match[2] !== undefined) segments.push(JSON.parse(match[2]) as string);
        else segments.push(match[3]);
    }
    return segments;
}

export function selectJson(data: unknown, path: string): unknown {
    let current = data;
    for (const segment of parseJsonPath(path)) {
        if (typeof segment === 'number') {
            if (!Array.isArray(current))
                throw new DefineError(`Cannot index a non-array value with [${segment}]`);
            if (segment >= current.length)
                throw new DefineError(`Index [${segment}] is out of range`);
            current = current[segment];
            continue;
        }
        if (!current || typeof current !== 'object' || Array.isArray(current))
            throw new DefineError(`Cannot access property '${segment}' on a non-object value`);
        if (!Object.hasOwn(current, segment))
            throw new DefineError(`Property '${segment}' does not exist`);
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
}
