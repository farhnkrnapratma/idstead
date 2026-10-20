# Task states

GFM task lists know two states, `[ ]` and `[x]`. MDRS adds five more, each with its own icon and colour.

```mdrs
- [x] Ship server-side math rendering
- [*] Chart tooltips (in progress)
- [/] Legacy graph parser (cancelled)
- [-] Plugin migration (on hold)
- [!] Patch the vulnerable dependency (alert)
- [?] Persist the tab selection? (question)
- [ ] Footnote animations (planned)
  - [x] Multi-reference letters
  - [ ] Accessibility audit
```

| Marker | Meaning | Class | Screen-reader label | Icon (Lucide) | Colour | Text |
| --- | --- | --- | --- | --- | --- | --- |
| `[x]` or `[X]` | Done | `mdrs-task--done` | Done | `square-check` | success green | normal |
| `[*]` | In progress | `mdrs-task--in-progress` | In progress | `square-asterisk` | warning | normal |
| `[/]` | Failed or cancelled | `mdrs-task--failed` | Failed | `square-x` | danger red | normal |
| `[-]` | Skipped or on hold | `mdrs-task--skipped` | Skipped | `square-minus` | muted | struck through, dimmed |
| `[!]` | Important | `mdrs-task--important` | Important | `square-alert` | accent | normal |
| `[?]` | Question | `mdrs-task--question` | Question | `square-square` | focus blue | normal |
| `[ ]` | Open | `mdrs-task--todo` | To do | `square` | muted | normal |

```html
<li class="mdrs-list-item mdrs-task mdrs-task--done">
    <span
        class="mdrs-task-icon"
        aria-hidden="true"
        ><svg class="mdrs-icon">…</svg></span
    ><span class="mdrs-sr-only">Done: </span>
    <div class="mdrs-task-content">Ship server-side math rendering</div>
</li>
```

## Notes

- The marker must come first in the item, followed by a space.
- Task states work in bulleted (`-`, `*`, `+`) and numbered (`1.`) lists. A numbered task keeps its number and shows the icon after it.
- The icon is decorative (`aria-hidden`), and a visually hidden label (`Done: `, `To do: `, …) announces the state to screen readers.
- In plain GFM, `[*]`, `[/]`, `[-]`, `[!]` and `[?]` are ordinary text. This is the one deliberate reinterpretation of plain Markdown in MDRS: the pattern has no meaning in GFM, so the risk of changing an existing document is small ([Compatibility](../003-reference/001-compatibility.md)).

Source: `packages/mdrs-core/src/render/tasks.ts` (`TASK_STATES`, `renderTaskItem`), `packages/mdrs-core/src/render/parser.ts` (`list` renderer).
