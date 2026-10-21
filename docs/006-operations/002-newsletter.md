# Newsletter Runbook

How new-post emails reach subscribers, and what to do when they don't. The full flow diagram is in [architecture/7](../003-architecture/007-publish-post.md).

## Subscription lifecycle (`db_subscribers`)

1. **Subscribe:**
    - `POST /api/internal/subscribe` (same-origin + Turnstile) creates or refreshes a `pending` row with `confirm_token_hash`, then emails a link to `/subscribe/confirm?token=…`.
    - Active addresses, and pending addresses inside the 5-minute resend cooldown, get the same "check your inbox" response, so the endpoint does not reveal who has subscribed.
2. **Confirm:** `/subscribe/confirm` (service-role) sets the row to `active`.
3. **Unsubscribe:**
    - Every email links to `/unsubscribe?token={unsubscribe_token}`. Opening the link does not unsubscribe: `GET` stores the token in a short-lived httpOnly cookie and shows a confirm button, and the page's form action (`POST /unsubscribe`) sets `unsubscribed`. Link scanners that prefetch the URL therefore cannot unsubscribe anyone.
    - `POST /api/internal/subscribe/unsubscribe-request` emails a fresh link.
    - Mails carry `List-Unsubscribe: <…/unsubscribe?token=…>` without `List-Unsubscribe-Post`. SvelteKit's CSRF check rejects cross-site form POSTs that carry no matching `Origin`, so a one-click (RFC 8058) POST from a mail provider would fail; mail clients open the confirm page instead.
4. **Pruning:** `pg_cron` job `prune-stale-subscriptions` runs at `17 3 * * *`.

## Delivery

1. **Enqueue:** saving a **published** post in the admin enqueues `{postId}` on `idstead-newsletter`. If the `NEWSLETTER_QUEUE` binding is missing, the admin runs `notifyNewPost` in the background instead.
2. **Consume:** `idstead-jobs` consumes the queue (batch ≤ 10) and calls `notifyNewPost()`:
    - It **claims** the post: `subscribers_notified_at = now()` where it is still `NULL`. A post is therefore emailed at most once, even though every save enqueues a message.
    - It loads the active subscribers, ordered by email so a retry rebuilds the same chunks.
    - It sends through Resend `POST /emails/batch` in chunks of 100. Each email carries its own unsubscribe link, and each chunk carries an `Idempotency-Key` (`newsletter/{postId}/{previous subscribers_notified_at, or auto}/{sha256 of the chunk}`). Resend keeps keys for 24 hours, so a retry does not re-send chunks that already went out. That holds for a forced re-send too: after a failure the previous timestamp is restored, so retrying gives the same keys. If the subscriber list or the post changes between attempts, the chunks shift and some recipients can get a second copy.
    - If any chunk fails, or the subscriber list cannot be loaded, it **releases** the claim (restores the previous `subscribers_notified_at`) so the next attempt can claim it again.
3. **Outcome handling:**

| Outcome | What jobs does |
| --- | --- |
| sent, `unpublished`, `already-sent`, `no-subscribers` | ack |
| `unavailable` (no `RESEND_API_KEY`/`SUBSCRIBER_FROM_EMAIL`, post lookup, claim or subscriber lookup failed) | `retry` after 300 s |
| `send-failed` (at least one Resend chunk failed; claim released) | report to Sentry (warning), `retry` after 300 s |
| thrown error | report to Sentry, `retry` after 300 s |
| malformed message (not `{postId: uuid, force?: boolean}`) | log, ack (dropped) |
| more than 5 retries | moved to `idstead-newsletter-dlq` |

`idstead-jobs` also consumes `idstead-newsletter-dlq` (`max_retries: 0`): each dead-lettered message is reported to Sentry as `Newsletter message dead-lettered` (level `error`, with `postId`, `force`, `messageId`, `attempts`) and acked.

The manual re-send route (`POST /api/internal/admin/posts/notify`) answers `502 BLOG_NOTIFY_SEND_FAILED` when a chunk fails, after releasing the claim.

## Procedures

### A post was published but nobody got the email

1. Check Sentry for `Newsletter send failed` or `Newsletter message dead-lettered`, and `idstead-jobs` logs in Workers observability for `Resend batch failed` or `Failed to claim post notification`.
2. Check the post:

    ```sql
    select slug, published, subscribers_notified_at from db_posts where slug = '<slug>';
    ```

3. If `subscribers_notified_at` is **null**, the message never ran, is still retrying, or was dead-lettered. Check the queue:

    ```sh
    bunx wrangler queues list
    ```

4. If `subscribers_notified_at` is **set** but the mail failed, re-send manually from the post editor (`PostEditor.svelte`), whose re-send action calls `POST /api/internal/admin/posts/notify` with `{postId, force: true}`.
    - **`force` re-sends to every active subscriber**, including any who already received the post.

### Check Resend configuration

`RESEND_API_KEY` and `SUBSCRIBER_FROM_EMAIL` must both be set on **idstead-jobs**, and on idstead-web and idstead-admin for the confirm, contact and alert emails. Check the Worker's settings in the Cloudflare dashboard, or run `bunx wrangler secret list --name <worker>`.

### A message was dead-lettered

Sentry shows `Newsletter message dead-lettered` with the `postId`. The DLQ consumer has already acked it, so nothing piles up. Fix the cause, which is usually missing Resend variables, a Resend outage or a failing database. Then re-send the post with the procedure above.

## Source

- `packages/lib/src/server/newsletterQueue.ts`, `subscriberBroadcast.ts`, `subscribers.ts`, `unsubscribeRequest.ts`
- `packages/data/src/subscribers.ts` (`SubscriberRepository`, `NewsletterStore`) and its adapter `packages/data/src/supabase/subscribers.ts`, the only code that queries `db_subscribers`; `tests/contracts/subscriberRepository.contract.ts` pins their behaviour
- `apps/jobs/src/index.ts`, `apps/jobs/wrangler.jsonc`
- `apps/web/src/routes/api/internal/subscribe/**`, `subscribe/confirm`, `unsubscribe`
- `apps/admin/src/routes/api/internal/admin/posts/{+server.ts,notify/+server.ts}`
