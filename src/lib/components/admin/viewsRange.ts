export type ViewsRange = '1d' | '7d' | '30d';

export interface ViewsBucketRow {
  bucket: string;
  views: number;
}

export const VIEWS_RANGES: Record<
  ViewsRange,
  {label: string; bucket: 'hour' | 'day'; buckets: number; days: number}
> = {
  '1d': {label: '24h', bucket: 'hour', buckets: 24, days: 1},
  '7d': {label: '7d', bucket: 'day', buckets: 7, days: 7},
  '30d': {label: '30d', bucket: 'day', buckets: 30, days: 30}
};
