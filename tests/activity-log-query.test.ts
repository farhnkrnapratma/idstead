import {expect, test} from 'bun:test';
import {activityLogQuery} from '../src/lib/server/activityLogQuery';

test('log query validates filters, ranges and finite integer pagination', () => {
  expect(activityLogQuery(new URLSearchParams())).toMatchObject({
    p_limit: 10,
    p_offset: 0,
    p_direction: 'desc',
    p_sort: 'created_at'
  });
  expect(
    activityLogQuery(
      new URLSearchParams(
        'category=auth&query=Login&direction=asc&sort=actor&offset=10'
      )
    )
  ).toMatchObject({
    p_category: 'auth',
    p_query: 'Login',
    p_direction: 'asc',
    p_sort: 'actor',
    p_offset: 10
  });
  for (const query of [
    'category=unknown',
    'direction=sideways',
    'sort=unknown',
    'sort=actor%3Bdrop%20table%20db_activity_log',
    'sort=',
    'limit=NaN',
    'limit=0',
    'limit=201',
    'offset=-1',
    'offset=1.5',
    'offset=Infinity',
    'from=invalid',
    'from=2026-09-28&to=2026-09-27',
    `query=${'a'.repeat(251)}`
  ])
    expect(() => activityLogQuery(new URLSearchParams(query))).toThrow();
});
