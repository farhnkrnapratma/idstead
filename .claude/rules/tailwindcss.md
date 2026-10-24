---
paths:
    - '**/*.svelte'
    - '**/*.css'
---

# Tailwind CSS

Style with Tailwind CSS 4 utility classes in the markup instead of custom CSS rules.

- Express layout, spacing, states (`hover:`, `focus-visible:`), pseudo-elements (`before:`, `after:`) and breakpoints (`sm:` … `2xl:`) as utilities.
- When no standard utility fits, use an arbitrary value or variant inline (`[&::before]:align-[0]`) before writing a `<style>` block. A component `<style>` block is only for what utilities cannot express (complex selectors, keyframes); it starts with `@reference` to the shared stylesheet.
- Use the design tokens from `packages/ui/src/styles/tokens.css` through their utilities (`bg-surface-card`, `text-text-muted`, `border-border-subtle`, `text-accent-text`, `max-w-2xs` from the `--container-*` scale) instead of raw colors or pixel values.
- `packages/ui/src/styles/global.css` holds only the Tailwind entry, font imports, tokens, base resets and the few shared utilities (`dashed-surface`, `glass-card`, …). Do not add component-specific rules there.
- `cn()` (`packages/ui/src/utils/cn.ts`) merges only radius, text size, overflow and display classes; to change a component's width or color, use its props or add a variant rather than passing a competing class.
