# Security Policy

**Effective date:** 8 September 2026

This is the personal website and public interface of **Farhan Kurnia Pratama**, a SvelteKit application with a Supabase backend, deployed to Cloudflare Pages, exposing a public read-only interface under `/api/v1`.

## Scope

Only the code and infrastructure of this project and its live deployment at **https://fkp.my.id** are in scope. There are no separately maintained release branches or versions to track: the `main` branch is what is deployed, and that is the only version supported for security fixes.

Areas of particular interest:

- **Authentication and administrative access** — the `/admin` interface, the `/api/internal/admin/*` endpoints, and Supabase Auth. Note that the `/admin` interface is a client-rendered shell with no server-side route guard; authorization is enforced at the endpoint layer on every privileged call, so a finding that demonstrates a privileged action succeeding without a valid token is in scope, whereas merely loading the shell is not.
- **Row Level Security policies and service-role code paths** — any path that uses the service-role client and therefore bypasses row-level security.
- **The Supabase Edge Function** in `supabase/functions/admin` — it holds a service-role key and object-storage credentials, and validates its own administrator claim independently of the application.
- **The public interface** (`/api/v1/**`) — input validation, filter escaping, rate limiting, and CORS. It is read-only by design; a mutating handler reachable under that prefix is itself a finding.
- **The internal interface** (`/api/internal/**`) — comment submission and reporting, view counting, article helpfulness votes, the automated content endpoints (`blog/generate`, `blog/validate-define`), the raw document endpoint, and the administrator authentication and document endpoints. This includes same-origin enforcement, the anti-abuse challenge, and the automated moderation pipeline.
- **The feedback and contact forms** — these submit to a third-party relay rather than to a project endpoint, and are the only user-input paths outside `/api/v1` and `/api/internal`.
- **Edge behaviour** — the response security headers and content security policy, the apex redirect, and the reverse proxy that serves static assets from the content delivery origin.
- **Public metadata endpoints** — `/.well-known/**`, `sitemap.xml`, `atom.xml`, `robots.txt`, and `llms.txt`.

### Known and accepted design boundaries

Reporting these as vulnerabilities is unlikely to lead to a fix, so they are recorded here rather than left to be rediscovered:

- **Editorial content is a trusted-author channel.** Blog posts and the legal documents are stored as Markdown and rendered to HTML without a sanitiser, so anyone with write access to those tables can execute script on the corresponding pages. The control is the restriction on who can write to those tables, not the renderer. A path that lets an unprivileged party write to them **is** in scope, and is a high-severity finding.
- The anti-abuse challenge on the contact and feedback forms is not verified server-side. This is known.
- Same-origin enforcement treats a request with no `Origin` header as same-origin. This is known.

**Out of scope**: findings that require physical access or social engineering; denial-of-service and volumetric testing; and the infrastructure of third-party services this project does not control, namely Cloudflare, Supabase, Sentry, Google Tag Manager and Analytics, GitHub, and the FormSubmit relay. Please report issues in those services to their respective vendors.

## Reporting a Vulnerability

**Preferred: GitHub Private Vulnerability Reporting.** This is enabled on the repository. Open [a private advisory](../../security/advisories/new) from the **Security** tab and click "**Report a vulnerability**". This keeps the report private until a fix is ready and allows disclosure to be coordinated through GitHub's tooling.

**Alternative:** email [contact@fkp.my.id](mailto:contact@fkp.my.id) with the details. Please do not open a public issue for a suspected vulnerability.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce, with a proof of concept if you have one
- Any relevant request and response details, with your own personal data redacted

Please test only against your own data, and please do not access, modify, or retain data belonging to anyone else.

## What to Expect

This project is maintained by one person, not a security team, so response times are best-effort:

- **Acknowledgment** — within a few days of the report
- **Triage and validation** — as soon as reasonably possible after acknowledgment
- **Fix and disclosure** — depending on severity; authentication bypass, row-level-security bypass, and data exposure are prioritised

Please allow a reasonable period to investigate and patch before any public disclosure.

## Measures Already in Place

Reports that account for the following are more useful than those that do not:

- A pre-commit hook runs a secret scanner over staged files and blocks the commit on a verified finding. It is advisory: it exits without error if the scanner is not installed locally.
- GitHub secret scanning and push protection are enabled on the repository.
- Response headers set a content security policy with `frame-ancestors 'none'`, together with `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- The public interface is rate limited to 60 requests per minute per IP address, and administrator sign-in is locked out after 5 failed attempts within 15 minutes.
- Database error text is scrubbed from responses before it leaves the server, so schema details are not disclosed through error messages.

## Recognition

There is no formal bug bounty programme, but valid reports are credited, with your permission, in the commit message or release notes accompanying the fix.
