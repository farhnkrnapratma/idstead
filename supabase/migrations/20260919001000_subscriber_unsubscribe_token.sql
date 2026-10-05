alter table public.db_subscribers
  rename column unsubscribe_token_hash to unsubscribe_token;

alter index db_subscribers_unsubscribe_token_key
  rename to db_subscribers_unsubscribe_token_idx;
