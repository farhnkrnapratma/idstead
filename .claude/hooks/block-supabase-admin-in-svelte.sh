#!/usr/bin/env bash
jq 'if ((.tool_input.file_path // "") | test("\\.svelte$"))
    and ((.tool_input.new_string // .tool_input.content // "") | test("supabaseAdmin"))
  then {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "packages/lib/src/server/supabaseAdmin.ts holds the Supabase service-role key (it manages the admin user) and is server-only: never import it into a .svelte file, per CLAUDE.md."
    }
  }
  else {}
  end'
