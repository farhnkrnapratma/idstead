# 3. Page Render (`/`, `/projects`, `/cv`, `/funding`, `/contact`, `/blog`, `/blog/[slug]`)

How the public pages load their data. Every page load uses the **anon** Supabase client from `packages/lib/src/supabase.ts`. No session is involved, and RLS limits reads to public rows.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant W as fkp-web (SvelteKit load)
    participant DB as Supabase PostgREST (anon)
    participant ST as Supabase Storage (blog-posts)
    participant GH as GitHub API

    B->>W: GET any page
    Note over W: +layout.server.ts
    W->>DB: fetchAuthorProfileWithSocials()<br/>db_profiles, db_links
    W->>GH: fetchProjects(username)
    W-->>W: Cache-Control s-maxage=60

    alt GET /
        par Promise.all ((site)/+page.server.ts)
            W->>DB: CV entries, project repo rules, active OpenPGP key
            W->>DB: fetchActiveCvDocument() reads db_documents
            W->>DB: loadPublishedPosts(limit 10)
        end
        Note over W,DB: fetchActiveCvDocument is read-only. If hash is missing it reads file_url + .sha256<br/>for display. The hash is written only at CV upload
        W-->>W: 2 experience, 1 education, 3 newest unpinned posts,<br/>layout projects minus excluded repos (page shows the 2 most recently pushed unpinned)
    else GET /projects
        W->>DB: project repo rules (layout projects minus excluded, pinned names)
    else GET /cv
        W->>DB: CV entries, grouped skills, active CV document, active OpenPGP key
    else GET /funding
        W->>DB: funding links
    else GET /contact
        W->>DB: contact channels, profile email
        W-->>W: canSendMessage only, the email itself is not returned
    else GET /blog
        W->>DB: loadPublishedPosts(): db_posts where published
        loop each post
            W->>ST: GET public URL of storage_path (3 s timeout) for read time
            W->>DB: count db_comments, count db_views
        end
    else GET /blog/[slug]
        W->>DB: db_posts where slug and published (.single(), 404 if missing)
        W->>ST: GET {operationId}.render.json (3 s timeout)
        alt render found, current RENDER_VERSION, not live
            W-->>W: use the stored html, headings and read time
        else missing, outdated or live
            W->>ST: GET markdown (5 s timeout)
            W-->>W: renderMarkdown, injectHeadingIds, extractHeadings<br/>(on failure, fall back to the stored render if any)
        end
        W->>DB: db_comments where is_approved
        W->>DB: count db_views
        W->>DB: all published db_posts, then previous/next window
        loop each related post
            W->>ST: GET markdown (3 s timeout)
            W->>DB: count comments and views
        end
    end
    W-->>B: HTML
```

## Notes

- **Post data:**
    - Posts expose `public_id` as `id`. The UUID never leaves the server.
    - The banner URL is built by `publicBannerUrl()` (`packages/lib/src/blogBanner.ts`) as `{PUBLIC_CDN_BASE_URL}/blog/{slug}/banner.webp`, with `banner.avif` as the preferred source (see [008-asset-pipeline.md](008-asset-pipeline.md#blog-post-assets)).
- **Markdown** lives in Supabase Storage (`blog-posts`). Images and banners live in R2 (see [008-asset-pipeline.md](008-asset-pipeline.md)).
- **Pre-rendered posts:** each saved post has a `.render.json` next to its markdown (see [007-publish-post.md](007-publish-post.md#notes)). The post page serves it without running the MDRS engine. It renders on the request only when the file is missing or was written by another `RENDER_VERSION`. Posts flagged `live` (they read `api.*` data) are served from the stored file as well, so their live data can be up to a day old: the jobs worker re-renders them after every publish and in its daily cron (see [007-publish-post.md](007-publish-post.md#notes)). Only the service role can write to the bucket, so the stored HTML is trusted as sanitized at save time.
- **Supabase admin client:** `/subscribe/confirm` and `/unsubscribe` use it against `db_subscribers`.

## Source

- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/(site)/+page.server.ts`, `(site)/{projects,cv,funding,contact,blog}/+page.server.ts`
- `apps/web/src/routes/blog/[slug]/+page.server.ts`
- `packages/lib/src/author.ts`
- `packages/lib/src/server/blogPosts.ts`, `githubProjects.ts`, `postRender.ts`
