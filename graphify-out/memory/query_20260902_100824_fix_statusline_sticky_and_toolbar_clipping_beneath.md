---
type: "query"
date: "2026-09-02T10:08:24.672761+00:00"
question: "Fix statusline sticky and toolbar clipping beneath the admin navbar"
contributor: "graphify"
outcome: "useful"
source_nodes: ["MarkdownEditor.svelte", "TopNav.svelte", "admin/+layout.svelte"]
---

# Q: Fix statusline sticky and toolbar clipping beneath the admin navbar

## Answer

Expanded from graph vocab: [markdown, editor, toolbar, status, navigation, layout, admin, top]. MarkdownEditor uses stickyTopClass; the post editor navbar is h-12/sm:h-14 and the responsive admin navbar is h-14 until md. The status bar is pinned to the viewport while its editor is visible.

## Outcome

- Signal: useful

## Source Nodes

- MarkdownEditor.svelte
- TopNav.svelte
- admin/+layout.svelte