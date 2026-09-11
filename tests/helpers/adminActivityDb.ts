import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const activityMigrationPaths = [
  'supabase/migrations/20260911042344_admin_activity_feedback.sql',
  'supabase/migrations/20260911123339_feedback_operation_replay.sql'
];
export async function activityMigrationSql() {
  return (
    await Promise.all(
      activityMigrationPaths.map(file => readFile(file, 'utf8'))
    )
  ).join('\n');
}
export const activityFixture = `
create role anon; create role authenticated; create role service_role bypassrls;
create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = 'yes' $$;
create table db_posts(id uuid primary key default gen_random_uuid(), title text not null, slug text, published boolean default true, helpful_yes integer default 0, helpful_no integer default 0);
create table db_comments(id uuid primary key default gen_random_uuid(), post_id uuid references db_posts(id) on delete cascade, author_name text, content text, is_anonymous boolean default false, is_admin boolean default false, created_at timestamptz default now());
create table db_comment_reports(id uuid primary key default gen_random_uuid(), comment_id uuid references db_comments(id) on delete cascade, reason text, details text, reporter_ip_hash text, created_at timestamptz default now());
create table db_legals(id uuid primary key default gen_random_uuid(), slug text unique, title text, content text);
create table db_views(viewed_at timestamptz);
`;
export async function activityDb() {
  const db = new PGlite();
  await db.exec(activityFixture);
  await db.exec(
    await readFile(
      'supabase/migrations/20260825000000_add_collaborators_and_feedback.sql',
      'utf8'
    )
  );
  await db.exec(
    await readFile(
      'supabase/migrations/20260910000000_admin_dashboard_notifications.sql',
      'utf8'
    )
  );
  await db.exec(
    await readFile(
      'supabase/migrations/20260910120000_admin_notifications_inbox.sql',
      'utf8'
    )
  );
  return db;
}
