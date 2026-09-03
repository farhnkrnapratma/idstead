# Skill Observation Log

Observations captured during task-oriented work.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = skill updated/created | DECLINED (YYYY-MM-DD) = user decided not to pursue — resolved statuses always carry their resolution date

---

## 2026-09-01

### Observation 1: Detect rejected OAuth scopes during Supabase MCP setup

**Status:** OPEN **Date:** 2026-09-01 **Session context:** Configuring the hosted Supabase MCP server in Codex CLI. **Skill:** supabase **Type:** open-source **Phase/Area:** Supabase MCP Server setup

**Issue:** The documented project-scoped feature URL registered successfully, but dynamic OAuth registration failed because the server rejected multiple requested scopes; repeating `codex mcp login` produced the same error and left authentication unknown.

**Suggested improvement:** Add a post-login compatibility check that records the Codex CLI version and directs users to update either client or server configuration when dynamic registration rejects scopes, instead of treating the issue as a normal interactive-authentication failure.

**Principle:** Verify both registration and authentication independently, and treat explicit OAuth scope rejections as a compatibility issue rather than a user-login issue.

### Observation 2: Style dynamically injected Markdown with global selectors

**Status:** OPEN **Date:** 2026-09-01 **Session context:** Fixing runtime-rendered code blocks and custom callouts in Svelte components. **Skill:** svelte-code-writer **Type:** open-source **Phase/Area:** Svelte styling for generated HTML

**Issue:** Markdown HTML injected with `{@html}` is not visible to Svelte's scoped-style analysis, so component-local selectors can be reported as unused and fail to style runtime code-block rows.

**Suggested improvement:** Document a consistent pattern for generated Markdown: keep shared selectors in global CSS, mirror narrowly scoped `:global(...)` overrides inside components that need precedence, and treat unused-selector diagnostics as expected for runtime-only markup.

**Principle:** Style generated DOM at the global boundary, then add minimal component-level overrides only when cascade precedence requires them.

### Observation 3: Share syntax-highlighting theme state across render paths

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Aligning the admin Markdown editor with published code-block Highlight.js themes. **Skill:** svelte-code-writer **Type:** open-source **Phase/Area:** Highlight.js theme loading

**Issue:** The editor and published code blocks used separate rendering paths; only the published path loaded the Highlight.js theme stylesheet, so identical token classes rendered with different colors.

**Suggested improvement:** Keep the theme basis, resolver, and stylesheet loader in one shared utility and have every Highlight.js rendering surface consume it.

**Principle:** A syntax-highlighting theme is shared runtime state, not a per-component styling detail.

## 2026-09-02

### Observation 4: Separate parser compatibility warnings from source correctness

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Updating a code component and refreshing its repository knowledge graph. **Skill:** graphify **Type:** open-source **Phase/Area:** Incremental code extraction

**Issue:** The graph refresh reported parser errors for many component files even though the project's framework-aware type check completed without errors, making the extraction warning look like an implementation regression.

**Suggested improvement:** In the update output, distinguish unsupported or partial parser coverage from source files that fail the project's own validation command, and suggest the framework-aware check when relevant.

**Principle:** A general-purpose source extractor should label parser-coverage limits separately from validated code defects.

### Observation 5: Resolve dynamically loaded stylesheet readiness before reading theme values

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Synchronising an editor surface with a dynamically loaded syntax-highlighting theme. **Skill:** svelte-code-writer **Type:** open-source **Phase/Area:** Third-party stylesheet integration

**Issue:** Reading computed colors immediately after assigning a dynamically imported stylesheet URL can capture the previous or fallback theme because the browser has not applied the new sheet yet.

**Suggested improvement:** When component styling depends on a dynamically loaded stylesheet, expose or await a load-complete promise before sampling computed styles and sharing derived CSS variables with other rendering surfaces.

**Principle:** A stylesheet URL being available is not the same as its rules being active in the browser.

### Observation 6: Neutralise inherited overflow from third-party theme selectors

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Styling a custom syntax-highlighted editor with a third-party Highlight.js theme. **Skill:** svelte-code-writer **Type:** open-source **Phase/Area:** Third-party CSS integration

**Issue:** Adding a theme class to an editor element also activated a broad stylesheet selector that created a nested native scrollbar, even though the editor's own scroll container was already configured.

**Suggested improvement:** When adopting a third-party styling hook, inspect ancestor-based selectors and explicitly neutralise layout properties such as overflow on nested elements when the host component owns scrolling.

**Principle:** A styling class can carry layout behavior as well as colors, so both must be audited when reusing it.

### Observation 7: Separate scoped validation from a dirty-worktree gate failure

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Finalising a Svelte component change in a worktree containing unrelated formatting changes. **Skill:** task-observer **Type:** open-source **Phase/Area:** Validation

**Issue:** The repository-wide lint command stopped at Prettier failures in unrelated files before it reached the changed component, leaving the implementation's lint status unclear.

**Suggested improvement:** Add a validation fallback that runs formatter and linter checks on the changed files after a repository-wide gate fails for unrelated dirty-worktree files, and reports both results distinctly.

**Principle:** A broad quality gate can diagnose repository state, while scoped validation establishes whether the change itself meets the same standards without mutating unrelated work.

### Observation 8: Prefer structural grid placement over spacing offsets

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Aligning form controls with a media preview in a responsive admin editor. **Skill:** ui-consistency-check **Type:** open-source **Phase/Area:** Responsive layout alignment

**Issue:** A spacing offset temporarily aligned two independent controls at one viewport but drifted when their labels and intrinsic field sizing differed.

**Suggested improvement:** Add a review check that recommends placing controls that must share an edge on the same explicit grid row before using breakpoint-specific padding or margin offsets.

**Principle:** Alignment requirements should be expressed through shared layout structure rather than visual compensation.

### Observation 9: Use a mask for inherited-color SVG icons in generated content

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Correcting the color of a footnote back-reference icon rendered from Markdown. **Skill:** svelte-code-writer **Type:** open-source **Phase/Area:** Generated-content styling

**Issue:** An SVG used through a CSS `background-image` could not inherit its anchor's `currentColor`, leaving an icon black despite the surrounding link using the theme link color.

**Suggested improvement:** Document CSS masks as the default for monochrome generated icons that must inherit text color, with `background-color: currentColor` and a WebKit-compatible mask declaration.

**Principle:** Generated monochrome icons should derive their color from the same CSS inheritance path as their adjacent text.

### Observation 10: Mock framework virtual modules before testing server code directly

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Testing an AI translation module that imports application utilities with framework-provided environment modules. **Skill:** task-observer **Type:** open-source **Phase/Area:** Validation

**Issue:** Direct runtime tests could not load the server module until the framework's virtual environment module was mocked before the dynamic import, even though the test itself did not use environment configuration.

**Suggested improvement:** Add a validation pattern for server modules that dynamically imports them after mocking required virtual modules, keeping integration-oriented tests independent from a full development server.

**Principle:** Test harnesses should provide framework virtual dependencies explicitly before loading code that reaches application-level imports.

### Observation 11: Sanitize redirect errors before structured logging

**Status:** OPEN **Date:** 2026-09-02 **Session context:** Diagnosing a remote AI binding blocked by an identity-provider redirect. **Skill:** task-observer **Type:** open-source **Phase/Area:** Error observability

**Issue:** A provider error message contained a redirected login URL with sensitive query data, and structured error logging would have preserved that data unless the redirect class was recognized before logging.

**Suggested improvement:** Add an observability rule that detects identity-provider redirects, records a stable reason code and safe metadata, and never logs the raw redirect URL.

**Principle:** Treat authentication redirects in third-party errors as sensitive data even when the original request contains no credentials.
