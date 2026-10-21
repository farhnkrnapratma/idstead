# Code blocks

MDRS keeps standard fenced code blocks ([Code](../001-markdown/006-code.md)) and adds options in the info string, special handling for a few languages, and reader controls in the browser.

## Info string options

````mdrs
```typescript filename="auth.svelte.ts" mark=2,5..7
import { writable } from 'svelte/store';
import type { Session } from '$lib/types';

export function createAuthStore(initial: Session | null) {
    let session = $state(initial);
    let isAuthenticated = $derived(session !== null);
    return { get session() { return session; }, get isAuthenticated() { return isAuthenticated; } };
}
```
````

The language must come first; the options follow in any order. Both are optional.

### `filename="…"`

- Shown in the header bar next to the language name, and used as the downloaded file's name.
- Sanitized before use: path segments, control and bidirectional-override characters and `<>:"|?*` are removed, and the name is cut at 100 characters. A name that ends up empty, or made only of dots, is ignored.

### `mark=…`

Highlights lines. List line numbers separated by commas and write ranges with `..`:

| Value           | Highlights          |
| --------------- | ------------------- |
| `mark=3`        | line 3              |
| `mark=1,4`      | lines 1 and 4       |
| `mark=2..5`     | lines 2 to 5        |
| `mark=1,3..4,8` | lines 1, 3, 4 and 8 |

Numbers outside the block are ignored (a range is clamped to the block's length), duplicates collapse, and `0` is ignored. The HTML carries the result for the browser:

```html
<pre
    data-mdrs-highlight-lines="2,5,6,7"
    data-mdrs-filename="auth.svelte.ts"><code class="language-typescript">…</code></pre>
```

The old `{1,3-5}` syntax is no longer parsed; `scripts/migrate-markdown-syntax.ts` converted existing posts to `mark=`.

## Diffs

The `diff` language colours added lines (`+`) and removed lines (`-`) across the full width of the block:

````mdrs
```diff filename="example.diff"
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,3 +1,3 @@
 import { ai } from '$lib/server/ai';
-const MAX_ATTEMPTS = 2;
+const MAX_ATTEMPTS = 3;
```
````

## Command blocks

A block in a shell language (`sh`, `bash`, `zsh`, `fish`, `shell`, `nu`, `nushell`, `powershell`, `ps1`, `cmd`, `bat`, `terminal`, `console`) whose content looks like commands rather than a script is shown as a command block: there are no line numbers, and the line-number toggle is hidden.

Content counts as a script, and keeps line numbers, when it has a shebang (`#!/…`), shell control flow (`if`, `then`, `for`, `while`, `case`, `function`, …) or a function definition (`name() {`).

````mdrs
```sh
bun install
bun run dev
```

```bash filename="deploy.sh"
#!/usr/bin/env bash
for app in web admin api jobs; do
  (cd "apps/$app" && bunx wrangler deploy)
done
```
````

The first block is a command block; the second is a script.

## Reader controls

In the browser every code block outside a tab group gets a header bar with the language (or the file name) on the left, and controls on the right:

| Control | What it does |
| --- | --- |
| Copy | Copies the code and shows a toast |
| Colour scheme | Cycles the code theme: Auto (follows the site), Light, Dark |
| Options menu | Line numbers, wrap lines, clean mode, and Download |
| Download | Saves the code as `filename`, or `snippet.<ext>` from the language (`ts` → `snippet.ts`, `python` → `snippet.py`, `yaml` → `snippet.yml`, …), `Dockerfile` for `docker`/`dockerfile`, otherwise `snippet.txt` |
| Clean mode | Hides the chrome and leaves a minimal copy button; always on in reading mode |

The line-number, wrap, clean-mode and colour-scheme choices apply to every code block and are saved in the browser (`localStorage` key `codeblock_prefs`). Defaults: Auto colours, line numbers on, wrap off, clean mode off.

Keyboard shortcuts on a focused block: <kbd>C</kbd> copy, <kbd>O</kbd> options, <kbd>D</kbd> download. The site-wide "Code blocks" shortcut group also has keys for the theme, wrap, line numbers and clean mode.

Code blocks inside `:::snippets` share one set of controls in the tab header; see [Tabs and snippets](005-tabs-and-snippets.md).

Source: `packages/mdrs/core/src/render/parser.ts` (`parseFenceInfo`, `parseHighlightedLines`), `packages/mdrs/dom/src/codeBlocks.ts`, `packages/mdrs/dom/src/codeBlockExtensions.ts`, `packages/mdrs/dom/src/codeBlockPrefsStore.svelte.ts`.
