# Login sessions (issue #9)

This integration brings Matthew's #33/#34 session page, wrappers, logout hardening and runtime checks together with the private-account branch's signup, dashboard and password recovery. Both original commit histories are retained. There is one session system, not two.

## What a user sees

1. Log in on `/` as a fictional custom account or `student` / `Training123!`. The existing login celebration and dashboard navigation remain. Without JavaScript, the success response includes a dashboard link.
2. `/dashboard` shows private account and recovery controls. Its session-details link opens Matthew's `/account` page, with the username, expiry and **Log out**. The compatibility `signIn` action also redirects to `/account` after the same login operation.
3. Both pages check the same session on every request. Missing, invalid, expired or revoked sessions redirect to `/`.
4. Log out from either page and both pages stop accepting that token. Other browsers' sessions remain separate. Password recovery invalidates every existing session for that user.
5. A session expires eight hours after login. Activity does not extend it.

Wrong, blank, oversized and throttled logins issue no session. Attack Lab and defended lab logins do not create sessions and retain their classroom baseline behavior.

## One store and one cookie

`login` in `app/actions.ts` performs validation, rate limiting, bound SQL and PBKDF2 verification, then calls `startSession` in `lib/account-session.ts`. The compatibility `signIn` wrapper delegates to `login`; it never creates another token.

The secure `DB` contains `account_sessions` (token digest, user ID, credential version, absolute expiry) and `account_security` (credential version and optional recovery-key digest). Session identity comes from a join with `users`, never a form-supplied identity. Issuance rechecks the verified password hash in the same SQL statement so a concurrent recovery cannot issue a session for an old password.

The 32 random bytes are encoded as 64 lowercase hex characters. Only their SHA-256 digest is stored. The browser cookie is `__Host-osl-session`, with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no Domain and an eight-hour maximum age. Malformed tokens are rejected before database work.

The old `lib/session.ts` implementation is removed. `osl_session` and any legacy `sessions` rows are never authentication sources and are not upgraded. Old users must sign in again. Login and logout expire the old cookie; legacy database rows are left untouched. This preserves account data without allowing an unversioned session to survive recovery.

## Rotation, logout and recovery

A new login revokes this browser's previous canonical token before issuing a replacement. Revocation failure fails closed, without a second token. Other browsers are unaffected. Each successful issuance removes at most 100 expired rows; expired/version-invalid records never authenticate even while retained.

Both `logout` and the compatibility `signOut` use the same implementation. It verifies same-origin and the session-derived CSRF field without first reading the database, then deletes the canonical token and expires both cookie names. A database failure still clears the current browser's cookies and redirects, with an outcome-only log. It cannot guarantee server-side revocation during that outage: a copied token could work when the store returns until expiry or password recovery. Do not describe this as guaranteed global logout.

Password recovery atomically changes the password and credential version and consumes the recovery key. Both protected pages immediately reject all sessions with the old version. Recovery does not sign the caller in. See [private account security](ACCOUNT-SECURITY.md) for the recovery threat model and limitations.

## CSRF and cache policy

The framework dispatches server actions through POST and checks Origin. The application additionally rejects missing, noncanonical, foreign and insecure non-local origins. Logout and recovery-key enrollment require the session-derived CSRF field. The browser's Strict cookie policy adds another layer, but the HTTP scripts deliberately supply cookies on forged requests to test server enforcement independently.

Both protected routes, the login page and recovery routes receive private/no-store response policy. Both protected page components are dynamic and disable revalidation.

## Verification

- `pnpm test`: real actions against disposable SQLite and actual Workers/D1 tests. Session regressions cover both wrappers, versioned recovery revocation, logout from either entrypoint, token format/digest storage, expiry, re-login, legacy-cookie rejection and database failure behavior.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- `pnpm test:http` after build: real production bundle and rendered server-action forms in disposable local Workers/D1, including both protected routes, recovery, logout, replay, Origin/CSRF and cache headers.
- `node scripts/session-csrf-check.mjs http://localhost:5179`: optional local-only smoke check against a running dev server. It refuses non-loopback origins and uses fictional demo credentials.

Matthew's original seven-check local runtime report and negative controls remain available in PR #34 and commit `8ff4d86`; they describe the earlier 30-minute/Lax-cookie implementation, not this integration. Current verification must be run against the integration's exact commit, rather than inherited from that report.

## Deployment and limits

No deployment, wiki publication or hosted database change is part of this branch. Additive account tables are created lazily only when the application runs with a secure DB binding. The production build must have `DB` and no `LAB_DB`.

Production requires HTTPS. For local browser checks, use a browser that supports Secure localhost cookies or local HTTPS; there is no insecure-cookie fallback. The HTTP suite is not a browser rendering, cookie-policy or SameSite simulation. Idle timeout, MFA and a separate log-out-everywhere control are not implemented.

### Integration regression evidence

The unified implementation was checked locally with Node 24.22.1 against both original branch parents (`684ae79` and `8ff4d86`). The session suite includes 15 regressions; the built-app HTTP suite exercises both protected routes and real recovery/logout forms, and the standalone localhost smoke check passes all eight checks. These are local/disposable tests, not a hosted deployment or live-browser cookie-policy verification.

In an isolated temporary copy, restoring the old session actions/backend/page reproduced both integration failures: `/account` logout left the canonical session active, and `/account` still rendered after the credential version changed. Moving session creation ahead of failed old-token revocation also made its regression fail. The same three checks pass with the unified implementation. Test code and reproducible assertions are in `tests/session.test.mjs` and `scripts/check-account-http.mjs`.
