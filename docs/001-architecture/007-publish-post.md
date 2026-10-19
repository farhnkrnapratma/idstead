# 7. Save / Publish a Post and the Newsletter

`POST /api/internal/admin/posts` on fkp-admin saves a post idempotently. Saving a published post triggers the subscriber broadcast through the `fkp-newsletter` queue.

```mermaid
sequenceDiagram
    autonumber
    participant B as Admin browser (PostEditor)
    participant P as POST /api/internal/admin/posts
    participant DB as Supabase (service-role)
    participant R2 as R2 (ASSET_BUCKET)
    participant ST as Storage (blog-posts)
    participant Q as Queue fkp-newsletter
    participant J as fkp-jobs (queue consumer)
    participant RS as Resend

    B->>B: processBanner() in a Web Worker: WebP + AVIF, 1280×640
    B->>P: multipart: post fields, markdown, banner files, operationId
    P->>P: blogAdmin(): same-origin + verifyAdminToken
    P->>P: parsePostInput() (banner WASM validation), validateDefineForSave()
    P->>P: buildPostRender(): render MDRS once (failure is logged, the save continues)
    P->>DB: rpc db_prepare_post_operation (keyed by operationId)
    opt new banner
        P->>R2: putBanner webp, then avif<br/>blog/banners/{postId}/{version}.{ext} (staging), read-back SHA-256 check
    end
    P->>ST: upload markdown (read back if it already exists)
    P->>ST: upload {operationId}.render.json (upsert; a failure is logged, not fatal)
    P->>DB: rpc db_ready_post_operation
    P->>DB: rpc db_commit_post_operation
    alt revision conflict
        P-->>B: 409 BLOG_REVISION_CONFLICT
    else rejected (for example a duplicate slug)
        P-->>B: 422 BLOG_SAVE_REJECTED
    end
    opt result.published
        P->>Q: enqueueNewsletter({postId})
        alt binding missing or send failed
            P-)P: runInBackground(notifyNewPost(...))
        end
    end
    opt result.published or previously published
        P->>Q: enqueueRenderRefresh() → {kind: 'refresh-renders'}
    end
    P->>DB: cleanupBlogAssets()
    P->>DB: logActivity blog.publish, blog.update or blog.delete
    P-->>B: saved post

    Q->>J: batch (max 10)
    opt any {kind: 'refresh-renders'} in the batch
        J->>ST: refreshPostRenders() once, then ack those messages
    end
    J->>J: isNewsletterMessage? else ack (drop)
    J->>DB: notifyNewPost(db, env, siteUrl, postId, force)
    DB-->>J: post row: published? subscribers_notified_at?
    alt not published, or already notified and not force
        J->>J: ack
    else
        J->>DB: CLAIM: UPDATE db_posts SET subscribers_notified_at = now()<br/>WHERE id AND subscribers_notified_at IS NULL (skipped by force)
        alt no row claimed
            J->>J: ack (already-sent)
        else claimed
            J->>DB: activeSubscribers() ordered by email
            J->>RS: POST /emails/batch in chunks of 100<br/>(per-recipient unsubscribe link, Idempotency-Key per chunk)
            alt every chunk sent
                J->>J: ack
            else a chunk failed, or subscribers could not be loaded
                J->>DB: RELEASE: restore subscribers_notified_at<br/>WHERE id AND subscribers_notified_at = claim time
                J->>J: retry({delaySeconds: 300})
            end
        end
    end
    Note over J: reason 'unavailable' or 'send-failed', or a thrown error,<br/>leads to retry({delaySeconds: 300}). After 5 retries the message goes to fkp-newsletter-dlq.
    Q->>J: DLQ batch from fkp-newsletter-dlq
    J->>J: Sentry.captureMessage('Newsletter message dead-lettered'), ack
```

## Notes

- **MDRS validation before the save:** while the author types, and again before submitting, `PostEditor` (and the legal page editors) call `POST /api/internal/blog/validate-define` through `validateMdrsRemote` (`packages/lib/src/mdrsValidation.ts`). The save route repeats `validateDefineForSave` and answers `422 BLOG_DEFINE_VALIDATION_FAILED` when the document has errors.
- **Pre-render:** the save route renders the post with `buildPostRender()` (`packages/lib/src/server/postRender.ts`) and stores `posts/{postId}/{operationId}.render.json` next to the markdown file: the sanitized HTML, headings, read time, `RENDER_VERSION` and a `live` flag. `live` is true when a `:::define` block reads `api.*` (`usesLiveData()`), because that output depends on data that changes after the save. The queued storage cleanup removes the render file together with its markdown file.
- **Every save of a published post enqueues a message.** Duplicates are harmless because of the atomic claim on `subscribers_notified_at`.
- **Manual re-send:**
    - `POST /api/internal/admin/posts/notify` with `{postId, force}` calls `notifyNewPost` synchronously, without going through the queue.
    - `force: true` skips the `IS NULL` guard on the claim and re-sends to everyone.
    - A failed chunk returns `502 BLOG_NOTIFY_SEND_FAILED` after the claim is restored.
- **Error mapping:** the post route also returns `503 BLOG_SAVE_UNCONFIRMED` when the commit cannot be confirmed. `GET /api/internal/admin/posts?operationId=…` reads `db_post_operations` to check a save's outcome.
- **Jobs cron** (`17 3 * * *`) runs `cleanupBlogAssets`, `cleanupAssets` and `refreshPostRenders`. It never sends newsletters.
- **Render refresh:** after saving a published post, or unpublishing one, the route sends `{ kind: 'refresh-renders' }` to `fkp-newsletter`, because the list behind `api.v1.blog` changed. The consumer runs `refreshPostRenders()` (`packages/lib/src/server/postRender.ts`) re-renders published posts whose stored render is `live`, missing or from another `RENDER_VERSION`, checking the 20 newest posts and rendering at most 5 per run to stay inside the free plan's 50 external subrequests per invocation. Several refresh messages in one batch run the job once.
- **Retries do not duplicate mail:** each chunk's `Idempotency-Key` is `newsletter/{postId}/{previous subscribers_notified_at, or auto}/{sha256 of the chunk}`, and Resend dedups identical keys for 24 hours, so a retry, including a retried forced re-send, only delivers the chunks that failed.
- **DLQ:** `fkp-jobs` consumes `fkp-newsletter-dlq` (`max_retries: 0`), reports each message to Sentry with its `postId`, and acks it.

## Source

- `apps/admin/src/routes/api/internal/admin/posts/+server.ts`, `posts/notify/+server.ts`, `api/internal/blog/validate-define/+server.ts`, `api/internal/blog/validate-define/+server.ts`
- `packages/lib/src/server/blogPostSave.ts`, `blogPostInput.ts`, `blogBannerStorage.ts`
- `packages/lib/src/server/newsletterQueue.ts`, `subscriberBroadcast.ts`, `subscribers.ts`
- `apps/jobs/src/index.ts`, `apps/jobs/wrangler.jsonc`
