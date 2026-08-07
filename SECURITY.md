<!-- @format -->

# Security Policy

This is the personal website and API for Farhan Kurnia Pratama (fkp.my.id) — a SvelteKit app with a Supabase backend, deployed to Cloudflare Pages, and a public read-only REST API under `/api/v1`.

## Scope

Only the code and infrastructure in this repository and its live deployment at fkp.my.id are in scope. There are no separately maintained release branches or versions to track — the `main` branch is what's deployed, and that's the only version supported for security fixes.

Areas of particular interest:

- Authentication and admin access (`/admin`, `/api/v1/admin/*`, Supabase Auth)
- Row Level Security (RLS) policies and any service-role (`supabaseAdmin`) code path
- The public API (`/api/v1/**`) — input validation, rate limiting, CORS
- Comment submission and moderation (Turnstile + AI moderation pipeline)

Out of scope: findings that require physical access, social engineering, or third-party services this project doesn't control (Cloudflare, Supabase, Sentry infrastructure itself).

## Reporting a Vulnerability

**Preferred: GitHub Private Vulnerability Reporting.** This repository has it enabled — go to the [Security tab](../../security/advisories/new) and click "Report a vulnerability." This keeps the report private until a fix is ready and lets us coordinate disclosure through GitHub's tooling.

**Alternative:** email [contact@fkp.my.id](mailto:contact@fkp.my.id) with details. Please don't open a public GitHub issue for a suspected vulnerability.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a proof-of-concept is appreciated but not required)
- Any relevant request/response details (redact your own personal data first)

## What to Expect

This project is maintained by a single person, not a security team, so response times are best-effort:

- **Acknowledgment**: within a few days of report
- **Triage/validation**: as soon as reasonably possible after acknowledgment
- **Fix and disclosure**: timeline depends on severity; critical issues (auth bypass, RLS bypass, data exposure) are prioritized

Please give a reasonable amount of time to investigate and patch before any public disclosure.

## Recognition

There's no formal bug bounty program, but valid reports are credited (with permission) in the fix's commit message or release notes.
