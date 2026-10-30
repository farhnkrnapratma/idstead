# 6. Admin Sign-in and Request Auth

How the owner signs in at `admin.example.com`, and how pages and API calls are authorized afterwards. Idstead stores no passwords, authenticator secrets or passkeys: a [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) self-hosted application covers the whole admin host, and the admin Worker checks the token Access adds to every request.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant CA as Cloudflare Access
    participant IdP as Login method (Cloudflare account, one-time PIN, …)
    participant HK as idstead-admin hooks
    participant EP as /api/internal/admin/**

    B->>CA: GET https://admin.example.com/
    alt no CF_Authorization cookie for the app
        CA-->>B: 302 to <team>.cloudflareaccess.com
        B->>IdP: sign in, then the MFA the policy requires
        IdP-->>CA: identity
        CA->>CA: policy "Idstead owner": email = owner
        CA-->>B: 302 back with the CF_Authorization cookie
    end
    B->>CA: GET / (cookie)
    CA->>HK: request + Cf-Access-Jwt-Assertion (RS256 JWT)
    HK->>HK: accessIdentity(): signature from <team>/cdn-cgi/access/certs,<br/>iss = https://<team>, aud = ACCESS_AUD, exp, type = app,<br/>email in ADMIN_EMAILS when set
    alt no valid identity
        HK-->>B: 401 text/plain (noindex, no-store)
    else
        HK-->>B: dashboard (noindex, no-store)
    end

    Note over B,EP: Admin API calls are same-origin fetches; Access adds the same header
    B->>EP: fetch with the cookie (no Authorization header)
    EP->>EP: isSameOriginRequest, else 403
    EP->>EP: requireAdminAuth() / blogAdmin() → verifyAdminRequest()
    alt no valid identity
        EP-->>B: 401 ADMIN_AUTH_REQUIRED
    else
        EP-->>B: result; activity log actor = the Access email
    end
```

## Rules

- **Fail closed:** without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` a deployed admin refuses every request. They come from `access` in `idstead.jsonc` through `bun run configure`.
- **Local development:** only a `vite dev` build (`import.meta.env.DEV`) on `localhost`, `127.0.0.1` or `[::1]`, with no Access settings, signs in as `admin@localhost`. A production build never does.
- **MFA:** Access enforces it, not Idstead. Require two-factor authentication in the Access policy or the Zero Trust settings (passkey, security key or authenticator app), or rely on the two-factor authentication of the Cloudflare account when the login method is Cloudflare. The OpenID Connect consent page relies on the same rule.
- **Fresh sign-in:** `authTime` is the Access token's `iat`. Deleting all site data needs a token issued in the last 10 minutes and the typed confirmation `DELETE`; otherwise it answers `403 ADMIN_REAUTH_REQUIRED`.
- **Expired session:** Access redirects a fetch to its login page. `adminFetch()` (`apps/admin/src/lib/adminClient.ts`) uses `redirect: 'manual'` and turns the redirect or a `401` into "Your admin session has expired", so unsaved edits stay on the page; signing in again in another tab restores the session.
- **Sign-out:** `/cdn-cgi/access/logout`. Sessions and login methods are managed in Cloudflare Zero Trust.
- **Lockout:** `packages/lib/src/server/loginRateLimit.ts` still counts failed OpenID Connect client secrets in `db_login_failures`; there is no password login to lock out.
- **Page responses:** every admin response gets `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.

## Source

- `apps/admin/src/hooks.server.ts`, `apps/admin/src/routes/(admin)/+layout.server.ts`
- `packages/lib/src/server/accessAuth.ts`, `adminAuth.ts`, `blogPostAuth.ts`, `adminResume.ts` (`requireAdminAuth`)
- `apps/admin/src/lib/adminClient.ts`
- `tooling/setup.ts` (`adminAccess`), `tooling/setup/plan.ts`
