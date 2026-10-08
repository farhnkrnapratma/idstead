import type {SupabaseClient} from '@supabase/supabase-js';
import {apiError} from './apiError';
import {blogAdmin} from './blogPostAuth';
import {ActivityInputError, activityJson, activityUuid} from './activityInput';
import {REPORT_REASON_IDS} from '#lib/reportReasons.ts';
import {ADMIN_WORKSPACE_PAGE_SIZE} from '#lib/adminWorkspace.ts';

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
      'calendar',
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
  const to = params.has('to') ? timestamp(params.get('to')) : now.toISOString();
  let start = new Date(to);
  if (range === '1y') start.setUTCFullYear(start.getUTCFullYear() - 1);
  else
    start = new Date(
      start.getTime() - Number(range.match(/^\d+/)?.[0] ?? 7) * 86400000
    );
  const from =
    range === 'all' ? null
    : params.has('from') ? timestamp(params.get('from'))
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
  const page = params.get('page') ?? '1';
  if (!/^[1-9]\d{0,3}$/.test(page))
    throw new ActivityInputError('Invalid page.');
  const asOf =
    params.has('asOf') ? timestamp(params.get('asOf')) : now.toISOString();
  if (Date.parse(asOf) > now.getTime() + 60000)
    throw new ActivityInputError('Invalid snapshot.');
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
      ['date', 'total', 'helpful', 'type', 'page', 'reason', 'details'],
      'date'
    ),
    direction: option(params, 'direction', ['asc', 'desc'], 'desc'),
    notificationId:
      params.has('notificationId') ?
        activityUuid(params.get('notificationId'))
      : null,
    focus: params.has('focus') ? activityUuid(params.get('focus')) : null,
    meta: params.get('meta') !== 'false',
    events: params.get('history') !== 'false',
    limit: params.get('preview') === 'true' ? 5 : ADMIN_WORKSPACE_PAGE_SIZE,
    page: Number(page),
    asOf
  };
  return {section, options};
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
