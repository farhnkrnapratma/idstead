# Footer, admin console, and site-wide consistency fixes

Date: 2026-08-05
Status: Approved

## Context

A punch list of 17 inconsistency/bug reports spanning the public footer, admin
console, form validation, dialogs, typography, and layout width. Each item
was root-caused against the current codebase before this spec was written
(see "Investigation notes" under each item) — this is not speculative design,
it is a fix list grounded in specific files/lines.

The 17 source items are grouped into 8 workstreams below, ordered so that
foundational fixes (data layer, then admin UX) land before cosmetic/typography
polish.

## Workstream A — Footer & author-derived data consistency (item 1)

**Problem:** `src/lib/layout/FooterSection.svelte` hardcodes a headline
fallback (`'Software Engineer'`) and a `defaultSocials` array (GitHub,
LinkedIn, X, Facebook, Instagram, Threads with real URLs). These render
whenever `pageAuthor.headline`/`pageAuthor.socialLinks` are empty — so
deleting the author profile or social links in Supabase has no visible effect
on the footer. Separately, `src/routes/privacy/+page.svelte` computes its own
`name` fallback (`'This website'`) instead of delegating to `FooterSection`,
duplicating logic that then drifts.

**Fix:**
- Remove `defaultSocials` and the `'Software Engineer'` string fallback from
  `FooterSection.svelte` entirely.
- When `resolvedHeadline`/`resolvedDescription` are empty, hide that line
  (same pattern already used for `resolvedNavItems.length > 0`).
- When `resolvedSocials` is empty, hide the entire social-icons row (not just
  render zero icons in an empty flex container).
- `privacy/+page.svelte`: stop computing its own `name` fallback; pass
  nothing extra and let `FooterSection` resolve `pageAuthor` itself, matching
  how `blog/[slug]` and `+page.svelte` already do it.
- Name itself keeps no hardcoded fallback either — if `pageAuthor.name` is
  empty, the name line is empty (consistent with "don't invent data").

## Workstream B — Empty-state placeholders (item 2)

**Problem:** `EmptyState` exists and is used for the blog post list only.
Confirmed missing in:
- Public site: Home's "Featured projects" widget, CV section's
  Experience/Education/Skills lists, Contact & Funding sections (both render
  through the shared `LinkListSection` component).
- Admin console: Experience, Education, Skills, Contact, Funding lists (Posts
  already has `EmptyState`).

**Fix:** Add `EmptyState` (icon + title + description) to each of the above
when its backing array is empty, matching the blog list's pattern. Since
Contact and Funding share `LinkListSection`, add an `EmptyState` there once
with distinct copy per usage (`title`/`description` passed as props by the
caller, e.g. "No contact channels yet" vs "No funding platforms yet") — this
was confirmed in Q1.

## Workstream C — Download CV button disabled state (item 3)

**Problem:** Both Home hero and CV section render `<a href="/api/v1/cv"
download>` unconditionally. `+page.server.ts` never loads whether an active
CV document exists, so there's no signal to disable the button.

**Fix:**
- `+page.server.ts` load function: fetch CV existence (reuse
  `fetchActiveCvDocument` from `src/lib/author.ts`) and return `cvExists:
  boolean` in page data.
- Both Download CV buttons (Home hero, CV section) become disabled
  (non-interactive, visually muted, no `href`/`download`) when `!cvExists`.

## Workstream D — Admin console UX fixes (items 4, 5, 6, 7, 8)

**D1 — Remove card hover effect (#4).** In `admin/+page.svelte`'s Posts card
(`activeAdminTab === 'posts'` list), remove `hover:bg-surface-hover/40` from
the card wrapper and `group-hover:scale-103`/`transition-transform
duration-300` from the banner image.

**D2 — Move Delete next to Save in Profile section (#5).** Current layout
(`justify-between`) puts Delete Profile at the far left and Save Profile at
the far right of the same row. Change to a single right-aligned button
cluster: `[unsaved-changes text] [Delete Profile] [Save Profile]`.

**D3 — Fix CV Document CRUD errors + redesign (#6).**
- Root cause (confirmed): `src/lib/supabaseFunctions.ts`
  `proxyToSupabaseEdgeFunction` forwards the incoming request's body
  (`request.body`, a `ReadableStream`) to an outbound `fetch()` call without
  `duplex: 'half'`. Modern fetch implementations (Workers runtime, Node 18+
  undici) throw when a streamed body is passed without this flag. This proxy
  is used **only** by CV upload/delete — no other admin CRUD goes through it
  — which is exactly why only the CV Document section errors. Fix: add
  `duplex: 'half'` to the outbound `fetch()` call when a body is present.
- Layout: change the CV Document section from inline to block layout so the
  filename is shown in full (no truncation), without altering the surrounding
  section's place in the page.
- Upload button label: rename from "Upload & Publish" to **"Upload CV
  Document"**.
- Checksum field: add a label (e.g. "SHA-256 checksum") so it reads as an
  identified value, not an unexplained string.
- Suggestion (confirmed via Q2): add a small info card showing the *current*
  active CV's metadata (filename, upload date, checksum) above the upload
  form when one exists, so admin can see what's live before replacing/
  deleting it. This data is already available in `cvDocState`; no new fetch
  needed.

**D4 — Skills comma-escape hint (#7).** Current: `FormField hint="Type \, to
insert a literal comma inside a skill name."` renders as plain text (no HTML
support in `FormField`'s `hint` string prop). Fix:
- Add a `hintSnippet` slot (or extend `FormField` to accept a `Snippet` for
  the hint area) so `\,` can be wrapped in the same inline-code style used
  elsewhere (`<code>`-like pill, not a plain string).
- Simplify wording and prefix with a note that the field above is
  comma-separated, e.g.: "Comma-separated. Use `\,` to include a literal
  comma in a skill name." (exact copy finalized during implementation).

**D5 — "Unsaved changes" indicator on all non-Posts sections (#8, confirmed
via Q4).** Only Profile tracks dirty state today (`authorIsDirty` computed
against an `authorInitial` snapshot taken after load/save). CV, Skills,
Contact, and Funding have no dirty-tracking.
- Add the same mechanism to each: an `*Initial` snapshot (`$state`, set on
  load and after successful save) + an `*IsDirty` `$derived` comparing
  current state to the snapshot via `JSON.stringify` equality (consistent
  with these being plain arrays of plain objects).
- Render "You have unsaved changes." next to each section's Save button when
  dirty (matching Profile's existing text placement), and disable Save when
  not dirty.
- Remove the separate "Unsaved changes" pill/badge that currently sits above
  the Profile form (the one with the dot icon) — the inline text next to Save
  is the only indicator going forward, for consistency across all sections.
- Posts is explicitly excluded (its "unsaved" concept doesn't apply the same
  way — post drafts are saved via the dedicated new/edit page).

## Workstream E — Form validation overhaul (item 9, confirmed via Q3)

**Problem:** `admin/+page.svelte` has 78 native `required` attributes (plus
`type="email"`) and `admin/new/+page.svelte` has 8; both rely on the
browser's built-in validation UI. `admin/login/+page.svelte` and
`feedback/+page.svelte` already implement the target pattern: debounced
per-field regex/logic validation (`validateXField`, 500ms debounce),
`FormField`/`Input` `error`/`valid` props for inline feedback, and a
synchronous `validate()` gate on submit — no native `required`/`type=email`/
`type=url`.

**Fix (confirmed full coverage, not partial):** Apply the login/feedback
pattern to every form in `admin/+page.svelte` (Profile, Skills, Experience,
Education, Contact, Funding, CV upload) and `admin/new/+page.svelte` (post
editor):
- Remove all native `required`, `type="email"`, `type="url"` attributes.
- For each required/typed field, add a debounced field-level validator
  function and a submit-time `validate()` aggregator, following the existing
  `emailRegex`-style pattern from `admin/login`.
- Reuse `FormField`'s existing `error`/`valid` props — no new UI primitives
  needed.
- This is mechanical but large; the implementation plan will batch it form
  by form rather than as one diff.

## Workstream F — Error handling & dialogs (items 11, 12)

**F1 — `[object Object]` toast (#11).** Confirmed single occurrence:
`admin/login/+page.svelte` does `throw new Error(result.error || '...')`
where `result.error` is the `{code, message, details}` object from the
`/api/v1` error envelope (per `apiError()` / `hooks.server.ts`), not a
string. Fix: `throw new Error(result.error?.message || '...')`. (Grepped the
rest of the codebase for the same pattern — no other instances found.)

**F2 — Replace native `confirm()` with `ConfirmationDialog` (#12).** Exactly
2 usages, both in `admin/+page.svelte`: `handleClearAuthor` (Delete Profile)
and `handleDeleteCvDoc` (Delete CV document). Both already have a reusable
`src/lib/components/ConfirmationDialog.svelte`. Fix: replace both
`confirm(...)` calls with the component (open state + confirm callback),
matching how dialogs are used elsewhere in the app (e.g. the post-delete
confirmation already does this for Posts).

## Workstream G — Typography (items 13, 14)

**G1 — Inline code padding/sizing (#13).** `src/lib/article/Prose.svelte`
sets `[&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs` — fixed padding and a
font size independent of surrounding text. Fix: reduce padding (e.g. to
`px-1 py-0`) and drop the fixed `text-xs` so inline code inherits the
surrounding text's size. This also applies to the Skills hint's `\,` styling
from D4, so both use the same inline-code treatment.

**G2 — Unify article/table/code font sizes (#14).** Current: body text
`text-base` (16px), table th/td `text-xs sm:text-sm`, `<pre>`/code blocks
`text-xs` (12px) — three different sizes on one page. Fix: standardize the
whole article body (`Prose.svelte` base class, `layout.css`
`.prose-custom table/th/td`, and `[&_pre]`) around a single consistent size
(`text-sm`, 14px) — not as large as the current body text, not as small as
the current code blocks.

## Workstream H — Layout consistency (items 15, 16, 17)

**H1 — Admin blog card action row overflow (#15).** Current action row is
`flex flex-wrap justify-between` with a 3-button left group (Edit, Show
comments, Publish/Unpublish) and a 1-button right group (Delete). On narrow
screens, when the row wraps, Delete drops to its own line but stays
left-aligned rather than filling the width. Fix: when wrapped, the Delete
button's row should stretch full width, and the 3-button group above it
should distribute with `justify-between` internally instead of clustering
left. Exact Tailwind breakpoint/utility choice finalized during
implementation (no new component needed).

**H2 — Comment-expand shouldn't resize sibling card (#17).** Confirmed cause:
the Posts grid (`grid grid-cols-1 md:grid-cols-2`) uses CSS Grid's default
`align-items: stretch`, so expanding one card's comments (taller) stretches
its row-sibling to match height. Fix: add `items-start` to the grid container
so each card sizes independently of its row-sibling.

**H3 — Page width consistency with footer (#16).** Footer uses
`md:w-[80%] lg:w-[60%] xl:w-[50%]`. Blog and Projects sections on the main
page already match this. Confirmed **not** matching (all currently
`md:w-[80%] lg:w-[50%]`, missing the `lg:w-[60%]` step):
- Home hero section (`+page.svelte`)
- CV section (`+page.svelte`)
- `LinkListSection.svelte` (used by both Contact and Funding)
- `privacy/+page.svelte`
- `feedback/+page.svelte`

Fix: change all five to `md:w-[80%] lg:w-[60%] xl:w-[50%]` to match the
footer exactly.

## Out of scope

- `src/lib/layout/PageContainer.svelte` has its own width variants but is
  currently unused by any route — left untouched (dead code, not part of
  this request).
- No new reusable UI components are introduced; every fix reuses existing
  primitives (`EmptyState`, `ConfirmationDialog`, `FormField`).
- No database schema changes.

## Testing / verification

- No test runner in this repo; `bun run check` (types) and `bun run lint`
  are the correctness gates per `CLAUDE.md`, run after each workstream.
- Workstream E (validation) and D3 (CV CRUD) need manual verification in the
  admin UI via the dev server, since browser-native validation bypass and
  the edge-function proxy fix aren't type-checkable.
