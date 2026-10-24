# AI Agent Setup

Open the repository in [Claude Code](https://claude.com/claude-code) and ask it to "set up Idstead with the setup-idstead skill" (or run `/setup-idstead`). The skill is in `.claude/skills/setup-idstead/SKILL.md`. It tells Claude Code to:

- collect the domain and admin email from you,
- write the answers file,
- run the dry run, and fix what it reports with you,
- run `apply` only after you confirm,
- and hand the temporary password and the next steps back to you.

The agent runs the [setup script](001-setup-script.md) and never writes your secrets into files or chat. It asks you to put them in `.env` or your secret manager yourself.

The [next steps](README.md#after-setup) still need you, because they happen in other dashboards.
