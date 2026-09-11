import {afterAll, beforeAll, expect, test} from 'bun:test';
import {activityDb, activityMigrationSql} from './helpers/adminActivityDb';
const db = await activityDb();
const post = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';
const hash = 'a'.repeat(64);
const legacy = '33333333-3333-4333-8333-333333333333';
async function value(sql: string, params: unknown[] = []) {
  const {rows} = await db.query<{value: any}>(
    `select (${sql.includes(' from ') ? 'select ' : ''}${sql}) as value`,
    params
  );
  return rows[0].value;
}
async function vote(
  id = crypto.randomUUID(),
  type = 'article',
  target = post,
  choice = 'yes',
  ip = hash
) {
  return value('db_record_page_feedback($1,$2,$3,$4,$5)', [
    id,
    type,
    target,
    choice,
    ip
  ]);
}
beforeAll(async () => {
  await db.exec(`insert into db_posts(id,title,slug,helpful_yes) values ('${post}','Article','article',1);
    insert into db_legals(slug,title,content) values ('privacy','Privacy','Legal content'),('terms','Terms','Terms content'),('hidden','Hidden','No public route');
    insert into db_post_feedback(id,post_id,vote,ip_hash,created_at) values ('${legacy}','${post}','yes','${'f'.repeat(64)}','2026-01-01T00:00:00Z');
    delete from db_admin_notifications where source_id='${legacy}';`);
  await db.exec(await activityMigrationSql());
}, 30000);
afterAll(() => db.close());

test('backfill keeps source IDs/time, counters and permanently deleted notifications', async () => {
  expect(
    await value(
      `count(*)::int from db_feedback_events where id='${legacy}' and legacy_id='${legacy}' and created_at='2026-01-01T00:00:00Z'`
    )
  ).toBe(1);
  expect(await value(`helpful_yes from db_posts where id='${post}'`)).toBe(1);
  expect(
    await value(
      `count(*)::int from db_admin_notifications where source_id='${legacy}'`
    )
  ).toBe(0);
});
test('article operation is atomic, idempotent and rate limited across choices', async () => {
  const operation = crypto.randomUUID();
  expect(await vote(operation)).toEqual({recorded: true, replayed: false});
  expect(await vote(operation)).toEqual({recorded: true, replayed: true});
  expect(await vote(operation, 'article', post, 'yes', 'e'.repeat(64))).toEqual(
    {recorded: true, replayed: true}
  );
  expect(await vote(crypto.randomUUID(), 'article', post, 'no')).toEqual({
    recorded: false,
    replayed: false
  });
  await expect(vote(operation, 'article', post, 'no')).rejects.toThrow(
    'FEEDBACK_OPERATION_CONFLICT'
  );
  await expect(vote(operation, 'legal', 'privacy')).rejects.toThrow(
    'FEEDBACK_OPERATION_CONFLICT'
  );
  expect(await value('count(*)::int from db_feedback_events')).toBe(2);
  expect(await value('count(*)::int from db_post_feedback')).toBe(2);
  expect(await value('count(*)::int from db_admin_notifications')).toBe(1);
  expect(await value(`helpful_yes from db_posts where id='${post}'`)).toBe(2);
});
test('legal votes are independent by page and create exactly one notification each', async () => {
  expect(
    (await vote(crypto.randomUUID(), 'legal', 'privacy', 'no')).recorded
  ).toBe(true);
  expect((await vote(crypto.randomUUID(), 'legal', 'terms')).recorded).toBe(
    true
  );
  expect((await vote(crypto.randomUUID(), 'legal', 'privacy')).recorded).toBe(
    false
  );
  expect(
    await value(
      "count(*)::int from db_admin_notifications where kind='legal_feedback'"
    )
  ).toBe(2);
  const stats = await value('db_admin_dashboard()');
  expect(stats.helpful).toBe(3);
  expect(stats.unhelpful).toBe(1);
  await expect(vote(crypto.randomUUID(), 'legal', 'hidden')).rejects.toThrow(
    'FEEDBACK_TARGET_NOT_FOUND'
  );
});
test('rolling 24 hours uses the database clock and persists limited decisions', async () => {
  const limited = crypto.randomUUID();
  await db.exec(
    `update db_feedback_events set created_at=clock_timestamp()-interval '23 hours 59 minutes' where ip_hash='${hash}' and target_type='article'`
  );
  expect((await vote(limited)).recorded).toBe(false);
  await db.exec(
    `update db_feedback_events set created_at=clock_timestamp()-interval '24 hours' where ip_hash='${hash}' and target_type='article'`
  );
  expect(await vote(limited)).toEqual({recorded: false, replayed: true});
  expect((await vote()).recorded).toBe(true);
  expect(await value(`helpful_yes from db_posts where id='${post}'`)).toBe(3);
});
test('legacy RPC and inserts mirror events without duplicated counters or notifications', async () => {
  const legacyHash = 'b'.repeat(64);
  expect(
    await value('record_post_feedback($1,$2,$3)', [post, 'no', legacyHash])
  ).toBe(true);
  expect(
    await value('record_post_feedback($1,$2,$3)', [post, 'yes', legacyHash])
  ).toBe(false);
  expect(
    (await vote(crypto.randomUUID(), 'article', post, 'yes', legacyHash))
      .recorded
  ).toBe(false);
  const direct = crypto.randomUUID();
  await db.query(
    'insert into db_post_feedback(id,post_id,vote,ip_hash) values ($1,$2,$3,$4)',
    [direct, post, 'yes', 'c'.repeat(64)]
  );
  expect(
    await value('count(*)::int from db_feedback_events where id=$1', [direct])
  ).toBe(1);
  expect(
    await value(
      'count(*)::int from db_admin_notifications where source_id=$1',
      [direct]
    )
  ).toBe(1);
  expect(await value(`helpful_no from db_posts where id='${post}'`)).toBe(1);
});
test('notification failure rolls back operation, event, legacy mirror and counter', async () => {
  const before = await value('db_admin_dashboard()');
  await db.exec(`create function fail_feedback() returns trigger language plpgsql as $$ begin raise exception 'test notification failure'; end $$;
    create trigger fail_feedback before insert on db_admin_notifications for each row execute function fail_feedback();`);
  const operation = crypto.randomUUID();
  await expect(
    vote(operation, 'article', post, 'yes', 'd'.repeat(64))
  ).rejects.toThrow('test notification failure');
  expect(
    await value(
      'count(*)::int from db_feedback_operations where operation_id=$1',
      [operation]
    )
  ).toBe(0);
  expect(await value('db_admin_dashboard()')).toEqual(before);
  await db.exec('drop trigger fail_feedback on db_admin_notifications');
  expect(
    (await vote(operation, 'article', post, 'yes', 'd'.repeat(64))).recorded
  ).toBe(true);
});
test('clear-all snapshots every notification and lost-response retry preserves new events', async () => {
  await db.exec(
    "insert into db_admin_notifications(kind,read_at) select 'contact_message', case when i%2=0 then now() end from generate_series(1,65) i"
  );
  const operation = crypto.randomUUID();
  const prepared = await value('db_admin_clear_notifications($1,$2,false)', [
    actor,
    operation
  ]);
  expect(prepared.count).toBeGreaterThan(65);
  expect(
    await value('db_admin_clear_notifications($1,$2,false)', [actor, operation])
  ).toEqual(prepared);
  const before = await value('db_admin_dashboard()');
  await db.exec(
    "insert into db_admin_notifications(kind) values ('feedback_report')"
  );
  const confirmed = await value('db_admin_clear_notifications($1,$2,true)', [
    actor,
    operation
  ]);
  expect(confirmed.deletedCount).toBe(prepared.count);
  await db.exec(
    "insert into db_admin_notifications(kind) values ('contact_message')"
  );
  expect(
    await value('db_admin_clear_notifications($1,$2,true)', [actor, operation])
  ).toEqual(confirmed);
  expect(await value('count(*)::int from db_admin_notifications')).toBe(2);
  expect(await value('db_admin_dashboard()')).toEqual(before);
  await expect(
    value('db_admin_clear_notifications($1,$2,true)', [
      crypto.randomUUID(),
      operation
    ])
  ).rejects.toThrow('CLEAR_OPERATION_CONFLICT');
});
test('inbox query/filter/sort cover all items with stable cursor pagination', async () => {
  await db.exec(
    `insert into db_admin_notifications(kind,meta,created_at) select 'comment_new', jsonb_build_object('author','Reader '||i), '2026-01-01T00:00:00Z'::timestamptz from generate_series(1,65) i`
  );
  const found = await value(
    "db_admin_inbox('Reader 65','comment_new','unread','date','desc',null)"
  );
  expect(found.items).toHaveLength(1);
  expect(found.unreadCount).toBeGreaterThan(65);
  for (const sort of ['date', 'type', 'page'])
    for (const direction of ['asc', 'desc']) {
      let cursor = null;
      const ids: string[] = [];
      do {
        const page = await value('db_admin_inbox($1,$2,$3,$4,$5,$6)', [
          '',
          'all',
          'all',
          sort,
          direction,
          cursor
        ]);
        expect(page.items.length).toBeLessThanOrEqual(20);
        ids.push(...page.items.map((row: {id: string}) => row.id));
        cursor = page.nextCursor;
      } while (cursor);
      expect(new Set(ids).size).toBe(67);
      expect(ids.length).toBe(67);
    }
});
test('aggregation happens before group pagination and event focus finds the correct page', async () => {
  await db.exec(`insert into db_posts(title,slug) select 'Page '||i,'page-'||i from generate_series(1,14) i;
    insert into db_feedback_events(target_type,target_id,post_id,page_title,vote,ip_hash)
    select 'article',id::text,id,title,'yes','fixture' from db_posts where id<>'${post}';
    insert into db_feedback_events(target_type,target_id,post_id,page_title,vote,ip_hash)
    select 'article','${post}','${post}','Article','yes','fixture' from generate_series(1,55)`);
  const first = await value('db_admin_feedback_groups()');
  const second = await value('db_admin_feedback_groups(10)');
  expect(first.items.length).toBe(10);
  expect(second.items.length).toBe(7);
  expect(first.total).toBe(17);
  const located = await value('db_admin_feedback_groups(0,$1,$2)', [
    second.items[0].target_type,
    second.items[0].target_id
  ]);
  expect(located.offset).toBe(10);
  const history = await value('db_admin_feedback_history($1,$2,20)', [
    'article',
    post
  ]);
  expect(history.items.length).toBe(20);
  const focused = await value('db_admin_feedback_history($1,$2,0,$3)', [
    'article',
    post,
    history.items[0].id
  ]);
  expect(focused.offset).toBe(20);
});
test('report hierarchy keeps all reasons/events and resolved notifications retain context', async () => {
  const comment = crypto.randomUUID();
  await db.query(
    'insert into db_comments(id,post_id,author_name,content) values ($1,$2,$3,$4)',
    [comment, post, 'Long reader', 'Comment snapshot']
  );
  await db.query(
    "insert into db_comment_reports(comment_id,reason,details) select $1,case when i%2=0 then 'spam' else 'other' end,'Full report details '||i from generate_series(1,43) i",
    [comment]
  );
  const articles = await value('db_admin_report_groups()');
  expect(articles.items[0].reports).toBe(43);
  const comments = await value('db_admin_report_groups($1)', [post]);
  expect(comments.items[0].content).toBe('Comment snapshot');
  const history = await value('db_admin_report_history($1,$2,20)', [
    comment,
    'spam'
  ]);
  expect(history.items.length).toBe(1);
  expect(history.reasons.length).toBe(2);
  const reportId = history.items[0].id;
  await db.query('delete from db_comment_reports where id=$1', [reportId]);
  expect(
    await value(
      'report_status from db_admin_notification_items where source_id=$1',
      [reportId]
    )
  ).toBe('resolved');
  await db.query('update db_posts set slug=$1 where id=$2', ['renamed', post]);
  expect(
    await value(
      'page_url from db_admin_notification_items where source_id=$1',
      [reportId]
    )
  ).toBe('/blog/renamed');
  await db.query('delete from db_comments where id=$1', [comment]);
  expect(
    await value(
      "meta->>'comment' from db_admin_notification_items where source_id=$1",
      [reportId]
    )
  ).toBe('Comment snapshot');
});
test('deleted pages keep feedback history with no broken link; private tables reject browser roles', async () => {
  await db.query('delete from db_posts where id=$1', [post]);
  const history = await value('db_admin_feedback_history($1,$2)', [
    'article',
    post
  ]);
  expect(history.total).toBeGreaterThan(50);
  expect(
    history.items.every(
      (row: {page_url: string | null}) => row.page_url === null
    )
  ).toBe(true);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}; set test.admin='yes'`);
    for (const table of [
      'db_feedback_events',
      'db_feedback_operations',
      'db_notification_clear_operations',
      'db_admin_feedback_items'
    ])
      await expect(db.query(`select * from ${table}`)).rejects.toThrow();
    await expect(value('db_admin_dashboard()')).rejects.toThrow();
    await expect(vote()).rejects.toThrow();
    await db.exec('reset role');
  }
});
