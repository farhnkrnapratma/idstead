interface RelativeUnit {
  unit:
    'decade' | 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';
  seconds: number;
}

const RELATIVE_UNITS: RelativeUnit[] = [
  {unit: 'decade', seconds: 315576000},
  {unit: 'year', seconds: 31557600},
  {unit: 'month', seconds: 2629800},
  {unit: 'week', seconds: 604800},
  {unit: 'day', seconds: 86400},
  {unit: 'hour', seconds: 3600},
  {unit: 'minute', seconds: 60},
  {unit: 'second', seconds: 1}
];

function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const date = typeof input === 'string' ? new Date(input) : input;
  return isNaN(date.getTime()) ? null : date;
}

function matchRelativeUnit(diffSeconds: number): RelativeUnit {
  for (const entry of RELATIVE_UNITS) {
    if (diffSeconds >= entry.seconds) return entry;
  }
  return RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
}

export function formatRelativeTime(
  input: string | Date | null | undefined,
  now: Date = new Date()
): string {
  const date = toDate(input);
  if (!date) return '';

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 1) {
    const ms = Math.max(1, diffMs);
    return `${ms} millisecond${ms === 1 ? '' : 's'} ago`;
  }

  const {unit, seconds} = matchRelativeUnit(diffSeconds);
  const value = Math.max(1, Math.floor(diffSeconds / seconds));

  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

export function getRelativeTimeNextUpdateMs(
  input: string | Date | null | undefined,
  now: Date = new Date()
): number {
  const date = toDate(input);
  if (!date) return 60000;

  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const {seconds} = matchRelativeUnit(diffSeconds);
  const value = Math.floor(diffSeconds / seconds);
  const nextThresholdSeconds = (value + 1) * seconds;
  const msUntilNext =
    (nextThresholdSeconds - diffSeconds) * 1000 - (diffMs % 1000);

  return Math.max(250, msUntilNext);
}

export function formatReadTime(readTimeInput?: string | number | null): string {
  if (!readTimeInput && readTimeInput !== 0) return '1 min read';
  let minutes = 1;
  if (typeof readTimeInput === 'number') {
    minutes = Math.max(1, Math.round(readTimeInput));
  } else {
    const matched = readTimeInput.match(/\d+/);
    if (matched) {
      minutes = Math.max(1, parseInt(matched[0], 10));
    }
  }
  return minutes > 1 ? `${minutes} mins read` : `${minutes} min read`;
}

export function formatCommentCount(count?: number | null): string {
  const n = count || 0;
  return n === 1 ? `${n} comment` : `${n} comments`;
}

export function formatViewCount(count?: number | null): string {
  const n = count || 0;
  return n === 1 ? `${n} view` : `${n} views`;
}

export function formatAbsoluteDate(
  input: string | Date | null | undefined
): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(date.getTime())) return '';
  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(isCurrentYear ? {} : {year: 'numeric'})
  });
}

export function decodeHtmlEntities(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/g, '&')
    .replace(/&#x26;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&#60;/g, '<')
    .replace(/&#x3C;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#62;/g, '>')
    .replace(/&#x3E;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&ndash;/gi, '-')
    .replace(/&#8211;/g, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&#8212;/g, '-');
}
