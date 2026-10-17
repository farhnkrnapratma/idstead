# 3. Page Render (`/`, `/blog`, `/blog/[slug]`)

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
        par Promise.all (+page.server.ts)
            W->>DB: profile (+email), CV entries, funding, contact
            W->>DB: grouped skills, project repo rules
            W->>DB: fetchActiveCvDocument() reads db_documents
        end
        Note over W,DB: fetchActiveCvDocument is read-only. If hash is missing it reads file_url + .sha256<br/>for display. The hash is written only at CV upload
        par
            W->>GH: fetchProjects(username, excluded repos)
            W->>DB: loadPublishedPosts(limit 5)
        end
    else GET /blog
        W->>DB: loadPublishedPosts(): db_posts where published
        loop each post
            W->>ST: GET public URL of storage_path (3 s timeout) for read time
            W->>DB: count db_comments, count db_views
        end
    else GET /blog/[slug]
        W->>DB: db_posts where slug and published (.single(), 404 if missing)
        W->>ST: GET markdown (5 s timeout)
        W-->>W: renderMarkdown, injectHeadingIds, extractHeadings
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
- **Supabase admin client:** `/subscribe/confirm` and `/unsubscribe` use it against `db_subscribers`.

## Source

- `apps/web/src/routes/+layout.server.ts`, `+page.server.ts`
- `apps/web/src/routes/blog/+page.server.ts`, `blog/[slug]/+page.server.ts`
- `packages/lib/src/author.ts`
- `packages/lib/src/server/blogPosts.ts`, `githubProjects.ts`
