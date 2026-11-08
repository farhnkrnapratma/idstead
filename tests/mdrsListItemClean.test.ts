// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { expect, test } from 'bun:test';
import { cleanListItemHtml } from '../packages/mdrs/core/src/render/tasks.ts';

test('unwraps a single paragraph in tight lists and keeps loose or nested paragraphs', () => {
    expect(cleanListItemHtml('  <p>Hi</p>  ', false)).toBe('Hi');
    expect(cleanListItemHtml('<p>Hi</p>', true)).toBe('<p>Hi</p>');
    expect(cleanListItemHtml('<p>a</p><p>b</p>', false)).toBe('<p>a</p><p>b</p>');
});
