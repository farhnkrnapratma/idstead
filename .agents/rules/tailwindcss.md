---
trigger: always_on
description: Always prefer Tailwind CSS utility classes over custom CSS or stylesheet rules.
---

## Tailwind CSS

Always use **Tailwind CSS utility classes** for styling components, layouts, and elements instead of writing custom CSS rules or adding classes to stylesheets (`global.css`, `tokens.css`) or component `<style>` blocks.

Rules:

- **Prefer utility classes exclusively**: Express all styling, positioning, alignment, spacing, responsiveness, and pseudo-elements (e.g., `before:`, `after:`, `hover:`, `focus-visible:`) via Tailwind utility classes directly in the markup.
- **Arbitrary utilities over custom CSS**: When standard Tailwind utilities cannot express a specific value or selector, use Tailwind arbitrary values/variants (e.g. `[&::before]:[vertical-align:0]`, `[scrollbar-width:none]`) inline instead of creating new CSS classes or writing custom rules in `<style>` blocks or `global.css`.
- **Preserve global.css minimalism**: `global.css` is strictly reserved for the irreducible Tailwind entry point (`@import 'tailwindcss';`, `@import '../lib/tokens.css';`), third-party font imports, and base element resets. Never add component-specific or utility-replacing custom CSS rules into `global.css`.
- **Responsive design via prefixes**: Use Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) for all responsive adaptations.
- **Design tokens**: Use token classes (`bg-surface-card`, `text-copilot`, `border-border-subtle`, `font-sans-title`, etc.) provided by `tokens.css` via Tailwind utilities.
