import {
  parseAdminDisplayPrefs,
  type AdminDisplayPrefs
} from './adminDateFormat';
import type {ViewsRange} from './components/admin/viewsRange';

export const VIEWS_RANGE_VALUES: readonly ViewsRange[] = [
  '1d',
  '7d',
  '30d',
  '90d',
  '1y'
];

export const DEFAULT_CHART_RANGE: ViewsRange = '30d';

export interface AdminSettings {
  display?: Partial<AdminDisplayPrefs>;
  chartRange?: ViewsRange;
}

export function parseAdminSettings(raw: unknown): AdminSettings {
  if (typeof raw !== 'object' || raw === null) return {};
  const {display, chartRange} = raw as Record<string, unknown>;
  const result: AdminSettings = {};
  const parsedDisplay = parseAdminDisplayPrefs(JSON.stringify(display ?? null));
  if (Object.keys(parsedDisplay).length) result.display = parsedDisplay;
  if (VIEWS_RANGE_VALUES.includes(chartRange as ViewsRange))
    result.chartRange = chartRange as ViewsRange;
  return result;
}
