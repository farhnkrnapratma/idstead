---
name: ui-consistency-check
description: Check a new or changed Svelte component/page against this repo's design tokens, layout primitives and shared UI components in @idstead/ui (Button, Dialog family, EmptyState, ErrorState, LoadingState, Toast, DataTable, …) for consistency. Use after writing or editing any .svelte file under packages/ui/src, packages/lib/src, packages/mdrs/*/src, apps/web/src or apps/admin/src.
---

# UI consistency check

The design system is the `@idstead/ui` package (`packages/ui/src`): `components/` (~45 primitives plus `filter/` controls), `layout/` (`PageMain`, `PageContainer`, `Section`, `FormSection`), `stores/` and `styles/` (`tokens.css` for the `--color-*`, `--text-*`, `--font-*` and `--container-*` tokens, and `global.css` for Tailwind and shared utilities). App-only components live in `apps/web/src/lib/` and `apps/admin/src/lib/` (imported as `#app/...`); components both apps use live in `packages/lib/src/components/`. New or edited UI should reuse these rather than reinvent them. The recurring drift patterns are hardcoded values, missing empty states, ad-hoc dialogs, inconsistent typography and inconsistent layout widths.

## Steps

1. **Identify the changed files**: every `.svelte` file in the diff (`git diff --name-only develop...HEAD -- '*.svelte'`, or the files you were given). Then list `packages/ui/src/components/` and `packages/ui/src/layout/`, so you know the full inventory before calling anything reinvented.

2. **Design tokens**: grep the changed files for raw hex colors, arbitrary pixel values (`[13px]`), or one-off font stacks. Compare against `packages/ui/src/styles/tokens.css`. Flag any value that duplicates a token instead of using its Tailwind class (`text-text-muted`, `bg-surface-card`, `border-border-subtle`, `max-w-2xs`, …). Widths from the `--container-*` scale follow the user's type scale, while raw rem values do not.

3. **Reuse before reinvent**: before any new inline markup for a common pattern, check whether a primitive already covers it:
    - Empty, error and loading states → `EmptyState`, `ErrorState`, `LoadingState`, `SkeletonBlock` (not a hand-rolled "no results" div).
    - Modals and confirmations → `Dialog` (sizes `2xs`, `sm` … `4xl`), or `ConfirmationDialog` for confirm flows, not a bespoke `<div class="fixed inset-0">`.
    - Tables and lists of records → `DataTable`, `Pagination`.
    - Forms → `FormField`, `Input`, `Textarea`, `Checkbox`, `FieldMessage`, `FormActions`. Flag reliance on native browser validation (a bare `required` attribute on the input, default constraint popups) instead of these; the `required` prop of `FormField` only draws the asterisk.
    - Buttons → `Button` (`type`, `size`, `htmlType`, `isLoading`, `leading`/`trailing` snippets) or `IconButton`; status → `StatusBanner`, `Tag`, `Badge`; dates → `RelativeTime`.
    - Page and section scaffolding → `PageMain` (`variant="site"`, `"article"` or `reading`), `PageContainer`, `Section`, `FormSection` rather than ad-hoc wrappers with one-off max-width or padding.
    - Notifications → `toastStore` from `@idstead/ui/stores/toastStore.svelte.ts`, not a custom element.

4. **Class merging**: `cn()` (`packages/ui/src/utils/cn.ts`) only de-duplicates radius, text size, overflow and display classes. A `class` prop that tries to override another family (for example `max-w-*` on a `Dialog`) leaves both classes in place, and the stylesheet order decides. Flag such overrides and point to the component's own prop (a `size`) or a new variant instead.

5. **Hardcoded fallbacks**: grep for literal display strings or placeholder data (a fallback name, image or count) standing in for a loading, empty or error state that has a dedicated component (step 3). Personal content must always come from the database (see `CLAUDE.md`).

6. **Layout width consistency**: page-level containers use `PageContainer`/`Section` rather than a locally redeclared `max-w-*` + `mx-auto`. Standalone admin pages (`/login`, `/oauth/authorize`) share one pattern: a centered `<main id="main">` with a `max-w-sm` content column.

7. **Accessibility basics**: every page with `id="main"` renders exactly one `SkipLink` (`tests/skipLink.test.ts` fails otherwise), icon-only buttons have an `aria-label`, and icons come from `@lucide/svelte` without deprecated names (`bun run lint:deprecated` catches them).

8. **Svelte 5 runes**: `$state`, `$derived`, `$props` and `$effect` are used, not the Svelte 4 Options API or a store where a rune fits. Run the Svelte MCP `svelte-autofixer` on each changed file.

## Output

List findings as `file:line` — what is duplicated or inconsistent — which existing component, prop or token to use instead. If a file already follows the established patterns, say so explicitly rather than inventing findings.
