# 4. Public Write Endpoints (`/api/internal/**` on fkp-web)

These endpoints are unversioned and first-party only. They are called by the site's own pages and are not part of the public API. Before a handler runs, the hook has already applied its `/api/*` behaviour: OPTIONS preflight, rate limiting, `no-store`, `noindex`, and the error envelope.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (fkp.my.id page)
    participant H as /api/internal handler
    participant TS as Turnstile
    participant AI as Workers AI (Llama Guard)
    participant DB as Supabase (service-role)
    participant RS as Resend

    rect rgba(120, 160, 255, 0.15)
    Note over B,RS: POST /api/internal/blog/comments
    B->>H: {postId, parentId?, authorName, content, turnstileToken}
    H->>H: isSameOriginRequest, else 403
    H->>TS: verifyTurnstileToken, else 403
    H->>H: validate: parentId UUID, content ≤ 2000, no links, author name not reserved
    H->>AI: moderateContent(text)
    alt model unavailable
        H-->>B: 503 BLOG_COMMENT_MODERATION_UNAVAILABLE
    end
    H->>DB: resolvePostUuid, then check the parent is approved on the same post
    H->>DB: INSERT db_comments {post_id, parent_id, author_name, content, is_approved = moderation.safe}
    H-->>B: 201 {comment, moderation}
    end

    rect rgba(120, 220, 140, 0.15)
    Note over B,RS: POST /api/internal/blog/views
    B->>H: {postId}
    H->>H: isSameOriginRequest
    H->>H: key = YYYY-MM-DD_sha256(ip + IP_SALT)
    H->>DB: SELECT db_views where post_id and ip_hash = key
    opt no row today
        H->>DB: INSERT db_views {post_id, ip_hash: key, viewed_at}
    end
    H->>DB: COUNT db_views where post_id
    H-->>B: 201 or 200 {counted, views}
    end

    rect rgba(255, 200, 120, 0.18)
    Note over B,RS: POST /api/internal/subscribe
    B->>H: {email, turnstileToken}
    H->>H: same-origin, email check, Turnstile
    H->>DB: SELECT db_subscribers by email
    alt active, or pending inside the 5 min resend cooldown
        H-->>B: 200 same accepted body (no enumeration)
    else
        H->>DB: INSERT or UPDATE pending row<br/>{confirm_token_hash, confirm_sent_at, ip_hash, user_agent, unsubscribe_token on insert}
        H->>RS: confirm mail with /subscribe/confirm?token=...
        H-->>B: 200 accepted
    end
    end

    rect rgba(255, 150, 200, 0.15)
    Note over B,RS: POST /api/internal/contact
    B->>H: {kind: message or feedback, name, email, message, url?, turnstileToken}
    H->>H: same-origin, Turnstile, field checks
    H->>DB: resolve recipient (contact link or profile email)
    H->>RS: sendEmail to the site owner, else 502
    H->>DB: INSERT db_admin_notifications {kind}
    H-->>B: 201 {success}
    end
```

## All web internal endpoints

| Endpoint | Guards | Writes |
| --- | --- | --- |
| `POST /api/internal/blog/comments` | same-origin, Turnstile, validation, Llama Guard | `db_comments` |
| `POST /api/internal/blog/comments/report` | same-origin, Turnstile, reason allow-list | `db_comment_reports` |
| `POST /api/internal/blog/views` | same-origin | `db_views` |
| `POST /api/internal/feedback` | same-origin, `sec-fetch-site` not `cross-site` | RPC `db_record_page_feedback`, which writes `db_feedback_operations`, `db_feedback_events` and, for posts, `db_post_feedback` and `db_posts.helpful_*` |
| `POST /api/internal/subscribe` | same-origin, Turnstile | `db_subscribers` and a confirm mail |
| `POST /api/internal/subscribe/unsubscribe-request` | same-origin, Turnstile | none (mails an unsubscribe link without revealing whether the address exists) |
| `POST /api/internal/subscribe/unsubscribe` | 64-hex token | `db_subscribers.status = 'unsubscribed'` (always 204) |
| `POST /api/internal/contact` | same-origin, Turnstile | a mail to the owner, then `db_admin_notifications` |

## Notes

- **Clients:** writes use `getSupabaseAdminClient()` (service role, bypasses RLS). It is server-only (`packages/lib/src/server/supabaseAdmin.ts`).
- **Activity log:** these public endpoints do **not** write `db_activity_log`. Only admin endpoints do.
- **IP hashing** uses SHA-256 of the IP plus `IP_SALT`. It is used for view de-duplication, report and feedback tracking, and subscriber rows.

## Source

- `apps/web/src/routes/api/internal/**/+server.ts`
- `packages/lib/src/server/sameOrigin.ts`, `turnstile.ts`, `moderation.ts`, `pageFeedback.ts`, `subscribers.ts`, `unsubscribeRequest.ts`
- `supabase/migrations/20260911123339_feedback_operation_replay.sql` (`db_record_page_feedback`)
