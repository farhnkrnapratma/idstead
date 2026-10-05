export type AdminDateMode = 'absolute' | 'relative' | 'smart';
export type AdminDateFormat =
  | 'mon-d-y'
  | 'dd/mm/yyyy'
  | 'dd/mm/yy'
  | 'month-d-y'
  | 'wd-mon-d'
  | 'wd-mon-d-y'
  | 'iso';
export type AdminTimeFormat =
  | 'HH:mm'
  | 'H:mm'
  | 'hh:mm a'
  | 'h:mm a'
  | 'HH:mm:ss'
  | 'hh:mm:ss a'
  | 'h[:mm]a';

export interface AdminDisplayPrefs {
  mode: AdminDateMode;
  dateFormat: AdminDateFormat;
  timeFormat: AdminTimeFormat;
}

export const DEFAULT_ADMIN_DISPLAY: AdminDisplayPrefs = {
  mode: 'absolute',
  dateFormat: 'mon-d-y',
  timeFormat: 'HH:mm'
};

export const ADMIN_DATE_MODES: readonly {
  value: AdminDateMode;
  label: string;
}[] = [
  {value: 'absolute', label: 'Absolute'},
  {value: 'relative', label: 'Relative'},
  {value: 'smart', label: 'Smart'}
];

export const ADMIN_DATE_FORMATS: readonly AdminDateFormat[] = [
  'mon-d-y',
  'dd/mm/yyyy',
  'dd/mm/yy',
  'month-d-y',
  'wd-mon-d',
  'wd-mon-d-y',
  'iso'
];

export const ADMIN_TIME_FORMATS: readonly AdminTimeFormat[] = [
  'HH:mm',
  'H:mm',
  'hh:mm a',
  'h:mm a',
  'HH:mm:ss',
  'hh:mm:ss a',
  'h[:mm]a'
];

const SMART_RELATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsOf(
  value: Date,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions
) {
  const key = `${timeZone ?? ''}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {timeZone, ...options});
    formatters.set(key, formatter);
  }
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(value)) {
    parts[part.type] = part.value;
  }
  return parts;
}

export function formatAdminDate(
  input: string | Date,
  timeZone?: string,
  dateFormat: AdminDateFormat = DEFAULT_ADMIN_DISPLAY.dateFormat,
  axis = false
) {
  const value = new Date(input);
  if (isNaN(value.getTime())) return '';
  const named = partsOf(value, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const weekday = axis ? '' : `${named.weekday} `;
  switch (dateFormat) {
    case 'month-d-y': {
      const {month} = partsOf(value, timeZone, {month: 'long'});
      return `${month} ${named.day}, ${named.year}`;
    }
    case 'wd-mon-d':
      return `${weekday}${named.month} ${named.day}`;
    case 'wd-mon-d-y':
      return `${weekday}${named.month} ${named.day}, ${named.year}`;
    case 'dd/mm/yyyy':
    case 'dd/mm/yy':
    case 'iso': {
      const numeric = partsOf(value, timeZone, {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      if (dateFormat === 'iso')
        return `${numeric.year}-${numeric.month}-${numeric.day}`;
      const year =
        dateFormat === 'dd/mm/yy' ? numeric.year.slice(-2) : numeric.year;
      return `${numeric.day}/${numeric.month}/${year}`;
    }
    default:
      return `${named.month} ${named.day}, ${named.year}`;
  }
}

export function formatAdminTime(
  input: string | Date,
  timeZone?: string,
  timeFormat: AdminTimeFormat = DEFAULT_ADMIN_DISPLAY.timeFormat
) {
  const value = new Date(input);
  if (isNaN(value.getTime())) return '';
  const twelveHour = timeFormat.endsWith('a');
  const padHour = timeFormat.startsWith('HH') || timeFormat.startsWith('hh');
  const withSeconds = timeFormat.includes(':ss');
  const parts = partsOf(value, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: twelveHour ? 'h12' : 'h23'
  });
  const hour =
    padHour ? parts.hour.padStart(2, '0') : String(Number(parts.hour));
  if (timeFormat === 'h[:mm]a')
    return `${hour}${parts.minute === '00' ? '' : `:${parts.minute}`}${parts.dayPeriod.toLowerCase()}`;
  const clock = `${hour}:${parts.minute}${withSeconds ? `:${parts.second}` : ''}`;
  return twelveHour ? `${clock} ${parts.dayPeriod}` : clock;
}

export function formatAdminDateTime(
  input: string | Date,
  timeZone?: string,
  prefs: Pick<
    AdminDisplayPrefs,
    'dateFormat' | 'timeFormat'
  > = DEFAULT_ADMIN_DISPLAY
) {
  const date = formatAdminDate(input, timeZone, prefs.dateFormat);
  if (!date) return '';
  return `${date} ${formatAdminTime(input, timeZone, prefs.timeFormat)}`;
}

export function isRelativeTimestamp(
  input: string | Date,
  mode: AdminDateMode,
  now: Date = new Date()
) {
  if (mode === 'relative') return true;
  if (mode === 'absolute') return false;
  return now.getTime() - new Date(input).getTime() < SMART_RELATIVE_WINDOW_MS;
}

export function parseAdminDisplayPrefs(
  raw: string | null
): Partial<AdminDisplayPrefs> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const {mode, dateFormat, timeFormat} = parsed as Record<string, unknown>;
    const result: Partial<AdminDisplayPrefs> = {};
    if (ADMIN_DATE_MODES.some(item => item.value === mode))
      result.mode = mode as AdminDateMode;
    if (ADMIN_DATE_FORMATS.includes(dateFormat as AdminDateFormat))
      result.dateFormat = dateFormat as AdminDateFormat;
    if (ADMIN_TIME_FORMATS.includes(timeFormat as AdminTimeFormat))
      result.timeFormat = timeFormat as AdminTimeFormat;
    return result;
  } catch {
    return {};
  }
}
