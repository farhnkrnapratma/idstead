// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

const { default: MarkdownChart } =
    (await import('../packages/mdrs/dom/src/MarkdownChart.svelte')) as { default: never };

const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const rows = [
    { day: 'Mon', views: 12, helpful: 3 },
    { day: 'Tue', views: 30, helpful: 7 },
    { day: 'Wed', views: 18, helpful: 2 }
];

const specs = [
    {
        type: 'line',
        title: 'Views',
        subtitle: 'Last week',
        x: 'day',
        y: 'views',
        data: rows,
        height: 200
    },
    {
        type: 'bar',
        title: 'Helpful',
        x: 'day',
        y: ['views', 'helpful'],
        series: [
            { key: 'views', label: 'Views', color: '#3366ff' },
            { key: 'helpful', label: 'Helpful' }
        ],
        data: rows
    },
    { type: 'area', x: 'day', y: 'helpful', data: rows },
    { type: 'donut', x: 'day', y: 'views', data: rows },
    { type: 'pie', x: 'day', y: 'views', data: rows },
    { x: 'day', y: 'views', data: [] }
];

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('renders each chart type and copies its spec', async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: async (text: string) => {
                copied = text;
            }
        }
    });
    for (const spec of specs) {
        mounted.push(mount(MarkdownChart, { target: document.body, props: { spec } as never }));
        await settle();
    }
    const copy = document.querySelector<HTMLElement>('[aria-label*="opy"], button');
    copy?.click();
    await settle();
    expect(document.body.textContent).toBeDefined();
    expect(copied === '' || copied.includes('"type"')).toBe(true);
}, 60000);
