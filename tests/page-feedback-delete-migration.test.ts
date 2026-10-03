import {describe, expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';

const migration = await readFile(
  new URL(
    '../supabase/migrations/20261002163559_page_feedback_delete_cascade.sql',
    import.meta.url
  ),
  'utf8'
);

describe('page feedback deletion migration', () => {
  test('removes orphan feedback for the identified article only when its ID is unique', () => {
    expect(migration).toContain("f.page_title = 'Development Testing Page'");
    expect(migration).toContain('cardinality(v_target_ids) > 1');
    expect(migration).toContain('o.target_id = v_target_id');
    expect(migration).toContain('f.target_id = v_target_id');
  });

  test('cascades feedback events and admin notifications with article deletion', () => {
    expect(migration).toMatch(
      /db_feedback_events_post_id_fkey[\s\S]*?on delete cascade/
    );
    expect(migration).toMatch(
      /db_admin_notifications_post_id_fkey[\s\S]*?on delete cascade/
    );
  });

  test('deletes all feedback replay operations for a deleted article', () => {
    expect(migration).toContain(
      'create trigger trg_cleanup_post_feedback_operations'
    );
    expect(migration).toContain("where target_type = 'article'");
    expect(migration).toContain('and target_id = old.id::text');
  });
});
