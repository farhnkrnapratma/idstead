---
paths:
    - .claude/**
    - .mcp.json
    - skills-lock.json
---

# Agent and skills tooling

This repository is set up for Claude Code only. `.claude/` holds its project skills (`skills/`), review agents (`agents/`: `security-reviewer`, `api-reviewer`, `ui-consistency-reviewer`), hooks (`hooks/`, wired in `settings.json`) and rules (`rules/`); `.mcp.json` lists the project MCP servers (versions pinned). Skills from skills.sh are managed with `bunx skills add|remove|update` and recorded in `skills-lock.json`; skills that `bunx skills list` shows as `local` are the owner's own and are edited in place. None of it is part of the application runtime. Do not add configuration for other coding agents (`AGENTS.md`, `.agents/`, `.cursor/`, `.codex/` and the like).
