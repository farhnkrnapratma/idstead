import {beforeAll, describe, expect, test} from 'bun:test';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {
  activityFixture,
  activityMigrationPaths
} from './helpers/adminActivityDb';
const enabled = process.env.ACTIVITY_POSTGRES_TEST === '1';
const post = '11111111-1111-4111-8111-111111111111';
const hash = 'a'.repeat(64);
function sql(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec',
      '-i',
      process.env.ACTIVITY_POSTGRES_CONTAINER ?? 'www-admin-activity-test',
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-qAt'
    ]);
    let output = '',
      error = '';
    child.stdout.on('data', data => {
      output += data;
    });
    child.stderr.on('data', data => {
      error += data;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(error));
    });
    child.stdin.end(query);
  });
}
function vote(operation: string, ip = hash) {
  return `select db_record_page_feedback('${operation}','article','${post}','yes','${ip}');`;
}

describe.skipIf(!enabled)('isolated PostgreSQL concurrency', () => {
  beforeAll(async () => {
    await sql(activityFixture);
    for (const file of [
      'supabase/migrations/20260825000000_add_collaborators_and_feedback.sql',
      'supabase/migrations/20260910000000_admin_dashboard_notifications.sql',
      'supabase/migrations/20260910120000_admin_notifications_inbox.sql',
      ...activityMigrationPaths,
      'supabase/migrations/20260913144335_scalable_admin_workspace.sql'
    ])
      await sql(await readFile(file, 'utf8'));
    await sql(
      `insert into db_posts(id,title,slug) values ('${post}','Fixture','fixture');`
    );
  }, 30000);
  test('concurrent unique operations accept one vote per IP/page', async () => {
    const results = await Promise.all(
      Array.from({length: 16}, () => sql(vote(crypto.randomUUID())))
    );
    expect(
      results
        .map(result => JSON.parse(result))
        .filter(result => result.recorded)
    ).toHaveLength(1);
    expect(
      await sql(
        'select count(*) from db_feedback_events; select count(*) from db_admin_notifications; select helpful_yes from db_posts;'
      )
    ).toBe('1\n1\n1');
  }, 30000);
  test('same-operation concurrent requests reconcile with exactly one accepted event', async () => {
    const operation = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({length: 12}, () => sql(vote(operation, 'b'.repeat(64))))
    );
    const values = results.map(result => JSON.parse(result));
    expect(values.filter(result => !result.replayed)).toHaveLength(1);
    expect(values.every(result => result.recorded)).toBe(true);
    expect(
      await sql(
        'select count(*) from db_feedback_events; select helpful_yes from db_posts;'
      )
    ).toBe('2\n2');
  }, 30000);
  test('the transaction lock blocks competitors and a rollback releases it without consuming quota', async () => {
    const operation = crypto.randomUUID();
    const held = sql(
      `begin; ${vote(operation, 'c'.repeat(64))} select pg_sleep(1); rollback;`
    );
    await new Promise(resolve => setTimeout(resolve, 250));
    const accepted = sql(vote(crypto.randomUUID(), 'c'.repeat(64)));
    await held;
    expect(JSON.parse(await accepted)).toEqual({
      recorded: true,
      replayed: false
    });
    expect(
      await sql(
        `select count(*) from db_feedback_operations where operation_id='${operation}'; select count(*) from db_feedback_events;`
      )
    ).toBe('0\n3');
  }, 30000);
  test('legacy and server callers share the same quota lock', async () => {
    const ip = 'd'.repeat(64);
    const results = await Promise.all([
      sql(`select record_post_feedback('${post}','no','${ip}');`),
      sql(vote(crypto.randomUUID(), ip))
    ]);
    expect(
      Number(results[0] === 't') + Number(JSON.parse(results[1]).recorded)
    ).toBe(1);
    expect(
      await sql(
        'select count(*) from db_feedback_events; select count(*) from db_admin_notifications;'
      )
    ).toBe('4\n4');
  }, 30000);
  test('concurrent clear retries delete a frozen set exactly once', async () => {
    const actor = crypto.randomUUID(),
      operation = crypto.randomUUID();
    await sql(
      "insert into db_admin_notifications(kind) select 'contact_message' from generate_series(1,80);"
    );
    const prepared = JSON.parse(
      await sql(
        `select db_admin_clear_notifications('${actor}','${operation}',false);`
      )
    );
    await sql(
      "insert into db_admin_notifications(kind) values ('feedback_report');"
    );
    const results = await Promise.all(
      Array.from({length: 8}, () =>
        sql(
          `select db_admin_clear_notifications('${actor}','${operation}',true);`
        )
      )
    );
    expect(
      results.every(
        result => JSON.parse(result).deletedCount === prepared.count
      )
    ).toBe(true);
    expect(
      await sql(
        'select count(*) from db_admin_notifications; select count(*) from db_feedback_events;'
      )
    ).toBe('1\n4');
  }, 30000);
  test('concurrent group retries affect each notification once and preserve source feedback', async () => {
    await sql(
      `insert into db_admin_notifications(kind,post_id,meta) select 'post_feedback','${post}',jsonb_build_object('page_id','${post}','vote','yes') from generate_series(1,80);`
    );
    const prepared = JSON.parse(
      await sql(
        `select db_admin_workspace('notifications',jsonb_build_object('type','helpful','to',clock_timestamp(),'timeZone','UTC'));`
      )
    );
    const group = prepared.items[0].id.replaceAll("'", "''");
    const snapshot = prepared.asOf;
    await sql(
      `insert into db_admin_notifications(kind,post_id,meta) values('post_feedback','${post}',jsonb_build_object('page_id','${post}','vote','yes'));`
    );
    for (const remove of [false, true]) {
      const results = await Promise.all(
        Array.from({length: 8}, () =>
          sql(
            `select db_admin_notification_group_action('${group}','${snapshot}','UTC',${remove});`
          )
        )
      );
      expect(
        results.reduce(
          (total, result) => total + JSON.parse(result).affected,
          0
        )
      ).toBe(80);
    }
    expect(
      await sql(
        "select count(*) from db_admin_notifications where kind='post_feedback' and read_at is null; select count(*) from db_feedback_events;"
      )
    ).toBe('1\n4');
  }, 30000);
});
