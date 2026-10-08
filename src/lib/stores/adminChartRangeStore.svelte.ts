import {browser} from '$app/env';
import type {ViewsRange} from '#lib/components/admin/viewsRange.ts';
import {DEFAULT_CHART_RANGE} from '#lib/adminSettings.ts';

const STORAGE_KEY = 'admin-chart-range';

function isViewsRange(value: string | null): value is ViewsRange {
  return (
    value === '1d'
    || value === '7d'
    || value === '30d'
    || value === '90d'
    || value === '1y'
  );
}

function createAdminChartRangeStore() {
  let range = $state<ViewsRange>(DEFAULT_CHART_RANGE);
  let initialized = false;

  function init() {
    if (!browser || initialized) return;
    initialized = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isViewsRange(saved)) range = saved;
    } catch {}
  }

  function set(next: ViewsRange) {
    range = next;
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return {
    get current() {
      return range;
    },
    set,
    init
  };
}

export const adminChartRangeStore = createAdminChartRangeStore();
