import {mount} from 'svelte';
import {load as yamlLoad} from 'js-yaml';
import MarkdownChart from '../components/markdown/MarkdownChart.svelte';

export interface ChartSpec {
  type?: 'line' | 'bar' | 'area' | 'donut' | 'pie';
  title?: string;
  subtitle?: string;
  x?: string;
  y?: string | string[];
  series?: Array<{key: string; label?: string; color?: string}>;
  data?: Array<Record<string, any>>;
  height?: number;
}

export function enhanceMarkdownCharts(container: HTMLElement = document.body) {
  const chartContainers = container.querySelectorAll<HTMLElement>(
    '.markdown-chart-container:not([data-chart-initialized])'
  );

  chartContainers.forEach(chartEl => {
    chartEl.setAttribute('data-chart-initialized', 'true');
    const rawContent = decodeURIComponent(
      chartEl.getAttribute('data-chart-content') || ''
    ).trim();

    let spec: ChartSpec;
    try {
      if (rawContent.startsWith('{')) {
        spec = JSON.parse(rawContent);
      } else {
        spec = yamlLoad(rawContent) as ChartSpec;
      }
    } catch (err) {
      chartEl.innerHTML = `<div class="rounded-md border border-danger/30 bg-danger-subtle/20 p-3 text-xs text-danger font-mono">Invalid chart specification: ${(err as Error).message}</div>`;
      return;
    }

    if (!spec || typeof spec !== 'object') {
      chartEl.innerHTML = `<div class="rounded-md border border-danger/30 bg-danger-subtle/20 p-3 text-xs text-danger font-mono">Chart data is empty or malformed.</div>`;
      return;
    }

    chartEl.innerHTML = '';
    mount(MarkdownChart, {target: chartEl, props: {spec}});
  });
}
