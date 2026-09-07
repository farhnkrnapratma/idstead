---
type: "query"
date: "2026-08-19T10:25:08.876469+00:00"
question: "Why does createA11yStore() connect to Security Auditing & Hardening?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["createA11yStore()", "a11yStore.svelte.ts"]
---

# Q: Why does createA11yStore() connect to Security Auditing & Hardening?

## Answer

Expanded from original query via vocab: [audit, hardening, security, store]. createA11yStore() in src/lib/stores/a11yStore.svelte.ts manages client accessibility state and DOM persistence. It bridges directly to a11yStore.svelte.ts, which is heavily imported by admin routes (+page.svelte, new/+page.svelte), legal page layouts, and root layouts, connecting UI primitives to security-gated and audit-relevant components.

## Outcome

- Signal: useful

## Source Nodes

- createA11yStore()
- a11yStore.svelte.ts