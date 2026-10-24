# 6. Admin Login, MFA and Request Auth

How the admin signs in at `admin.example.com`, and how pages and API calls are authorised afterwards.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (/login page)
    participant HK as idstead-admin hooks
    participant L as POST /api/internal/admin/login
    participant TS as Turnstile
    participant SA as Supabase Auth
    participant RS as Resend
    participant DB as Supabase (service-role)

    alt Path A: email + password
        B->>B: Turnstile token, solved in the background when the page renders
        B->>L: {email, password, captchaToken}
        L->>L: isSameOriginRequest, else 403
        L->>L: checkLoginLockout('ip:…'), then ('email-ip:…'): 5 failures / 15 min, else 429 ADMIN_LOGIN_LOCKED
        L->>L: no captchaToken, else recordFailedLogin + 403
        L->>SA: signInWithPassword with captchaToken (sets the auth cookies)
        SA->>TS: siteverify captchaToken
        alt captcha_failed
            L-->>B: recordFailedLogin + 403 ADMIN_LOGIN_TURNSTILE_FAILED
        end
        alt bad credentials
            L->>DB: logActivity auth.login_failed
            L-->>B: 401 ADMIN_LOGIN_INVALID_CREDENTIALS
        end
        L->>L: clearLoginAttempts
        L->>DB: logActivity auth.login
        L->>SA: getAuthenticatorAssuranceLevel()
        L-)RS: login alert in background (IP hashed with IP_SALT)
        L-->>B: 200 {ok, mfaRequired}
        opt mfaRequired (nextLevel aal2, currentLevel not aal2)
            B->>SA: mfa.listFactors(), then mfa.challengeAndVerify(TOTP code)
        end
    else Path B: passkey
        B->>SA: auth.signInWithPasskey({captchaToken})
        B->>SA: signOut({scope: 'others'})
    end
    B->>HK: GET /redirectTo
    HK->>SA: getUser(), getSession(), getAuthenticatorAssuranceLevel()
    HK->>HK: role = admin and mfaSatisfied, else 303 /login?redirectTo=…
    HK-->>B: dashboard (noindex, no-store)

    Note over B,DB: Admin API calls (/api/internal/admin/**, /api/internal/blog/*)
    B->>HK: Authorization: Bearer access_token
    HK->>HK: /api/* skips the page guard
    HK->>DB: blogAdmin() or requireAdminAuth() calls verifyAdminToken()<br/>getUser(token), role in ADMIN_ROLES, isMfaSatisfied(token)
    alt no token or expired
        HK-->>B: 401
    else not admin or MFA not satisfied
        HK-->>B: 403
    end
```

## MFA rule

`requiresAdminMfa()` in `packages/lib/src/adminAuthState.ts` decides whether a session is MFA-satisfied:

- A **passkey session** is MFA-satisfied. A session counts as passkey when its authentication methods include `passkey`, `webauthn` or `mfa/webauthn`.
- Any other session needs MFA only when `nextLevel === 'aal2'` and `currentLevel !== 'aal2'`.

The retired Postgres schema enforced the same rule in `public.is_admin()`; on D1 the admin endpoints apply it in code before they write (migration `20261012121000_is_admin_accepts_passkey.sql`). It returns true when the JWT has `app_metadata.role = 'admin'` **and** any one of these holds:

- `aal = 'aal2'`;
- an `amr` entry has `method = 'passkey'`;
- the user has **no verified** MFA factor.

## Notes

- **Unguarded paths:** the page guard in `hooks.server.ts` skips `/login`, `/robots.txt`, `/api/*`, `/_app/*` and identity assets. API routes authenticate themselves.
- **Auth cookies:**
    - They are host-only on `admin.example.com`, set by `@supabase/ssr` through `createAuthClient` (`packages/lib/src/server/supabaseAuth.ts`).
    - Options are `path=/`, `sameSite=lax`, and `secure` on HTTPS.
    - The code spreads the `@supabase/ssr` options and overrides only those three. It does not set `httpOnly` itself.
- **Login lockout:** `packages/lib/src/server/loginRateLimit.ts` counts failures in `db_login_failures` through the `service_role` RPCs `db_login_lockout`, `db_login_record_failure` and `db_login_clear`, so every isolate shares one count. Keys (`ip:…`, `email-ip:…`, `password-change:…`) are stored only as salted SHA-256 hashes. If the RPC fails, the isolate's in-memory `Map` is used instead.
- **Supabase Auth CAPTCHA:** the browser can call Supabase Auth directly (`/auth/v1/token`, passkey sign-in), skipping this route's lockout. Every sign-in therefore forwards one Turnstile token as `captchaToken`: the login route, the passkey button and the `data/delete-all` password check. Supabase verifies it only when **CAPTCHA protection** is enabled in the Supabase dashboard (Authentication → Attack Protection, provider Turnstile, the production `TURNSTILE_SECRET`); until then neither path checks the token, and the route rejects only a missing one. A Turnstile token can be verified once, so the route does not call `siteverify` itself: Supabase is the single verifier. The login widget renders with `execution: 'render'`, so the token is solved in the background while the page loads and the button submits without waiting; after each attempt the widget resets and solves a fresh token.
- **`data/delete-all`** re-checks the password with a per-request client, behind the shared lockout (`delete-all:…`).
- **`logout`** checks same-origin only. **`password`** uses `blogAdmin()` plus the lockout.
- **Page responses:** every admin response gets `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.

## Source

- `apps/admin/src/hooks.server.ts`, `apps/admin/src/routes/(admin)/+layout.server.ts`, `(admin)/login/+page.svelte`
- `apps/admin/src/routes/api/internal/admin/login/+server.ts`
- `packages/lib/src/server/adminAuth.ts`, `blogPostAuth.ts`, `adminCv.ts` (`requireAdminAuth`), `loginRateLimit.ts`, `supabaseAuth.ts`
- `packages/lib/src/adminAuthState.ts`
