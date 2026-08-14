<!-- @format -->

# Motion & Transition System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staggered "hierarchy" entrance animation to the hero and card grids, plus a named View Transitions system (Context / Drill / Continuity) for section switching, filter/sort changes, and blog-post navigation.

**Architecture:** Two independent, composable primitives — (1) a pure-CSS `@keyframes` stagger-in applied via a small Svelte action, requiring no JS gating since it's covered by the existing reduced-motion CSS override; (2) a `withViewTransition()` utility wrapping `document.startViewTransition()` with a `data-transition-type` attribute on `<html>` that CSS keys off of to render Fade Through (Context) vs Shared Axis (Drill) styling, plus `view-transition-name` pairing for Container Transform (Continuity) on the blog card→post title.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Tailwind CSS 4, native browser View Transitions API (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-08-14-motion-transitions-design.md`

## Global Constraints

- No test runner exists in this repo — `bun run check` (svelte-check/TypeScript) and `bun run lint` (prettier + eslint) are the correctness gates for every task, per `CLAUDE.md`. There is no "write a failing test first" step; each task's verification is `bun run check && bun run lint` plus a manual browser check where the task produces visible behavior.
- Never use `git add -A` / `git add .` — this repo has a large, unrelated pre-existing staged changeset (a repo restructure) sitting in the git index from before this work started. Every commit in this plan MUST stage explicit file paths only.
- Always sign commits: `git commit -s ...`.
- No comments in code except tool-directive ones (`/** @format */`, eslint/ts-expect-error directives) — matches this repo's existing style everywhere.
- Follow existing code style: no semicolons, single quotes, no trailing commas, 2-space indent, `/** @format */` pragma at the top of every new file.
- Two deviations from the spec, discovered during planning — both are narrowing/refinement, not scope changes:
  1. The blog post detail page (`src/routes/blog/[slug]/+page.svelte`) does not render its own cover image inline (the banner is only used in `<meta>` OG/Twitter tags) — there is no visual target for an image-morph Continuity transition. Continuity is implemented for the **post title only** (card `<h4>` → detail `<h1>`), not the cover image.
  2. Filter/sort store mutators are wrapped in the View Transition at the **store level** (`src/lib/stores/useFilterSort.svelte.ts`), not at each individual filter-control call site — this is a single, DRY change point instead of ~10 scattered wraps, and automatically covers both the blog and projects filter instances (same factory function). `setSearch` (called on every keystroke) is deliberately **not** wrapped — firing a transition per keystroke would be jarring; only discrete actions (toggling a filter, changing sort, clearing filters) get the Context transition.
- Existing action/util conventions to follow: Svelte actions live in `src/lib/utils/actions.ts` (see `autoResize`), plain utils live as their own file in `src/lib/utils/`, both re-exported through the `src/lib/index.ts` barrel (e.g. `export {autoResize} from './utils/actions'`).

---

### Task 1: CSS stagger-in keyframes + Svelte action

**Files:**

- Modify: `src/routes/global.css:53` (end of the existing `@layer base { ... }` block that already contains the `data-reduce-motion` override)
- Modify: `src/lib/utils/actions.ts` (add `staggerChildren` alongside the existing `autoResize`)
- Modify: `src/lib/index.ts` (barrel export)

**Interfaces:**

- Produces: CSS class `.stagger-children` (apply to a container; its direct children cascade in) and Svelte action `staggerChildren(node: HTMLElement)` — used as `use:staggerChildren` on the same container.

- [ ] **Step 1: Add the keyframes and utility class to `global.css`**

Insert immediately after line 53 (the closing `}` of the `:root[data-reduce-motion='true'] ::after` rule), still inside the outer `@layer base { ... }`:

```css
@keyframes stagger-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.stagger-children > * {
  animation: stagger-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--stagger-i, 0) * 70ms);
}
```

This sits inside the same `@layer base` block as the existing `:root[data-reduce-motion='true'] *` rule (`global.css:49-53`), so the universal-selector override with `!important` on `animation-duration` already neutralizes this animation for free when reduced motion is on — no extra CSS needed here.

- [ ] **Step 2: Add the `staggerChildren` action to `src/lib/utils/actions.ts`**

Append to the end of the file (after the existing `autoResize` function), matching its style (plain function, `return {destroy() {...}}`):

```ts
export function staggerChildren(node: HTMLElement) {
  const assignIndices = () => {
    Array.from(node.children).forEach((child, i) => {
      ;(child as HTMLElement).style.setProperty('--stagger-i', String(i))
    })
  }

  assignIndices()

  const observer = new MutationObserver(assignIndices)
  observer.observe(node, {childList: true})

  return {
    destroy() {
      observer.disconnect()
    }
  }
}
```

The `MutationObserver` handles the case where children render asynchronously after the action first runs (e.g. an `{#if}` inside the container resolving on the same tick) — `--stagger-i` gets (re)assigned whenever the child list changes, not just once at mount.

- [ ] **Step 3: Export it from the barrel**

In `src/lib/index.ts`, change:

```ts
export {autoResize} from './utils/actions'
```

to:

```ts
export {autoResize, staggerChildren} from './utils/actions'
```

- [ ] **Step 4: Verify**

Run: `bun run check && bun run lint` Expected: both pass with no new errors/warnings (no call sites use `staggerChildren` yet, so this task only adds dead code — that's expected and fine, the next tasks consume it).

- [ ] **Step 5: Commit**

```bash
git add src/routes/global.css src/lib/utils/actions.ts src/lib/index.ts
git commit -s -m "feat: add stagger-in CSS keyframes and staggerChildren action"
```

---

### Task 2: Apply stagger-in to the hero

**Files:**

- Modify: `src/routes/+page.svelte:1336` (hero content wrapper `<div>`)

**Interfaces:**

- Consumes: `staggerChildren` action from `$lib` (Task 1).

- [ ] **Step 1: Import the action**

In the big `$lib` destructured import block near the top of `src/routes/+page.svelte` (the one starting `import { LinkListSection, ShinyText, ... } from '$lib'`), add `staggerChildren` to the list (alphabetical placement isn't enforced elsewhere in this list, so just append it near the end before the closing `}`).

- [ ] **Step 2: Apply the action + class to the hero wrapper**

Current (`+page.svelte:1336-1337`):

```svelte
          <div
            class="relative mt-12 flex flex-col items-center justify-center rounded-sm glass-card border border-border-subtle/60 bg-surface-card/40 p-6 pt-0 text-center shadow-xl backdrop-blur-xl sm:p-8 sm:pt-0 dark:border-white/10 dark:bg-surface-card/30">
```

Change to:

```svelte
          <div
            use:staggerChildren
            class="stagger-children relative mt-12 flex flex-col items-center justify-center rounded-sm glass-card border border-border-subtle/60 bg-surface-card/40 p-6 pt-0 text-center shadow-xl backdrop-blur-xl sm:p-8 sm:pt-0 dark:border-white/10 dark:bg-surface-card/30">
```

This wrapper's direct children are (in order): the avatar `<ImageWithSkeleton>` (if present), the `<h1>` name, the headline `<p>` (if present), the description `<p>` (if present), and the CTA button `<div>` — exactly the avatar → name → tagline → description → buttons cascade order that was asked for. No further changes needed since the `{#if}`-gated children still count as direct children once rendered.

- [ ] **Step 3: Verify types/lint**

Run: `bun run check && bun run lint` Expected: pass.

- [ ] **Step 4: Manual browser verification**

Run `bun run dev`, open `/`, hard-reload. Expected: avatar, name, tagline, description, and buttons fade+slide up in a staggered cascade on load. Toggle "Reduce motion" in the accessibility menu (top nav → accessibility icon) and reload — expected: no animation, content appears instantly.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -s -m "feat: stagger hero content entrance on page load"
```

---

### Task 3: Apply stagger-in to the blog and project card grids

**Files:**

- Modify: `src/routes/+page.svelte:1966` (blog grid wrapper)
- Modify: `src/routes/+page.svelte:2068` (projects grid wrapper)

**Interfaces:**

- Consumes: `staggerChildren` (Task 1, already imported in Task 2).

- [ ] **Step 1: Blog grid**

Current (`+page.svelte:1966`):

```svelte
          <div class="relative z-0 mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
```

Change to:

```svelte
          <div
            use:staggerChildren
            class="stagger-children relative z-0 mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
```

- [ ] **Step 2: Projects grid**

Current (`+page.svelte:2068-2071`):

```svelte
          <div
            class="relative {openCodeMenuId ? 'z-40' : (
              'z-0'
            )} mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
```

Change to:

```svelte
          <div
            use:staggerChildren
            class="stagger-children relative {openCodeMenuId ? 'z-40' : (
              'z-0'
            )} mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
```

- [ ] **Step 3: Verify types/lint**

Run: `bun run check && bun run lint` Expected: pass.

- [ ] **Step 4: Manual browser verification**

Navigate to `/#blog` and `/#projects`. Expected: cards cascade in on each section mount (including switching back and forth — the `{#if activeSection === ...}` block remounts fresh each time, replaying the animation). Change a filter or page — expected: the newly-rendered page of cards also cascades in (since `{#each ... (key)}` swaps the DOM node set on pagination).

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -s -m "feat: stagger blog and project card grids on mount"
```

---

### Task 4: `withViewTransition` utility + Context/Drill CSS

**Files:**

- Create: `src/lib/utils/viewTransition.ts`
- Modify: `src/lib/index.ts` (barrel export)
- Modify: `src/routes/global.css` (new CSS block)

**Interfaces:**

- Produces: `withViewTransition(update: () => void | Promise<void>, type: 'context' | 'drill'): void` — the single entry point every Context/Drill call site (Tasks 5-6) uses. Internally reads `a11yStore.current.reduceMotion`.
- Consumes: `a11yStore` from `$lib/stores/a11yStore.svelte` (`.current.reduceMotion`, already established getter used elsewhere, e.g. `+page.svelte:1322`).

- [ ] **Step 1: Write `src/lib/utils/viewTransition.ts`**

```ts
/** @format */

import {tick} from 'svelte'
import {a11yStore} from '../stores/a11yStore.svelte'

export function withViewTransition(
  update: () => void | Promise<void>,
  type: 'context' | 'drill'
) {
  if (typeof document === 'undefined') {
    void update()
    return
  }

  if (!document.startViewTransition || a11yStore.current.reduceMotion) {
    void update()
    return
  }

  const root = document.documentElement
  root.dataset.transitionType = type

  const transition = document.startViewTransition(async () => {
    await update()
    await tick()
  })

  void transition.finished.finally(() => {
    delete root.dataset.transitionType
  })
}
```

- [ ] **Step 2: Export from the barrel**

In `src/lib/index.ts`, add a new line (near the other utility exports, e.g. after the `cn` export):

```ts
export {withViewTransition} from './utils/viewTransition'
```

- [ ] **Step 3: Add Context/Drill CSS to `global.css`**

Append after the `.stagger-children` block added in Task 1 (still inside `@layer base`):

```css
:root[data-transition-type='context']::view-transition-old(root) {
  animation: 200ms cubic-bezier(0.4, 0, 1, 1) both context-fade-out;
}

:root[data-transition-type='context']::view-transition-new(root) {
  animation: 250ms cubic-bezier(0, 0, 0.2, 1) both context-fade-in;
}

:root[data-transition-type='drill']::view-transition-old(root) {
  animation: 220ms cubic-bezier(0.4, 0, 1, 1) both drill-slide-out;
}

:root[data-transition-type='drill']::view-transition-new(root) {
  animation: 280ms cubic-bezier(0, 0, 0.2, 1) both drill-slide-in;
}

@keyframes context-fade-out {
  to {
    opacity: 0;
    transform: scale(0.92);
  }
}

@keyframes context-fade-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
}

@keyframes drill-slide-out {
  to {
    opacity: 0;
    transform: translateX(-24px);
  }
}

@keyframes drill-slide-in {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
}
```

Note: `::view-transition-*` pseudo-elements live in a top-layer overlay outside the normal document tree, so the existing `:root[data-reduce-motion='true'] *` selector (`global.css:49-53`) does **not** reach them — this is exactly why `withViewTransition` does its own `a11yStore.current.reduceMotion` check in JS before ever calling `document.startViewTransition` (Step 1), rather than relying on CSS.

- [ ] **Step 4: Verify**

Run: `bun run check && bun run lint` Expected: pass. No call sites use `withViewTransition` yet — expected, consumed starting Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/viewTransition.ts src/lib/index.ts src/routes/global.css
git commit -s -m "feat: add withViewTransition utility with Context/Drill CSS"
```

---

### Task 5: Wire the Context transition into section switching

**Files:**

- Modify: `src/routes/+page.svelte:503-509` (`navigate` function)

**Interfaces:**

- Consumes: `withViewTransition` from `$lib` (Task 4).

- [ ] **Step 1: Import `withViewTransition`**

Add to the same `$lib` destructured import block as Task 2's `staggerChildren` addition.

- [ ] **Step 2: Wrap the section-switch state change**

Current (`+page.svelte:503-509`):

```ts
function navigate(section: Section) {
  activeSection = section
  menuOpen = false
  if (typeof window !== 'undefined') {
    window.location.hash = section === 'home' ? '' : section
  }
}
```

Change to:

```ts
function navigate(section: Section) {
  withViewTransition(() => {
    activeSection = section
    menuOpen = false
    if (typeof window !== 'undefined') {
      window.location.hash = section === 'home' ? '' : section
    }
  }, 'context')
}
```

- [ ] **Step 3: Verify**

Run: `bun run check && bun run lint` Expected: pass.

- [ ] **Step 4: Manual browser verification**

Click between nav items (Home → Projects → Blog → CV → Funding → Contact). Expected: each switch does a quick fade+scale crossfade (Fade Through) of the whole page content, and the newly-mounted section's card grid (if any) still cascades in underneath it (Task 3's effect nests inside the Context crossfade). Toggle reduced motion — expected: instant switching, no crossfade.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -s -m "feat: wrap section navigation in Context view transition"
```

---

### Task 6: Wire the Context transition into filter/sort changes

**Files:**

- Modify: `src/lib/stores/useFilterSort.svelte.ts`

**Interfaces:**

- Consumes: `withViewTransition` from `../utils/viewTransition` (Task 4). This is a `.svelte.ts` module outside `$lib`'s own barrel-consuming code, so import it directly by relative path, not via `$lib`.
- Produces: same public store shape as before (`setSearch`, `setSingleFilter`, `toggleMultiFilter`, `removeFilter`, `clearAllFilters`, `setSort`, `toggleSortDirection` — signatures unchanged, only their internals change).

- [ ] **Step 1: Import the utility**

At the top of `src/lib/stores/useFilterSort.svelte.ts`, add:

```ts
import {withViewTransition} from '../utils/viewTransition'
```

- [ ] **Step 2: Wrap the discrete-action mutators (not `setSearch`)**

Change each of these five functions (`useFilterSort.svelte.ts:68-133`) to wrap their body in `withViewTransition(..., 'context')`, keeping `syncToUrl()` inside the wrapped callback so the URL update happens as part of the same transition. `setSearch` (`:63-66`) is left untouched — it fires on every keystroke and must stay instant.

Current `setSingleFilter` (`:68-77`):

```ts
function setSingleFilter(type: string, value: string) {
  if (!value || value === 'all') {
    const next = {...filters}
    delete next[type]
    filters = next
  } else {
    filters = {...filters, [type]: [value]}
  }
  syncToUrl()
}
```

Change to:

```ts
function setSingleFilter(type: string, value: string) {
  withViewTransition(() => {
    if (!value || value === 'all') {
      const next = {...filters}
      delete next[type]
      filters = next
    } else {
      filters = {...filters, [type]: [value]}
    }
    syncToUrl()
  }, 'context')
}
```

Apply the identical wrapping pattern (move the existing body as-is into the `withViewTransition(() => { ... }, 'context')` callback, no other logic changes) to:

- `toggleMultiFilter` (`:79-94`)
- `removeFilter` (`:96-107`)
- `clearAllFilters` (`:109-114`)
- `setSort` (`:116-125`)
- `toggleSortDirection` (`:127-133`)

- [ ] **Step 3: Verify**

Run: `bun run check && bun run lint` Expected: pass — the store's public return shape (`:202-230`) is unchanged, so no consumer (`+page.svelte`'s `blogFilterStore`/`projectFilterStore` usage, `FilterChipGroup`, `SortControl`, `FilterCheckboxGroup`) needs any changes.

- [ ] **Step 4: Manual browser verification**

On `/#blog` or `/#projects`: type in the search box — expected instant, no flicker. Toggle a tag filter chip, change the sort field/direction, click "Clear all" — expected: each of those triggers a quick Fade Through crossfade of the list region (and the whole page, per Task 5's root-level styling, since this reuses the same `data-transition-type='context'` CSS). Toggle reduced motion — expected: instant for all of the above.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/useFilterSort.svelte.ts
git commit -s -m "feat: wrap filter/sort mutations in Context view transition"
```

---

### Task 7: Wire the Drill transition into blog navigation

**Files:**

- Modify: `src/routes/+layout.svelte`

**Interfaces:**

- Consumes: `onNavigate` from `$app/navigation`, `a11yStore` (already imported).

`onNavigate`'s contract is distinct from `withViewTransition` (it must return a `Promise` that SvelteKit awaits before completing the navigation, resolved from inside the `document.startViewTransition` update callback, and the callback must await `navigation.complete` — the promise SvelteKit provides that resolves once the new page's DOM is actually in place — not `tick()`, which only flushes Svelte's own pending state and would risk capturing a stale "new" snapshot) — so this task talks to `document.startViewTransition` directly rather than reusing `withViewTransition`, mirroring the same reduced-motion-check + `data-transition-type` pattern established in Task 4.

- [ ] **Step 1: Add the import**

In `src/routes/+layout.svelte`'s script block, add this line alongside the existing imports (no change needed to the existing `import {onMount} from 'svelte'` line):

```ts
import {onNavigate} from '$app/navigation'
```

- [ ] **Step 2: Add the `onNavigate` hook**

Add this after the `onMount(...)` block (`+layout.svelte:47-55`), still inside `<script>`:

```ts
const BLOG_POST_ROUTE_ID = '/blog/[slug]'

onNavigate(navigation => {
  if (!document.startViewTransition || a11yStore.current.reduceMotion) return

  const isBlogPostTransition =
    navigation.to?.route.id === BLOG_POST_ROUTE_ID
    || navigation.from?.route.id === BLOG_POST_ROUTE_ID
  if (!isBlogPostTransition) return

  return new Promise(resolve => {
    const root = document.documentElement
    root.dataset.transitionType = 'drill'
    const transition = document.startViewTransition(async () => {
      resolve()
      await navigation.complete
    })
    void transition.finished.finally(() => {
      delete root.dataset.transitionType
    })
  })
})
```

`onNavigate` is a SvelteKit lifecycle function called directly in the component body (like `onMount`, not inside it) — it registers itself once and is called by the router on every client-side navigation. Only navigations into or out of the blog-post route get the Drill treatment; everything else (e.g. `/` ↔ `/admin`) navigates normally with no transition. Calling `resolve()` first lets SvelteKit proceed with swapping in the new page's DOM; awaiting `navigation.complete` afterward holds the View Transition's "update" callback open until that swap has actually finished, which is what the browser needs before it can capture the "new" snapshot correctly.

- [ ] **Step 3: Verify**

Run: `bun run check && bun run lint` Expected: pass.

- [ ] **Step 4: Manual browser verification**

From `/#blog`, click a blog card's "Read post" link. Expected: a Shared Axis slide+fade transition into `/blog/[slug]`. Click "Home" breadcrumb or browser back — expected: the reverse navigation also gets the Drill treatment (both `to` and `from` are checked). Navigate from `/` to `/admin` (or any non-blog route) — expected: no transition, instant navigation, unaffected by this change. Toggle reduced motion and repeat the blog-card click — expected: instant, no transition.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte
git commit -s -m "feat: wrap blog post navigation in Drill view transition"
```

---

### Task 8: Continuity — blog card title morphs into post title

**Files:**

- Modify: `src/lib/article/ArticleHeader.svelte` (new optional prop)
- Modify: `src/routes/+page.svelte` (blogPostCard snippet, `:1204-1212`)
- Modify: `src/routes/blog/[slug]/+page.svelte` (`ArticleHeader` usage, `:538`)

**Interfaces:**

- `ArticleHeader` gains `titleViewTransitionName?: string`, applied as an inline `style` on its internal `<h1>`. All other props/behavior unchanged — existing callers that don't pass it are unaffected.

- [ ] **Step 1: Add the prop to `ArticleHeader.svelte`**

Current:

```svelte
  interface Props {
    title: string
    excerpt?: string
    class?: string
    meta?: Snippet
  }

  let {title, excerpt = '', class: className = '', meta}: Props = $props()
```

Change to:

```svelte
  interface Props {
    title: string
    excerpt?: string
    class?: string
    titleViewTransitionName?: string
    meta?: Snippet
  }

  let {
    title,
    excerpt = '',
    class: className = '',
    titleViewTransitionName = '',
    meta
  }: Props = $props()
```

And change the `<h1>`:

```svelte
<!-- @format -->
<h1
  class="font-sans text-3xl leading-tight font-bold tracking-tight text-text-primary md:text-4xl">
  {title}
</h1>
```

to:

```svelte
<!-- @format -->
<h1
  style={titleViewTransitionName ?
    `view-transition-name: ${titleViewTransitionName}`
  : undefined}
  class="font-sans text-3xl leading-tight font-bold tracking-tight text-text-primary md:text-4xl">
  {title}
</h1>
```

- [ ] **Step 2: Set the name on the blog card's title (`+page.svelte`)**

Current (`+page.svelte:1204-1212`):

```svelte
<!-- @format -->
<div class="mt-1">
  <h4 class="text-lg leading-snug font-bold text-text-primary">
    <a
      href="/blog/{post.slug}"
      class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
      {post.title}
    </a>
  </h4>
</div>
```

Change to:

```svelte
<!-- @format -->
<div class="mt-1">
  <h4
    style="view-transition-name: post-title-{post.slug}"
    class="text-lg leading-snug font-bold text-text-primary">
    <a
      href="/blog/{post.slug}"
      class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
      {post.title}
    </a>
  </h4>
</div>
```

`post.slug` is already used elsewhere as a URL segment (`href="/blog/{post.slug}"` on the very next line), so it's already known to be a URL-safe string; slugs in this codebase are lowercase-hyphenated (confirm by inspecting a couple of real slugs via the admin UI or Supabase `db_posts` table if in doubt) which is already a valid CSS `custom-ident`. If a slug is ever found to contain characters outside `[a-z0-9-]`, that's a pre-existing data issue independent of this feature — not handled here.

- [ ] **Step 3: Set the matching name on the detail page (`blog/[slug]/+page.svelte`)**

Current (`:538`):

```svelte
      <ArticleHeader title={post.title}>
```

Change to:

```svelte
      <ArticleHeader
        title={post.title}
        titleViewTransitionName="post-title-{post.slug}">
```

- [ ] **Step 4: Verify**

Run: `bun run check && bun run lint` Expected: pass.

- [ ] **Step 5: Manual browser verification**

From `/#blog`, click a post's title/card. Expected: the clicked card's title visibly morphs (grows/repositions) into the detail page's `<h1>` as part of the Drill transition from Task 7, rather than just cross-fading like the rest of the page. Try it with two different posts to confirm no `view-transition-name` collision errors appear in the console (each slug is unique, so each transition only ever has one instance of a given name on screen at a time). Toggle reduced motion and repeat — expected: instant navigation, no morph (Task 7's guard already skips `document.startViewTransition` entirely, so the `view-transition-name` styles are simply inert).

- [ ] **Step 6: Commit**

```bash
git add src/lib/article/ArticleHeader.svelte src/routes/+page.svelte "src/routes/blog/[slug]/+page.svelte"
git commit -s -m "feat: add Continuity transition for blog post title"
```

---

### Task 9: Full integration pass

**Files:** none (verification only)

- [ ] **Step 1: Full check/lint**

Run: `bun run check && bun run lint` Expected: zero errors, zero new warnings.

- [ ] **Step 2: End-to-end manual pass in a Chromium browser**

Run `bun run dev`, open `/`:

- First load: hero cascades in.
- Home → Projects → Blog → CV → Funding → Contact via nav: each switch does a Context crossfade; Projects/Blog card grids cascade in underneath.
- On Blog or Projects: toggle a filter chip, change sort, clear filters, and type a search query — filters/sort/clear get a Context crossfade, typing does not.
- Click a blog card: Drill slide transition into `/blog/[slug]`, with the title visibly morphing (Continuity). Use back button: reverse Drill transition.
- Navigate `/` → `/admin/login` directly (type the URL): no transition (Drill only applies to the blog-post route).

- [ ] **Step 3: Reduced motion pass**

Open the accessibility settings panel (top nav icon), enable "Reduce motion". Repeat the entire Step 2 pass. Expected: every animation/transition above becomes instant, no visual glitches, no console errors.

- [ ] **Step 4: Cross-browser fallback pass**

Same pass in Firefox (or any browser without `document.startViewTransition`). Expected: all state changes and navigations still work, just instantly — no console errors, no broken layout. The CSS stagger-in (Tasks 2-3) still animates normally in Firefox since it's plain CSS, independent of View Transitions support.

- [ ] **Step 5: Final commit (if Step 2-4 surfaced any fixes)**

If any fixes were needed during manual verification, stage only the specific files touched and commit:

```bash
git add <specific files>
git commit -s -m "fix: <describe the fix>"
```

If no fixes were needed, this task produces no commit — it's a verification-only checkpoint.
