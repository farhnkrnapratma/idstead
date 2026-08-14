<!-- @format -->

# Motion & transition system design

## Context

The site currently has zero meaningful motion: section switching (`activeSection` in `src/routes/+page.svelte`) is an instant `{#if}` swap, filter/sort list updates re-render keyed `{#each}` blocks with a hard cut, and blog-card → `/blog/[slug]` navigation is a plain SvelteKit route change with no transition. The only existing motion is four trivial `svelte/transition` `fade` usages on floating UI (toast, feedback FAB, scroll-to-top FAB, consent banner).

This spec covers two related but distinct asks, requested together:

1. **Hierarchy load motion** — content should cascade in (fade + slide-up, staggered) when it mounts: the hero on first paint, and each section's card grid (projects, blog) whenever that section mounts.
2. **A named transition system** for state/navigation changes, using the user's three categories, mapped onto Material Design 3's motion taxonomy (a close conceptual match):
   - **Context Transition** (tab switching, filters, general state update) → _Fade Through_
   - **Drill Transition** (list → item, feed → post) → _Shared Axis_
   - **Continuity Transition** (card → full screen, grid item → product page) → _Container Transform_

## Goals

- Every section switch, filter/sort change, and blog-post navigation gets an intentional, consistent transition.
- Card grids and the hero cascade in on mount, reusable across sections without per-section bespoke code.
- Everything respects the existing `data-reduce-motion` a11y setting (`src/lib/stores/a11yStore.svelte.ts` / `src/routes/global.css:41-53`) automatically wherever possible, with explicit JS checks only where the CSS override can't reach (View Transitions' `::view-transition-*` pseudo-elements live outside the normal DOM tree).
- Graceful, silent fallback on browsers without View Transitions support (Safari <18, older Firefox): state changes apply instantly, no errors, no broken UI.

## Non-goals

- No project-card "Continuity" target is built now — project cards only link out to GitHub today (no in-app detail page). The Continuity primitive is built generically (named `view-transition-name` pairing) so it's trivially reusable if a project detail page is added later, but the only concrete Continuity call site in this pass is the blog card → post title/cover image.
- No change to `activeSection`'s underlying mechanism (still a local `$state` + `window.location.hash` mirror, not a router). This spec only adds transition behavior around existing state changes, not a navigation-architecture rewrite.
- No cross-document View Transitions (SvelteKit is an SPA for the `/` sections; `/blog/[slug]` is a same-document client-side route change already handled by the router, so same-document View Transitions apply).

## Architecture

Two independent, composable primitives:

### 1. CSS stagger-in (hierarchy load motion)

Pure CSS `@keyframes`, no JS required for the animation itself (so it runs even before hydration, and is automatically neutralized by the existing global `[data-reduce-motion='true']` override). A small Svelte action assigns each direct child a `--stagger-i` index so the keyframe's `animation-delay` can be staggered via `calc()`.

- New action: `src/lib/actions/staggerChildren.ts` — `use:staggerChildren` walks `node.children` on mount and sets `style.setProperty('--stagger-i', String(index))` on each. Re-runs are unnecessary since the parent element itself remounts fresh (Svelte destroys/recreates DOM on `{#if}`/`{#each}` block changes), which is exactly the "entrance" moment we want to animate.
- New CSS (in `src/routes/global.css`, alongside the existing reduced-motion block): a `.stagger-children > *` rule with `animation: stagger-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--stagger-i, 0) * 70ms);` and the `@keyframes stagger-in { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }`.
- Applied via `use:staggerChildren` + `class="stagger-children"` on: the hero's content wrapper (`src/routes/+page.svelte`, inside `{#if activeSection === 'home'}`), the projects card grid, and the blog card grid (both inside their respective `{#if}` blocks). Each section mount — including the very first page load — replays the cascade.

### 2. View Transitions (Context / Drill / Continuity)

New utility: `src/lib/utils/viewTransition.ts` exporting `withViewTransition(update: () => void | Promise<void>, type?: 'context' | 'drill')`:

```
export function withViewTransition(update, type) {
  const reduceMotion = a11yStore.current.reduceMotion
  if (!document.startViewTransition || reduceMotion) {
    void update()
    return
  }
  const root = document.documentElement
  if (type) root.dataset.transitionType = type
  const transition = document.startViewTransition(async () => {
    await update()
    await tick()
  })
  transition.finished.finally(() => { delete root.dataset.transitionType })
}
```

CSS (new block in `global.css`) keyed off `data-transition-type` on `<html>` to give each category its own pseudo-element animation:

Every call site passes an explicit `type` — there is no untyped/default case:

- **Context** (`:root[data-transition-type='context'] ::view-transition-old(root)` / `::view-transition-new(root)`): Fade Through — old root fades out + scales down to ~92%, new root fades in + scales up from ~92%. Short duration (~200ms out, ~250ms in per MD3 guidance).
- **Drill** (`:root[data-transition-type='drill'] ::view-transition-old(root)` / `::view-transition-new(root)`): Shared Axis — old content slides out and fades on one axis (e.g. `translateX(-24px)`), new content slides in from the opposite side and fades in, implying forward motion into a detail view.
- **Continuity**: rides on top of the Drill transition at the same call site (blog navigation) rather than being a separate `type` — it's driven purely by matching `view-transition-name` values on the source/destination elements (see Continuity call site below), which the browser auto-morphs geometrically independent of the root-level `data-transition-type` styling. No custom keyframes required beyond the browser default (or a light custom easing on `::view-transition-group(post-cover-*)` if the default cross-fade-only morph feels too abrupt).

**Call sites:**

- **Context**: `navigate()` in `src/routes/+page.svelte` (the `activeSection` setter) wraps its body in `withViewTransition(() => { ...existing logic... }, 'context')`. Filter/sort changes — `useFilterSort.svelte.ts`'s `setSearch`/`toggleMultiFilter`/`setSort` mutate `$state` that feeds `filteredBlogPosts`/`filteredProjectList` ($derived.by, `+page.svelte:554-597` / `609-645`) — the call sites in the filter UI components (`FilterChipGroup`, `SortControl`, search input) wrap their `on...` handlers with `withViewTransition(() => storeMethod(...), 'context')` instead of calling the store method directly.
- **Drill**: `src/routes/+layout.svelte` gains an `onNavigate` hook (SvelteKit's documented View Transitions integration point) that calls `withViewTransition(() => resolve(), 'drill')` — but only for navigations into/out of `/blog/[slug]` (check `navigation.to?.route.id`/`navigation.from?.route.id` against the blog-post route), so home/admin/other navigations aren't affected by the Drill styling.
- **Continuity**: the blog card's cover-image element (`src/routes/+page.svelte`, blog card snippet) and title element get `style:view-transition-name="post-cover-{post.slug}"` / `post-title-{post.slug}"`; the corresponding elements in `src/routes/blog/[slug]/+page.svelte`'s article header get the same names keyed off the route's slug. Since slugs are unique, names never collide. Slugs must be validated as safe CSS `custom-ident` values (alphanumeric + hyphen; the existing slug format already satisfies this — confirm during implementation) since `view-transition-name` requires a valid CSS identifier.

## Reduced motion

- CSS stagger-in: covered for free by the existing `:root[data-reduce-motion='true'] *` override (animation-duration forced to 0.01ms).
- View Transitions: explicit JS check in `withViewTransition` (`a11yStore.current.reduceMotion`) before calling `document.startViewTransition`, mirroring the existing pattern in `GradientWaves.svelte:298/350` — necessary because `::view-transition-*` pseudo-elements aren't reachable by the universal-selector CSS override.

## Browser support / fallback

`withViewTransition` feature-detects `document.startViewTransition` and calls `update()` directly if absent — no animation, immediate state change, no errors. This is the existing baseline behavior today, so unsupported browsers see no regression. The CSS stagger-in has no browser-support caveat (plain `@keyframes`, supported everywhere).

## Testing / verification

- `bun run check` / `bun run lint`.
- Manual, in a Chromium-based browser (View Transitions support) and Firefox/older Safari (fallback path):
  - Home page first load: hero cascades in (avatar → name → tagline → description → buttons).
  - Switch Home → Projects → Blog via nav: outer Fade Through crossfade, inner card grids cascade in.
  - Change a filter/sort control on Blog or Projects: Fade Through crossfade on the list region.
  - Click a blog card: Shared Axis navigation into `/blog/[slug]`, with the card's cover image/title visibly morphing (Container Transform) into the post header.
  - Toggle "Reduce motion" in the accessibility settings panel: all of the above become instant, no visual glitches.
  - Firefox (or any browser without View Transitions): all state changes still work, just instantly, no console errors.
