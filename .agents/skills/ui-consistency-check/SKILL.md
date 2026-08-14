---
name: ui-consistency-check
description: Check a new or changed Svelte component/page against this repo's existing design tokens, layout components, and shared UI primitives (Button, Dialog family, EmptyState, ErrorState, Toast, etc.) for consistency. Use after writing or editing anything under src/lib/components, src/lib/layout, or src/routes/**/*.svelte.
---

<!-- @format -->

# UI consistency check

This repo already has a well-stocked shared component library (`src/lib/components/`, ~60 primitives) and layout scaffolding (`src/lib/layout/`) plus design tokens in `src/lib/tokens.css`. New or edited UI code should reuse these rather than reinventing them — hardcoded fallbacks, missing empty states, ad-hoc dialogs, inconsistent typography, and inconsistent layout width are the recurring drift patterns to watch for in this codebase.

## Steps

1. **Identify the changed file(s)**: any `.svelte` file under `src/lib/components/`, `src/lib/layout/`, `src/lib/article/`, or `src/routes/**`.

2. **Design tokens**: grep the changed file for raw hex colors, arbitrary pixel values, or one-off font stacks. Compare against `src/lib/tokens.css` (`--color-*`, `--text-*`, `--font-*`). Flag any color/spacing/type value that duplicates an existing token instead of referencing it via Tailwind's `@theme` classes.

3. **Reuse before reinvent**: before any new inline markup for a common pattern, check whether an existing primitive already covers it:
   - Empty/error/loading states → `EmptyState.svelte`, `ErrorState.svelte`, `LoadingState.svelte`, `SkeletonBlock.svelte` (not a hand-rolled "no results" div).
   - Any modal/confirmation UI → `Dialog.svelte` + `DialogHeader`/`DialogBody`/`DialogFooter`/`DialogCloseButton`, or `ConfirmationDialog.svelte`/`AlertDialog.svelte` for confirm/alert flows — not a bespoke `<div class="fixed inset-0">`.
   - Form validation messaging → `FieldMessage.svelte`, `ErrorSummary.svelte`, `FormActions.svelte` — flag reliance on native browser validation (`required`, default constraint-validation popups) instead of these, per the design-spec punch list.
   - Page/section scaffolding → `AppShell.svelte`, `PageContainer.svelte`, `Section.svelte`, `FormSection.svelte`, `ListSection.svelte` rather than ad-hoc `<div>` wrappers with one-off max-width/padding.
   - Toasts/notifications → `Toast.svelte`, not a custom notification element.

4. **Hardcoded fallbacks**: grep for hardcoded display strings/placeholder data (e.g. a literal fallback name, image, or count) standing in for a loading/empty/error state that already has a dedicated component per step 3.

5. **Layout width consistency**: check that page-level containers use `PageContainer`/`ReadingContainer`/`Section` rather than a locally redeclared `max-w-*` + `mx-auto` combination, so widths stay consistent across pages.

6. **Svelte 5 runes**: confirm `$state`/`$derived`/`$props`/`$effect` are used (not Svelte 4 Options API or stores where a rune fits) — this is Svelte 5 throughout.

## Output

List findings as `file:line` — what's duplicated/inconsistent — which existing component/token to use instead. If the component already follows established patterns, say so explicitly rather than inventing findings.
