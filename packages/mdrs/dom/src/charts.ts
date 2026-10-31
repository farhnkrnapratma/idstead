// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { mount } from 'svelte';
import { load as yamlLoad } from 'js-yaml';
import MarkdownChart from './MarkdownChart.svelte';

export interface ChartSpec {
    type?: 'line' | 'bar' | 'area' | 'donut' | 'pie';
    title?: string;
    subtitle?: string;
    x?: string;
    y?: string | string[];
    series?: Array<{ key: string; label?: string; color?: string }>;
    data?: Array<Record<string, any>>;
    height?: number;
}

function showChartError(chartEl: HTMLElement, message: string) {
    const box = document.createElement('div');
    box.className = 'mdrs-chart-error';
    box.textContent = message;
    chartEl.replaceChildren(box);
}

export function enhanceMarkdownCharts(container: HTMLElement = document.body) {
    const chartContainers = container.querySelectorAll<HTMLElement>(
        '.mdrs-chart:not([data-mdrs-enhanced])'
    );

    chartContainers.forEach(chartEl => {
        chartEl.setAttribute('data-mdrs-enhanced', 'true');
        const rawContent = decodeURIComponent(chartEl.getAttribute('data-mdrs-chart') || '').trim();

        let spec: ChartSpec;
        try {
            if (rawContent.startsWith('{')) {
                spec = JSON.parse(rawContent);
            } else {
                spec = yamlLoad(rawContent) as ChartSpec;
            }
        } catch (err) {
            showChartError(chartEl, `Invalid chart specification: ${(err as Error).message}`);
            return;
        }

        if (!spec || typeof spec !== 'object') {
            showChartError(chartEl, 'Chart data is empty or malformed.');
            return;
        }

        chartEl.innerHTML = '';
        mount(MarkdownChart, { target: chartEl, props: { spec } });
    });
}
