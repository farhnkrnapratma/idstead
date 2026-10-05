import {
  activityCategories,
  activityLogSortFields,
  ACTIVITY_LOG_PAGE_SIZE
} from '../activityLog';

export class ActivityLogQueryError extends Error {}

export function activityLogQuery(params: URLSearchParams) {
  const category = params.get('category') || null;
  if (category && !activityCategories.some(item => item.value === category))
    throw new ActivityLogQueryError('Invalid category.');
  const query = (params.get('query') ?? '').trim();
  if (query.length > 250)
    throw new ActivityLogQueryError('Search is too long.');
  const direction = params.get('direction') ?? 'desc';
  if (direction !== 'asc' && direction !== 'desc')
    throw new ActivityLogQueryError('Invalid sort direction.');
  const sort = params.get('sort') ?? 'created_at';
  if (!activityLogSortFields.some(field => field.value === sort))
    throw new ActivityLogQueryError('Invalid sort field.');
  const date = (key: string) => {
    const value = params.get(key);
    if (!value) return null;
    if (
      !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)
      || !Number.isFinite(Date.parse(value))
    )
      throw new ActivityLogQueryError(`Invalid ${key} date.`);
    const normalized = new Date(value).toISOString();
    if (value.length === 10 && normalized.slice(0, 10) !== value)
      throw new ActivityLogQueryError(`Invalid ${key} date.`);
    return normalized;
  };
  const from = date('from');
  const to = date('to');
  if (from && to && from > to)
    throw new ActivityLogQueryError('Invalid date range.');
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (
      !/^\d+$/.test(raw)
      || !Number.isSafeInteger(value)
      || value < min
      || value > max
    )
      throw new ActivityLogQueryError(`Invalid ${key}.`);
    return value;
  };
  return {
    p_category: category,
    p_query: query || null,
    p_direction: direction,
    p_sort: sort,
    p_from: from,
    p_to: to,
    p_limit: integer('limit', ACTIVITY_LOG_PAGE_SIZE, 1, 200),
    p_offset: integer('offset', 0, 0, 2147483647)
  };
}
