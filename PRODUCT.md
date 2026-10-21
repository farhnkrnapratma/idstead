# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: engineers and technical readers.** Peers who arrive for the blog, read posts end to end, return, and may subscribe to the newsletter, comment, react ("helpful"), follow the Atom feed, or consume content through the public API, `.md`/`.txt` variants, or `llms.txt`. When trade-offs arise, this reader's needs win.

Secondary audiences, served by the homepage sections without displacing the reader:

- People evaluating the author for work or collaboration (CV, projects, skills, contact).
- Supporters who back the work through the funding links.

**Admin operator.** Each instance's admin portal (`admin.<domain>`) has exactly one user: the site owner, authenticated with MFA or a passkey, writing and publishing posts, moderating comments, and maintaining profile data.

**Self-hoster.** The person who deploys an instance, usually the same site owner. They configure it through `idstead.jsonc` and environment variables and never edit code to make the site theirs.

## Product Purpose

Idstead is a self-hostable personal site and identity home. Each instance publishes one person's long-form writing and presents their profile, projects, CV, funding, and contact channels; later, each instance also serves that person's identity (avatar, banner, profile) to other apps. The reference instance is the owner's own site, which runs the same code with its own data.

Success for an instance owner, in no fixed order:

- **Readership and subscribers:** posts are read, readers return, newsletter subscriptions grow.
- **Opportunities and contact:** the site leads to messages, work or client conversations, and CV downloads.
- **Credibility as proof:** the site's own engineering (security posture, public API, craft) demonstrates the skills the profile claims.
- **Support and funding:** visitors become sponsors or backers.

## Positioning

A personal site whose content is equally available to humans and machines (public read-only REST API, OpenAPI, Markdown and plain-text variants, feeds, `.well-known` discovery, `llms.txt`), with visitor-controlled accessibility and keyboard-first navigation, that its owner runs on their own Cloudflare account. A hosted blog platform owns the reader relationship and the data; an Idstead owner keeps both.

## Operating Context

- **Public site (the instance's apex domain):** a homepage summarising the profile, recent experience, posts and projects; `/projects`, `/cv`, `/funding` and `/contact` pages; `/blog` index with search, tag filter, sort, and pagination; post pages with table of contents, references, comments, and helpful feedback; legal pages (privacy, terms, security); subscribe/unsubscribe flows.
- **Reading formats:** every post and legal page also exists as `.md` and `.txt`; content is reachable through the instance's `/v1` API, Atom, sitemap, and `llms.txt`.
- **Posts** are written in MDRS, the project's own Markdown dialect (callouts, tabs, snippets, steps, details, embeds, KaTeX math, filenamed and line-marked code blocks, references) and rendered server-side through an allowlist sanitizer.
- **Newsletter:** publishing a post enqueues delivery to subscribers by email (Resend).
- **Contact:** a Turnstile-protected contact form, plus whichever channels the owner lists (email with an OpenPGP fingerprint, chat networks, and so on).
- **Admin portal:** dashboard, post editor (`/new`), comment moderation, and profile management, used by one person.
- Interface language is English.

## Capabilities and Constraints

- SvelteKit 5 + Tailwind CSS 4 on Cloudflare Workers; all UI comes from the `@idstead/ui` design system and the shared `packages/lib` components. Pages reuse them rather than building one-off replacements.
- **All profile content is data, never hardcoded:** name, bio, headline, CV, skills, funding, contact, and socials come from Supabase. Projects come from the author's GitHub repositories, filtered by pinned/excluded rules stored in Supabase.
- Comments are moderated by Llama Guard 3; when moderation is unavailable, the comment is rejected rather than published unchecked.
- Public output never exposes database IDs; posts are identified by an immutable 64-hex public ID or slug.
- The public API is read-only and versioned (`/v1`); breaking changes require a new version.
- Light and dark themes are both supported and visitor-selectable.
- The CV is downloadable as PDF with SHA-256, SHA-512, MD5 and BLAKE2b checksum files and a detached OpenPGP signature verified against the published key (`/pgp.asc`, WKD, keyservers), individually or as one verification bundle.

## Brand Commitments

- **Name and identity:** the product is Idstead; an instance carries only its owner's name, which comes from the database. Avatar and identity assets are served from the instance itself.
- **No owner in the code:** nothing in the repository names a particular person or domain outside the instance's own `idstead.jsonc`.
- **Machine-readable by default:** every human-facing page keeps a machine-readable counterpart (`.md`/`.txt`, API, feeds, `llms.txt`, `.well-known`). New content surfaces must ship with one.
- **Accessibility controls:** visitors can adjust font scale (100–150%), reduce motion, use solid surfaces, raise text contrast, highlight focus rings, and switch to a dyslexic-friendly font. New UI must respect every one of these settings.
- **Keyboard-first navigation:** on the public site, shortcuts, spotlight/command search, and the shortcut catalog are core to the experience; new public UI must be fully keyboard-operable and fit the shortcut system. The admin portal has no keyboard shortcuts by design, but every admin control must still be fully keyboard-operable.

## Evidence on Hand

- Each instance's author profile, CV, skills, funding links, and contact channels via `GET /v1/author` on its API (sourced from the database).
- Published blog posts and their comments and helpful counts (Supabase, exposed through `/v1/blog`).
- GitHub repositories surfaced as projects, with real stars and forks.
- Funding platforms the owner lists (for example Ko-fi, Open Collective, GitHub Sponsors).
- Public API reference: `apps/api/src/README.md`; OpenAPI at `/v1/openapi.{json,yaml}`.
- **Absent and not to be fabricated:** testimonials, client logos, case studies, reader or subscriber counts, press mentions, and endorsements.

## Product Principles

1. **The reader comes first.** Homepage sections and conversion paths (contact, CV, funding) support the reading experience and never interrupt it.
2. **The site is the proof.** Every surface should show the engineering rigor the profile claims: secure, correct, fast, and honest about its data.
3. **Every page has a machine-readable twin.** Human and machine access are equal; nothing is human-only.
4. **The visitor controls presentation.** Theme, type scale, motion, contrast, and font are the visitor's choices, and the design holds up under all of them.
5. **Content is data.** Profile and content facts live in the database, not in templates. Design for real, variable-length data, including empty states.

## Accessibility & Inclusion

The visitor-side controls under Brand Commitments are product requirements. Full keyboard operability, visible focus, reduced-motion support, and legibility at 150% font scale and with the dyslexic-friendly font are required on every public surface.
