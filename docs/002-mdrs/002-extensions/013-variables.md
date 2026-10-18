# Variables

A document can declare typed variables in a `:::define` block and use them anywhere in the text with `${…}`. Expressions are evaluated on the server during rendering, so readers only ever see the result.

Interpolation is opt-in: `${…}` and `[text].${…}` only do anything in a document that starts with a `:::define` block holding at least one entry. In any other document they are ordinary text, exactly as in plain Markdown.

```mdrs
:::define
site_name: "fkp.my.id"
version: "2.1"
year: 2026
is_production: true
greeting: "Welcome to " + this.site_name
locales: ["en", "id"]
stats: { directives: 14, stable: true }
:::

**${greeting}.** Engine v${version}, © ${year}.

- First locale: ${locales[0]} of ${locales.length}
- Directives: ${stats.directives}
- [You are viewing the production build.].${is_production}
```

Renders "**Welcome to fkp.my.id.** Engine v2.1, © 2026.", then "First locale: en of 2", "Directives: 14" and "You are viewing the production build."

## The `:::define` block

- It must be the very first thing in the document (leading blank lines are fine, and [frontmatter](001-frontmatter.md) may come before it) and there can be only one. A `:::define` anywhere else is plain text, and saving the post fails validation.
- It must hold at least one entry. An empty block (or one with only comments) is removed from the output but doesn't switch interpolation on, and save validation reports `A :::define block needs at least one entry.`
- Each entry is `name: expression`. Separate entries with new lines or commas.
- `//` starts a comment that runs to the end of the line.
- Entries are evaluated top to bottom. To use an earlier entry, write `this.name`; a bare `name` is an error inside the block.
- Names follow identifier rules (`[A-Za-z_][A-Za-z0-9_]*`) and can't be JavaScript reserved words or `this`, `api`, `db`, `null`, `undefined`, `NaN` or `Infinity`.
- Defining the same name twice keeps the first value and reports the second as an error.

```mdrs
:::define
price: 120000, discount: 0.15 // separated by a comma
final_price: this.price * (1 - this.discount)
:::

Final price: Rp ${final_price}
```

Renders "Final price: Rp 102000".

## Values

| Type | Literal | Displayed as |
| --- | --- | --- |
| string | `"text"`, with escapes `\n`, `\t`, `\"`, `\\` | the text |
| number | `42`, `3.14` (no exponent form; negatives via unary `-`) | JavaScript number formatting (`0.1 + 0.2` shows `0.30000000000000004`) |
| boolean | `true`, `false` | `true` / `false` |
| array | `[1, "two", true]` | JSON, e.g. `[1,"two",true]` |
| object | `{ key: "value", nested: { n: 1 } }` (keys are bare identifiers) | JSON |

Strings use double quotes only. Inside arrays and objects, items can be separated by commas or new lines.

## Expressions

From lowest to highest precedence:

| Operators | Operands | Result |
| --- | --- | --- |
| `\|\|` | booleans | boolean (short-circuit) |
| `&&` | booleans | boolean (short-circuit) |
| `==` `!=` | any | deep equality, the type must match (`"1" == 1` is `false`) |
| `>` `<` `>=` `<=` | numbers | boolean |
| `+` | two numbers, or anything with at least one string | sum, or string concatenation |
| `-` | numbers | number |
| `*` `/` `%` | numbers | number (`1 / 0` is `Infinity`) |
| `!` (unary) | boolean | boolean |
| `-` (unary) | number | number |

Parentheses group. Paths walk into values: `obj.key`, `obj["key"]`, `list[0]`, and `list.length` for an array's length. There are no function calls, no ternary and no implicit type conversion: `true + 1` is an error.

## Interpolation: `${expression}`

Anywhere in the body, `${…}` evaluates an expression and inserts its display value. Variables are referenced by their bare name here (`this.` is only for inside `:::define`):

```mdrs
:::define
n: 3
:::

${n} × 2 + 1 = ${n * 2 + 1}, and n ≥ 3 is ${n >= 3}.
```

The inserted text is treated as Markdown, so a string variable can carry `**bold**` or a link. HTML inside it goes through the sanitizer like any other HTML.

## Conditional text: `[text].${condition}`

Square brackets followed immediately by `.${…}` show the text only when the expression is `true`; otherwise it disappears. The text can contain Markdown.

```mdrs
:::define
stable: false
:::

[**Stable release.**].${stable}[This is a preview build.].${!stable}
```

The expression must evaluate to a boolean, or the error "Expected a boolean expression inside [...].${...}" appears.

The bracketed text can hold its own `${…}`, which is evaluated when the condition is true (up to eight levels deep):

```mdrs
:::define
n: 3
ok: true
:::

[Value ${n} is ready.].${ok}
```

Renders "Value 3 is ready."

## Where interpolation applies

- Body text, headings, lists, tables, link text, directive bodies and attribute values (`:::callout title="${name}"`), and math (`$$ x = ${n} $$`).
- Not in code spans or fenced code blocks: `` `${name}` `` stays literal.
- Not after a backslash: `\${name}` renders `${name}`. See [Escaping](015-escaping.md).

## Errors

At render time, an expression that fails, such as an unknown name, a type mismatch or an out-of-range index, renders a red `[define error]` marker whose tooltip holds the message:

```mdrs error
:::define
name: "MDRS"
:::

${missing_variable}
```

```html
<span
    class="mdrs-define-error"
    title="'missing_variable' is undefined"
    >[define error]</span
>
```

A broken `:::define` entry doesn't show anything by itself: the variable is simply undefined, so the error appears where it is used.

`validateDefineForSave` checks the whole document: the frontmatter YAML, a misplaced or empty `:::define`, every define entry, every `${…}` in the body (including inside conditional text), and the `:::references` structure. A document without a `:::define` block has no interpolation to check.

The admin runs it in two places:

- **While you edit.** Every MDRS editor in the admin (new post, edit post, and the privacy, security and terms pages) calls `POST /api/internal/blog/validate-define` shortly after you stop typing, when the field loses focus, and before saving. The first messages appear under the editor, and a legal page can't be saved while there are errors. The preview pane also shows the same `[define error]` markers inline.
- **When a post is saved.** The save endpoint repeats the check and refuses with `422 BLOG_DEFINE_VALIDATION_FAILED`, listing the messages.

Common messages:

| Message | Cause |
| --- | --- |
| `'x' is undefined` | Unknown variable, or used before its definition |
| `'x' is not valid here — use this.x inside :::define` | Bare name inside `:::define` |
| `this.* is only valid inside a :::define block` | `this.` in the body |
| `'x' is already defined` | Duplicate name |
| `'x' is not a valid variable name (check reserved words / naming rules)` | Reserved word or invalid name |
| `'+' requires two numbers or at least one string` | `true + 1` and similar |
| `Property 'k' does not exist`, `Index [3] is out of range` | Bad path |
| `Only one :::define block is allowed, and it must be the first thing in the document.` | Misplaced or second block (save validation) |
| `A :::define block needs at least one entry.` | Empty block (save validation) |

To pull data from the site itself (author profile, posts), see [Live data](014-live-data.md).

Source: `packages/mdrs/src/define.ts` (`tokenize`, `Parser`, `evaluateExpr`, `extractDefineBlock`, `hasDefineEntries`, `scanInterpolationTokens`, `validateDefineForSave`), `packages/lib/src/mdrsValidation.ts`, `apps/admin/src/routes/api/internal/blog/validate-define/+server.ts`, `apps/admin/src/routes/api/internal/admin/posts/+server.ts`.
