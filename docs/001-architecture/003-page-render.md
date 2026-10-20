# 3. Page Render (`/`, `/projects`, `/cv`, `/funding`, `/contact`, `/blog`, `/blog/[slug]`)

How the public pages load their data. Every page load uses the **anon** Supabase client from `packages/lib/src/supabase.ts`. No session is involved, and RLS limits reads to public rows. Posts, comments and author data are read through the `@idstead/data` repositories from `publicRepositories(fetch)`, so page data carries no database IDs.

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
    W->>DB: author.profile(), author.socialLinks()<br/>db_profiles, db_links
    par
        W->>GH: fetchCachedProjects(username) (edge cache, 10 min)
        W->>DB: author.projectRepoRules() (drop excluded repos, pinned names)
    end
    W-->>W: Cache-Control s-maxage=60

    alt GET /
        par Promise.all ((site)/+page.server.ts)
            W->>DB: CV entries, site URL, active OpenPGP key
            W->>DB: fetchActiveCvDocument() reads db_documents
            W->>DB: loadPublishedPosts(limit 10)
        end
        Note over W,DB: fetchActiveCvDocument is read-only. If hash is missing it reads file_url + .sha256<br/>for display. The hash is written only at CV upload
        W-->>W: 2 experience, 1 education, 3 newest unpinned posts,<br/>layout projects minus excluded repos (page shows the 2 most recently pushed unpinned)
    else GET /projects
        W-->>W: no page load: the layout's projects and pinnedRepoNames
    else GET /cv
        W->>DB: CV entries, grouped skills, active CV document, site URL, active OpenPGP key
    else GET /funding
        W->>DB: funding links
    else GET /contact
        W->>DB: contact channels, profile email
        W-->>W: canSendMessage only, the email itself is not returned
    else GET /blog
        W->>DB: blog.listPublishedWithStats(): published db_posts<br/>with view_count and embedded db_comments(count)
        loop each post without a stored read_time
            W->>ST: GET markdown (3 s timeout) for read time
        end
    else GET /blog/[slug]
        W->>DB: blog.getPublishedBySlug() (404 if missing)
        W->>ST: GET {operationId}.render.json (3 s timeout)
        alt render found, current RENDER_VERSION, not live
            W-->>W: use the stored html, headings and read time
        else missing, outdated or live
            W->>ST: GET markdown (5 s timeout)
            W-->>W: renderMarkdown, injectHeadingIds, extractHeadings
        end
        W->>DB: comments.listApproved()
        W->>DB: blog.listPublishedWithStats(): view count of this post,<br/>previous/next window with their counts
        loop each related post without a stored read_time
            W->>ST: GET markdown (3 s timeout)
        end
    end
    W-->>B: HTML
```

## Notes

- **Client navigation:** links preload code and data on hover, Spotlight preloads its highlighted command, and the `(site)` layout preloads every section's code when idle. No page load calls `parent()`, so navigating between section pages runs only that page's load, and `pageDataCache` (`packages/lib/src/server/pageDataCache.ts`) serves the six section pages' `__data.json` from the edge cache for 60 s.

- **Post data:**
    - Posts expose `public_id` as `id`. The UUID never leaves the server: the repositories return `@idstead/domain/blog.ts` DTOs and keep the post's storage location in an opaque `PostSource`.
    - Comment and view counts come from embedded counts in the listing query, so a list costs one query plus a markdown fetch per post until posts store `read_time`.
    - The banner URL is built by `publicBannerUrl()` (`packages/lib/src/blogBanner.ts`) as `{PUBLIC_CDN_BASE_URL}/blog/{slug}/banner.webp`, with `banner.avif` as the preferred source (see [008-asset-pipeline.md](008-asset-pipeline.md#blog-post-assets)).
- **Markdown** lives in Supabase Storage (`blog-posts`). Images and banners live in R2 (see [008-asset-pipeline.md](008-asset-pipeline.md)).
- **Pre-rendered posts:** each saved post has a `.render.json` next to its markdown (see [007-publish-post.md](007-publish-post.md#notes)). The post page serves it without running the MDRS engine. It renders on the request only when the file is missing or was written by another `RENDER_VERSION`. Posts flagged `live` (they read `api.*` data) are served from the stored file as well, so their live data can be up to a day old: the jobs worker re-renders them after every publish and in its daily cron (see [007-publish-post.md](007-publish-post.md#notes)). Only the service role can write to the bucket, so the stored HTML is trusted as sanitized at save time.
- **Service-role data:** `/subscribe/confirm` and `/unsubscribe` use `serviceData(platform).writers.subscribers` (`SubscriberRepository` from `@idstead/data`).

## Source

- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/(site)/+page.server.ts`, `(site)/{projects,cv,funding,contact,blog}/+page.server.ts`
- `apps/web/src/routes/blog/[slug]/+page.server.ts`
- `packages/data/src/author.ts`, `supabase/author.ts`, `packages/domain/src/author.ts`
- `packages/lib/src/server/blogPosts.ts`, `repositories.ts`, `githubProjects.ts`, `postRender.ts`
- `packages/data/src/blog.ts`, `supabase/blog.ts`
