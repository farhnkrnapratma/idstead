:::define
owner: api.v1.author.profile.name
site: api.v1.author.profile.siteUrl
email: api.v1.author.profile.email
:::

# Security Policy

**Effective date:** 15 October 2026

This is the personal website and public interface of **${owner}**, built on [Idstead](https://github.com/farhnkrnapratma/idstead): SvelteKit and Hono applications with a Supabase backend, deployed as Cloudflare Workers. It consists of the public site at **${site}**, an admin portal, and a public read-only API under `/v1`.

## Scope

Only this deployment of the site at **${site}**, its admin portal and its API are in scope. Vulnerabilities in the Idstead code itself are welcome here too, and are forwarded to the project.

Areas of particular interest:

- **Authentication and administrative access**: the admin portal, its `/api/internal/admin/*` endpoints, and Supabase Auth (password, TOTP and passkeys). Admin pages are guarded server-side (session, `admin` role and MFA), and every privileged endpoint independently verifies a bearer token, the role and MFA, so a finding that demonstrates a privileged action succeeding without a valid, MFA-satisfied admin session is in scope.
- **Row Level Security policies and service-role code paths**: any path that uses the service-role client and therefore bypasses row-level security.
- **The public API** (`/v1/**`) and the agent discovery API (`/api/ard/**`): input validation, filter escaping, rate limiting, and CORS. The `/v1` API is read-only by design; a mutating handler reachable under it is itself a finding.
- **The internal interface** (`/api/internal/**` on the site and the admin portal): comment submission and reporting, view counting, helpfulness feedback, newsletter subscription, the contact form, the automated content endpoints (`blog/generate`, `blog/validate-define`), and the administrator endpoints. This includes same-origin enforcement, the anti-abuse challenge (Turnstile, verified server-side), and the automated moderation pipeline.
- **The newsletter pipeline**: the newsletter queue and the jobs worker that sends email through Resend.
- **Edge behaviour**: the response security headers and content security policy, the apex redirect, and the reverse proxy that serves static assets from the content delivery origin.
- **Public metadata endpoints**: `/.well-known/**`, `sitemap.xml`, `atom.xml`, `robots.txt`, and `llms.txt`.

### Known and accepted design boundaries

Reporting these as vulnerabilities is unlikely to lead to a fix, so they are recorded here rather than left to be rediscovered:

- **Editorial content is a trusted-author channel.** Blog posts and the legal documents are stored as Markdown and rendered to HTML through an allow-list sanitiser. The primary control is still the restriction on who can write that content; a path that lets an unprivileged party write to it **is** in scope, and is a high-severity finding, as is any sanitiser bypass.
- Same-origin enforcement accepts a request with no `Origin` header when it is a `GET`/`HEAD`, or when `Sec-Fetch-Site` is `same-origin`. This is known.

**Out of scope**: findings that require physical access or social engineering; denial-of-service and volumetric testing; and the infrastructure of third-party services this site does not control, namely Cloudflare, Supabase, Sentry, Resend, Google Tag Manager and Analytics, and GitHub. Please report issues in those services to their respective vendors.

## Reporting a Vulnerability

**Report by email:** send the details to ${email}. Please don't disclose a suspected vulnerability publicly until it has been fixed.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce, with a proof of concept if you have one
- Any relevant request and response details, with your own personal data redacted

Please test only against your own data, and please do not access, modify, or retain data belonging to anyone else.

## What to Expect

This site is maintained by one person, not a security team, so response times are best-effort:

- **Acknowledgment**: within a few days of the report
- **Triage and validation**: as soon as reasonably possible after acknowledgment
- **Fix and disclosure**: depending on severity; authentication bypass, row-level-security bypass, and data exposure are prioritised

Please allow a reasonable period to investigate and patch before any public disclosure.

## Measures Already in Place

Reports that account for the following are more useful than those that do not:

- HTML responses carry a content security policy with `frame-ancestors 'none'` and `object-src 'none'`; static assets additionally carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- The public API and the site's `/api/*` endpoints are rate limited to 60 requests per minute per IP address, and administrator sign-in is locked out after 5 failed attempts within 15 minutes.
- Every blog comment is screened by an automated moderation model before it can be shown; if the model is unavailable the comment is rejected.
- Administrator access requires MFA (TOTP or a passkey), enforced both in the application and in the database's row-level-security predicate.
- Database error text is scrubbed from responses before it leaves the server, so schema details are not disclosed through error messages.

## Recognition

There is no formal bug bounty programme, but valid reports are credited, with your permission, in the notes accompanying the fix.
