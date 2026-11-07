// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { afterEach, expect, test } from 'bun:test';
import { enhanceMarkdownCharts } from '../packages/mdrs/dom/src/charts.ts';

afterEach(() => {
    document.body.innerHTML = '';
});

function chart(payload: string) {
    const element = document.createElement('div');
    element.className = 'mdrs-chart';
    element.setAttribute('data-mdrs-chart', encodeURIComponent(payload));
    document.body.appendChild(element);
    return element;
}

test('shows errors for malformed chart data and mounts valid specs', () => {
    const broken = chart('{not json');
    const empty = chart('');
    const scalar = chart('42');
    const valid = chart('{"type":"bar","x":"day","y":"views","data":[{"day":"Mon","views":3}]}');
    enhanceMarkdownCharts(document.body);
    expect(broken.textContent).toContain('Invalid chart specification');
    expect(empty.textContent).toContain('Invalid chart specification');
    expect(scalar.textContent).toContain('Chart data is empty or malformed.');
    expect(valid.getAttribute('data-mdrs-enhanced')).toBe('true');
});
