import type {SupabaseClient} from '@supabase/supabase-js';
import {apiError} from './apiError';
import {blogAdmin} from './blogPostAuth';
import {ActivityInputError, activityJson, activityUuid} from './activityInput';
import {REPORT_REASON_IDS} from '$lib/reportReasons';

function option(
  params: URLSearchParams,
  key: string,
  allowed: string[],
  fallback: string
) {
  const value = params.get(key) ?? fallback;
  if (!allowed.includes(value)) throw new ActivityInputError(`Invalid ${key}.`);
  return value;
}
function timestamp(value: unknown) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    throw new ActivityInputError('Invalid date.');
  return new Date(value).toISOString();
}
export function workspaceOptions(params: URLSearchParams, now = new Date()) {
  const section = option(
    params,
    'section',
    [
      'overview',
      'summary',
      'reports',
      'feedback',
      'notifications',
      'report_events',
      'feedback_events',
      'notification_events',
      'comments'
    ],
    'overview'
  );
  const timeZone = params.get('timeZone') ?? 'UTC';
  try {
    new Intl.DateTimeFormat('en', {timeZone}).format(now);
  } catch {
    throw new ActivityInputError('Invalid time zone.');
  }
  const range = option(
    params,
    'range',
    ['1d', '7d', '30d', '90d', '1y', 'custom', 'all'],
    (
      [
        'reports',
        'report_events',
        'notifications',
        'notification_events',
        'comments',
        'summary'
      ].includes(section)
    ) ?
      'all'
    : '7d'
  );
  if (
    range === 'all'
    && ['overview', 'feedback', 'feedback_events'].includes(section)
  )
    throw new ActivityInputError(
      'Choose an analytics period of up to one year.'
    );
  let pageToken: {
    asOf: string;
    from: string | null;
    to: string;
    cursor: {n: number; t: string; id: string};
    signature: string;
  } | null = null;
  if (params.has('cursor')) {
    try {
      const token = params.get('cursor')!;
      if (token.length > 8000) throw new Error();
      pageToken = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(token), c => c.charCodeAt(0))
        )
      );
      if (!pageToken || !pageToken.to) throw new Error();
    } catch {
      throw new ActivityInputError('This page has expired. Refresh the list.');
    }
  }
  const to =
    params.has('to') ? timestamp(params.get('to'))
    : pageToken ? timestamp(pageToken.to)
    : now.toISOString();
  let start = new Date(to);
  if (range === '1y') start.setUTCFullYear(start.getUTCFullYear() - 1);
  else
    start = new Date(
      start.getTime() - Number(range.match(/^\d+/)?.[0] ?? 7) * 86400000
    );
  const from =
    range === 'all' ? null
    : params.has('from') ? timestamp(params.get('from'))
    : pageToken?.from ? timestamp(pageToken.from)
    : start.toISOString();
  if (range === 'custom' && (!params.has('from') || !params.has('to')))
    throw new ActivityInputError('Choose both dates.');
  const earliest = new Date(to);
  earliest.setUTCFullYear(earliest.getUTCFullYear() - 1);
  if (
    Date.parse(to) > now.getTime() + 60000
    || (from
      && (Date.parse(from) >= Date.parse(to)
        || Date.parse(from) < earliest.getTime()))
  )
    throw new ActivityInputError(
      'Choose a valid period of up to one year, ending no later than today.'
    );
  const query = params.get('query')?.trim() ?? '';
  if (query.length > 200) throw new ActivityInputError('Search is too long.');
  const reason = params.get('reason') ?? '';
  if (reason && !REPORT_REASON_IDS.has(reason))
    throw new ActivityInputError('Invalid report category.');
  const id = params.get('id') ?? '';
  if (id.length > 1500) throw new ActivityInputError('Invalid target.');
  if (['report_events', 'comments'].includes(section)) activityUuid(id);
  if (['feedback_events', 'notification_events'].includes(section) && !id)
    throw new ActivityInputError('A target is required.');
  const minimum = params.get('minimum') ?? '0';
  if (!/^\d{1,9}$/.test(minimum))
    throw new ActivityInputError('Invalid minimum responses.');
  const postId = params.get('postId') ?? '';
  if (postId) activityUuid(postId);
  const options = {
    range,
    query,
    reason,
    id,
    postId,
    from,
    to,
    timeZone,
    type: option(
      params,
      'type',
      [
        'all',
        'article',
        'legal',
        'comment_report',
        'comment_new',
        'helpful',
        'unhelpful',
        'contact_message',
        'feedback_report'
      ],
      'all'
    ),
    read: option(params, 'read', ['all', 'read', 'unread'], 'all'),
    vote: option(params, 'vote', ['all', 'yes', 'no'], 'all'),
    sort: option(
      params,
      'sort',
      ['date', 'total', 'helpful', 'type', 'page'],
      'date'
    ),
    direction: option(params, 'direction', ['asc', 'desc'], 'desc'),
    minimum: Number(minimum),
    notificationId:
      params.has('notificationId') ?
        activityUuid(params.get('notificationId'))
      : null,
    focus: params.has('focus') ? activityUuid(params.get('focus')) : null,
    meta: params.get('meta') !== 'false',
    events: params.get('history') !== 'false',
    limit: params.get('preview') === 'true' ? 5 : 20,
    asOf: now.toISOString(),
    cursor: null as null | {n: number; t: string; id: string}
  };
  if (params.has('cursor')) {
    try {
      const {asOf, cursor, signature} = pageToken!;
      if (
        signature !== workspaceSignature(section, options)
        || !cursor
        || !Number.isFinite(cursor.n)
        || typeof cursor.t !== 'string'
        || typeof cursor.id !== 'string'
        || cursor.id.length > 1500
        || cursor.t.length > 1000
      )
        throw new Error();
      options.asOf = timestamp(asOf);
      if (Date.parse(options.asOf) > now.getTime()) throw new Error();
      options.cursor = cursor;
    } catch {
      throw new ActivityInputError('This page has expired. Refresh the list.');
    }
  }
  return {section, options};
}
function workspaceSignature(section: string, options: Record<string, unknown>) {
  const {asOf, cursor, meta, ...filters} = options;
  void asOf;
  void cursor;
  void meta;
  return JSON.stringify([section, filters]);
}
export async function adminWorkspace({
  request,
  url,
  db
}: {
  request: Request;
  url: URL;
  db: SupabaseClient | null;
}) {
  if (!db)
    return apiError(
      503,
      'ADMIN_WORKSPACE_UNAVAILABLE',
      'Dashboard is temporarily unavailable.'
    );
  try {
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
      return apiError(
        auth.status,
        'ADMIN_WORKSPACE_AUTH_REQUIRED',
        auth.message
      );
    if (request.method === 'POST') {
      const body = await activityJson(request);
      if (body.action === 'delete_comment') {
        const result = await db.rpc('db_admin_delete_comment', {
          p_id: activityUuid(body.id)
        });
        if (result.error) throw result.error;
        return Response.json(result.data, {
          headers: {'Cache-Control': 'no-store'}
        });
      }

      if (
        !['read_group', 'delete_group'].includes(String(body.action))
        || typeof body.id !== 'string'
        || body.id.length > 1500
      )
        throw new ActivityInputError('Invalid notification action.');
      const asOf = timestamp(body.asOf);
      if (Date.parse(asOf) > Date.now())
        throw new ActivityInputError('Invalid snapshot.');
      const {options} = workspaceOptions(
        new URLSearchParams({
          section: 'notification_events',
          id: body.id,
          timeZone: String(body.timeZone ?? 'UTC')
        })
      );
      const result = await db.rpc('db_admin_notification_group_action', {
        p_id: body.id,
        p_as_of: asOf,
        p_tz: options.timeZone,
        p_delete: body.action === 'delete_group',
        p_from: body.from ? timestamp(body.from) : '-infinity',
        p_to: body.to ? timestamp(body.to) : 'infinity'
      });
      if (result.error) throw result.error;
      return Response.json(result.data, {
        headers: {'Cache-Control': 'no-store'}
      });
    }
    if (request.method !== 'GET')
      return apiError(
        405,
        'ADMIN_WORKSPACE_METHOD_INVALID',
        'Method not allowed.'
      );
    const {section, options} = workspaceOptions(url.searchParams);
    const result = await db.rpc('db_admin_workspace', {
      p_section: section,
      p_options: options
    });
    if (result.error) throw result.error;
    const data = result.data;
    if (data && typeof data === 'object')
      data.scope = {from: options.from, to: options.to};
    if (data?.nextCursor) {
      const encoded = new TextEncoder().encode(
        JSON.stringify({
          asOf: data.asOf,
          from: options.from,
          to: options.to,
          cursor: data.nextCursor,
          signature: workspaceSignature(section, options)
        })
      );
      data.nextCursor = btoa(
        Array.from(encoded, byte => String.fromCharCode(byte)).join('')
      );
    }
    return Response.json(data, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    if (error instanceof ActivityInputError)
      return apiError(error.status, 'ADMIN_WORKSPACE_INVALID', error.message);
    return apiError(
      503,
      'ADMIN_WORKSPACE_UNAVAILABLE',
      'Dashboard could not be loaded. Please try again.'
    );
  }
}
