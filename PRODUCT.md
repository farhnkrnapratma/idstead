# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: engineers and technical readers.** Peers who arrive for the blog, read posts end to end, return, and may subscribe to the newsletter, comment, react ("helpful"), follow the Atom feed, or consume content through the public API, `.md`/`.txt` variants, or `llms.txt`. When trade-offs arise, this reader's needs win.

Secondary audiences, served by the homepage sections without displacing the reader:

- People evaluating the author for work or collaboration (CV, projects, skills, contact).
- Supporters who back the work through the funding links.

**Admin operator.** `admin.fkp.my.id` has exactly one user: the site owner, authenticated with MFA or a passkey, writing and publishing posts, moderating comments, and maintaining profile data.

## Product Purpose

fkp.my.id is the personal site and blog of Farhan Kurnia Pratama, a software engineer working across software engineering, AI engineering, UI/UX research, and cybersecurity. It publishes long-form technical writing and presents the author's profile, projects, CV, funding, and contact channels.

Success, in no fixed order:

- **Readership and subscribers:** posts are read, readers return, newsletter subscriptions grow.
- **Opportunities and contact:** the site leads to messages, work or client conversations, and CV downloads.
- **Credibility as proof:** the site's own engineering (security posture, public API, craft) demonstrates the skills the profile claims.
- **Support and funding:** visitors become sponsors or backers.

## Positioning

The site is itself the portfolio piece: a security-focused engineer's blog whose content is equally available to humans and machines (public read-only REST API, OpenAPI, Markdown and plain-text variants, feeds, `.well-known` discovery, `llms.txt`), built with visitor-controlled accessibility and keyboard-first navigation. A template blog cannot claim these as its own work.

## Operating Context

- **Public site (`fkp.my.id`):** a single-page homepage with anchored sections (home, projects, blog, CV, funding, contact) showing the five newest posts; `/blog` index with search, tag filter, sort, and pagination; post pages with table of contents, references, comments, and helpful feedback; legal pages (privacy, terms, security); subscribe/unsubscribe flows.
- **Reading formats:** every post and legal page also exists as `.md` and `.txt`; content is reachable through `api.fkp.my.id/v1`, Atom, sitemap, and `llms.txt`.
- **Posts** are written in the project's own Markdown dialect (callouts, tabs, snippets, steps, details, embeds, KaTeX math, filenamed and line-marked code blocks, references) and rendered server-side through an allowlist sanitizer.
- **Newsletter:** publishing a post enqueues delivery to subscribers by email (Resend).
- **Contact:** a Turnstile-protected contact form, plus email (with GPG fingerprint), IRC (Libera.Chat), and Matrix.
- **Admin portal:** dashboard, post editor (`/new`), comment moderation, and profile management, used by one person.
- Interface language is English. The author is based in Palembang, Indonesia.

## Capabilities and Constraints

- SvelteKit 5 + Tailwind CSS 4 on Cloudflare Workers; all UI comes from the shared `packages/lib` component and layout primitives. Pages reuse them rather than building one-off replacements.
- **All profile content is data, never hardcoded:** name, bio, headline, CV, skills, funding, contact, and socials come from Supabase. Projects come from the author's GitHub repositories, filtered by pinned/excluded rules stored in Supabase.
- Comments are moderated by Llama Guard 3; when moderation is unavailable, the comment is rejected rather than published unchecked.
- Public output never exposes database IDs; posts are identified by an immutable 64-hex public ID or slug.
- The public API is read-only and versioned (`/v1`); breaking changes require a new version.
- Light and dark themes are both supported and visitor-selectable.
- The CV is downloadable as PDF with a SHA-256 checksum file.

## Brand Commitments

- **Name and identity:** Farhan Kurnia Pratama, username `farhnkrnapratma`, domain `fkp.my.id`. Avatar and identity assets are served from the site.
- **Machine-readable by default:** every human-facing page keeps a machine-readable counterpart (`.md`/`.txt`, API, feeds, `llms.txt`, `.well-known`). New content surfaces must ship with one.
- **Accessibility controls:** visitors can adjust font scale (100–150%), reduce motion, use solid surfaces, raise text contrast, highlight focus rings, and switch to a dyslexic-friendly font. New UI must respect every one of these settings.
- **Keyboard-first navigation:** on the public site, shortcuts, spotlight/command search, and the shortcut catalog are core to the experience; new public UI must be fully keyboard-operable and fit the shortcut system. The admin portal has no keyboard shortcuts by design, but every admin control must still be fully keyboard-operable.

## Evidence on Hand

- Live author profile, CV, skills, funding links, and contact channels via `GET https://api.fkp.my.id/v1/author` (sourced from Supabase).
- Published blog posts and their comments and helpful counts (Supabase, exposed through `/v1/blog`).
- GitHub repositories surfaced as projects, with real stars and forks.
- Funding platforms: Ko-fi, Open Collective, GitHub Sponsors.
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
