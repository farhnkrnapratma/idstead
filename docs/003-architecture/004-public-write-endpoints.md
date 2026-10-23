# 4. Public Write Endpoints (`/api/internal/**` on idstead-web)

These endpoints are unversioned and first-party only. They are called by the site's own pages and are not part of the public API. Before a handler runs, the hook has already applied its `/api/*` behaviour: OPTIONS preflight, rate limiting, `no-store`, `noindex`, and the error envelope.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (example.com page)
    participant H as /api/internal handler
    participant TS as Turnstile
    participant AI as Workers AI (Llama Guard)
    participant DB as D1 (DB binding)
    participant RS as Resend

    rect rgba(120, 160, 255, 0.15)
    Note over B,RS: POST /api/internal/blog/comments
    B->>H: {postId, parentId?, authorName, content, turnstileToken}
    H->>H: isSameOriginRequest, else 403
    H->>TS: verifyTurnstileToken, else 403
    H->>H: validate: parentId is a comment public ID, content ≤ 2000, no links, author name not reserved
    H->>AI: moderateContent(text)
    alt model unavailable
        H-->>B: 503 BLOG_COMMENT_MODERATION_UNAVAILABLE
    end
    H->>DB: serviceData().blog.findPublished(postId)
    H->>DB: writers.comments.create(): resolve the parent's public ID to an approved comment on the same post,<br/>INSERT db_comments {post_id, parent_id, author_name, content, is_approved = moderation.safe}
    H-->>B: 201 {comment (public id and parent public id), moderation}
    end

    rect rgba(120, 220, 140, 0.15)
    Note over B,RS: POST /api/internal/blog/views
    B->>H: {postId}
    H->>H: isSameOriginRequest
    H->>H: key = YYYY-MM-DD_sha256(ip + IP_SALT)
    H->>DB: serviceData().blog.findPublished(postId)
    H->>DB: writers.views.record(): INSERT db_views {post_id, ip_hash: key} ON CONFLICT (post_id, ip_hash) DO NOTHING<br/>(trigger db_sync_post_view_count bumps db_posts.view_count)
    H->>DB: SELECT db_posts.view_count
    H-->>B: 201 or 200 {counted, views}
    end

    rect rgba(255, 200, 120, 0.18)
    Note over B,RS: POST /api/internal/subscribe
    B->>H: {email, turnstileToken}
    H->>H: same-origin, email check, Turnstile
    H->>DB: serviceData().writers.subscribers.request(...)
    alt active, or pending inside the 5 min resend cooldown
        H-->>B: 200 same accepted body (no enumeration)
    else
        H->>DB: INSERT or UPDATE pending row<br/>{confirm_token_hash, confirm_sent_at, ip_hash, user_agent, unsubscribe_token on insert}
        H->>RS: confirm mail with /subscribe/confirm?token=...
        H-->>B: 200 accepted, or 502 SUBSCRIBE_EMAIL_FAILED if the mail fails
    end
    end

    rect rgba(255, 150, 200, 0.15)
    Note over B,RS: POST /api/internal/contact
    B->>H: {kind: message or feedback, name, email, message, url?, turnstileToken}
    H->>H: same-origin, Turnstile, field checks
    H->>DB: resolve recipient (contact link or profile email)
    H->>RS: sendEmail to the site owner, else 502
    H->>DB: writers.notifications.notify(kind)<br/>(INSERT db_admin_notifications)
    H-->>B: 201 {success}
    end
```

## All web internal endpoints

| Endpoint | Guards | Writes |
| --- | --- | --- |
| `POST /api/internal/blog/comments` | same-origin, Turnstile, validation, Llama Guard | `db_comments` |
| `POST /api/internal/blog/comments/report` | same-origin, Turnstile, reason allow-list; `commentId` is the comment public ID | `db_comment_reports` |
| `POST /api/internal/blog/views` | same-origin | `db_views` |
| `POST /api/internal/feedback` | same-origin, `sec-fetch-site` not `cross-site` | `FeedbackRecorder.record()`, one D1 batch that writes `db_feedback_operations`, `db_feedback_events` and, for posts, `db_post_feedback` and `db_posts.helpful_*` |
| `POST /api/internal/subscribe` | same-origin, Turnstile | `db_subscribers` and a confirm mail |
| `POST /api/internal/subscribe/unsubscribe-request` | same-origin, Turnstile | none (mails an unsubscribe link without revealing whether the address exists) |
| `POST /api/internal/contact` | same-origin, Turnstile | a mail to the owner, then `db_admin_notifications` |

## Notes

- **Origin check:** every endpoint above rejects a cross-origin request with `403` and `FORBIDDEN_ORIGIN`.
- **Stores:** writes go through `dataStores(platform).service` (`packages/lib/src/server/data.ts`), which is server-only.
- **Activity log:** these public endpoints do **not** write `db_activity_log`. Only admin endpoints do.
- **IP hashing** uses SHA-256 of the IP plus `IP_SALT` (`hashIp` in `@idstead/domain/hash.ts`). It is used for view de-duplication, report and feedback tracking, and subscriber rows.

## Source

- `apps/web/src/routes/api/internal/**/+server.ts`
- `packages/lib/src/server/sameOrigin.ts`, `turnstile.ts`, `moderation.ts`, `pageFeedback.ts`, `subscribers.ts`, `unsubscribeRequest.ts`
- `packages/data/src/activity.ts` and `d1/activity.ts` (`FeedbackRecorder` records the page feedback, `AdminNotifier` inserts into `db_admin_notifications`)
- `packages/data/d1/migrations/0001_init.sql`
