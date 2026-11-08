// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { expect, test } from 'bun:test';
import { unavailableResolvers } from '@mdrs/core';
import { evaluateDefineBlock } from '../packages/mdrs/core/src/define/block.ts';

test('reports blocks that do not parse', async () => {
    const { errors } = await evaluateDefineBlock('a: (', unavailableResolvers());
    expect(errors.length).toBeGreaterThan(0);
});

test('reports reserved variable names and repeated keys without evaluating them', async () => {
    const reserved = await evaluateDefineBlock('class: 1', unavailableResolvers());
    expect(reserved.errors[0]?.message).toContain('not a valid variable name');
    expect(reserved.scope.has('class')).toBe(false);

    const repeated = await evaluateDefineBlock('x: 1\nx: 2', unavailableResolvers());
    expect(repeated.errors.map(error => error.message)).toContain("'x' is already defined");
    expect(repeated.scope.get('x')).toBeDefined();
});
