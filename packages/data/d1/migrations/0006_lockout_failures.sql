DROP INDEX db_login_failures_failed_at_idx;
DROP INDEX db_login_failures_key_hash_failed_at_idx;
ALTER TABLE db_login_failures RENAME TO db_lockout_failures;
CREATE INDEX db_lockout_failures_failed_at_idx ON db_lockout_failures (failed_at);
CREATE INDEX db_lockout_failures_key_hash_failed_at_idx ON db_lockout_failures (key_hash, failed_at);
