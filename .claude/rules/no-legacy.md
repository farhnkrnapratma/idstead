# No legacy

The repository holds only the current way of doing things. Nothing deprecated, broken, old or replaced stays, and nothing is kept for backward compatibility.

- When a feature, name, syntax, setting, environment variable, storage key, route, table or file is replaced, remove the old one in the same change.
- No aliases, compatibility shims, fallbacks to an old value, redirects from old URLs, migrations of old browser storage keys, `@deprecated` markers, or "legacy"/"no longer supported" code paths and error messages.
- Stored data moves once, through a D1 migration or a one-off command run during the release, and the old shape is never read again.
- Documentation describes only what exists now: no "old syntax", "previously", "deprecated" or migration notes.
- Before finishing a task, search the changed areas (`rg -i "legacy|deprecat|fallback|no longer|alias|compat"`) and remove whatever the change left behind.
