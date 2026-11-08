// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { expect, test } from 'bun:test';
import { extractHeadings, injectHeadingIds } from '../packages/mdrs/core/src/render/headings.ts';

test('keeps repeated headings unique and leaves hidden headings out of the outline', () => {
    const injected = injectHeadingIds('<h2>Intro</h2><h2>Intro</h2>');
    expect(injected).toContain('id="mdrs-intro"');
    expect(injected).toContain('id="mdrs-intro-1"');

    const outline = extractHeadings(
        '<h2 id="visible">Visible</h2><h2 id="hidden" aria-hidden="true">Hidden</h2>'
    );
    expect(outline.map(item => item.id)).toEqual(['visible']);
});
