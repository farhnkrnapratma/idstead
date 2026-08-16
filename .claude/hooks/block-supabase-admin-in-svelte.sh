#!/usr/bin/env bash
jq 'if ((.tool_input.file_path // "") | test("\\.svelte$"))
    and ((.tool_input.new_string // .tool_input.content // "") | test("supabaseAdmin"))
  then {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "src/lib/server/supabaseAdmin is service-role (bypasses RLS) and must never be imported into a .svelte file per CLAUDE.md."
    }
  }
  else {}
  end'
