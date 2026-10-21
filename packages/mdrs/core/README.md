# @mdrs/core

The MDRS (Markdown Rich Syntax) engine. It turns MDRS source into sanitized HTML and has no dependency on Svelte, SvelteKit, Supabase or any other workspace package.

```ts
import { prepareMarkdownPage, renderMarkdown, validateDefineForSave } from '@mdrs/core';
import { convertLegacyMarkdown } from '@mdrs/core/legacy';

const html = await renderMarkdown(source);
const { html: page, headings } = await prepareMarkdownPage(source, resolvers);
const { ok, errors } = await validateDefineForSave(source, resolvers);
```

`resolvers` (an `ApiRegistry`) supplies the live data behind `api.v1.author` and `api.v1.blog` in `:::define` blocks. Without it, `unavailableResolvers()` is used and those references render an error marker. The site builds its resolvers with `createMdrsResolvers(supabase)` from `packages/lib/src/mdrsResolvers.ts`.

## Entry points

Only these are public. Everything else under `src/` is internal and may change.

| Entry | File | Contents |
| --- | --- | --- |
| `@mdrs/core` | `src/index.ts` | Rendering, headings, frontmatter, sanitizer, `:::define` validation and resolver building blocks, plain-text conversion |
| `@mdrs/core/legacy` | `src/legacy.ts` | Conversion from the pre-MDRS syntax |

## Layout

| Path | Responsibility |
| --- | --- |
| `src/markdown.ts` | The pipeline: runs every step in order |
| `src/render/` | One module per syntax: `containers` (directives, tabs, embeds), `parser` (marked renderers), `math`, `details`, `steps`, `footnotes`, `alerts`, `tasks`, `headings`, `attrs`, `ignoreRender` |
| `src/define/` | The `:::define` language: `lexer`, `parser`, `ast`, `values`, `evaluate`, `block`, `interpolation`, `identifiers`, `validate`, `errors` |
| `src/frontmatter.ts`, `src/references.ts`, `src/icons.ts`, `src/placeholders.ts` | Frontmatter, `:::references`, `icon=` loading, internal placeholders |
| `src/sanitize.ts` | The allowlist sanitizer that every render ends with |
| `src/plainText.ts`, `src/entities.ts` | Plain-text output and entity decoding |
| `src/limits.ts` | Document size limit |

The package ships TypeScript source with extensionless relative imports, so a consumer has to bundle it: the Svelte apps list it in `ssr.noExternal` (`apps/web/vite.config.ts`, `apps/admin/vite.config.ts`), and wrangler bundles it for the API and jobs Workers.

The language is documented in [docs/008-mdrs](../../docs/008-mdrs/README.md). `bun run check` type-checks the package on its own (strict `tsc`); `tests/mdrsDocsSnapshot.test.ts` pins the output of every documented example.
