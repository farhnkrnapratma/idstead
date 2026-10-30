# Security Policy

This policy covers the Idstead code in this repository: the web, admin, API and jobs Workers, the shared packages and the MDRS engine.

A site running Idstead publishes its own security policy at `/security`. To report a problem with one specific site, such as a misconfiguration or exposed data, contact that site's owner through that page.

## Supported versions

Only the latest commit on `main` receives security fixes. There are no maintained release branches; instances update by deploying a newer `main`.

## Reporting a vulnerability

Report it privately by email to [contact@fkp.my.id](mailto:contact@fkp.my.id). Please don't open a public issue, discussion or pull request for a suspected vulnerability before it has been fixed.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce, with a proof of concept if you have one
- The commit you tested against, and any request and response details with personal data redacted

Test only against an instance you run yourself, or with your own data, and do not access, modify or retain anyone else's data.

## Scope

In scope are flaws in the code that any instance would inherit, in particular:

- **Authentication and admin access**: the admin portal, `/api/internal/admin/**`, and the verification of the Cloudflare Access token on every admin request.
- **Data access**: Row Level Security policies, database functions, and every code path that uses the service-role client.
- **The public API** (`/v1/**`) and the agent discovery API (`/api/ard/**`): input validation, filter escaping, rate limiting and CORS. `/v1` is read-only by design, so a mutating handler reachable under it is itself a finding.
- **The internal interface** (`/api/internal/**`): same-origin enforcement, Turnstile verification, comment moderation, the newsletter and the contact form.
- **Rendering**: the MDRS engine and its HTML sanitiser, the content security policy and response headers.
- **Background work**: the newsletter queue consumer and the scheduled cleanups.

Out of scope:

- The security of one deployment's configuration, secrets or data; report those to that site's owner.
- Denial-of-service and volumetric testing, and findings that need physical access or social engineering.
- Third-party services (Cloudflare, Sentry, Resend, Google Analytics, GitHub); report those to their vendors.

### Known design boundaries

- **Editorial content is a trusted-author channel.** Posts and legal pages are Markdown written by the site owner and rendered through an allow-list sanitiser. A sanitiser bypass, or a way for anyone else to write that content, is in scope.
- Same-origin enforcement accepts a request without an `Origin` header when it is a `GET` or `HEAD`, or when `Sec-Fetch-Site` is `same-origin`.

## What to expect

Idstead is maintained by one person, so response times are best-effort: an acknowledgment within a few days, triage as soon as reasonably possible, and a fix prioritised by severity (authentication bypass, Row Level Security bypass and data exposure first). Please allow time for a fix before any public disclosure. There is no bug bounty, but valid reports are credited, with your permission, in the advisory and release notes.

The protections already in place are described in [`docs/007-security.md`](docs/007-security.md).
