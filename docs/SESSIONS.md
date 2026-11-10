# Login sessions (issue #9)

The rubric requires a real logged-in state, so a successful login on `/` now starts a server-side session instead of only showing a message.

## What a user sees

1. Log in on `/` as `student` / `Training123!`. The browser is redirected to `/account`, which shows "Signed in as student", when the session expires, and a **Log out** button.
2. Opening `/account` without a valid session redirects to `/`.
3. **Log out** ends the session and redirects to `/`. Opening `/account` afterwards redirects to `/` again.
4. A session lasts 30 minutes from login. After that, `/account` redirects to `/` and the expired session is deleted.

Wrong, blank, oversized and rate-limited logins behave exactly as before and start no session. The Attack Lab and defended lab logins do not create sessions.

## How it works

| Part | Where | Behavior |
|---|---|---|
| Credential check | `login` in `app/actions.ts` (unchanged) | Input limits, rate limit, bound SQL lookup, PBKDF2 hash compare |
| Sign-in | `signIn` in `app/session-actions.ts` | Calls `login`; only on success creates a session, sets the cookie, and redirects to `/account` |
| Session store | `lib/session.ts`, `sessions` table in the secure `DB` | `token_hash`, `username`, `created_at`, `expires_at` (milliseconds) |
| Protected page | `app/account/page.tsx` | Reads the cookie and checks it against `sessions` on the server for every request |
| Logout | `signOut` in `app/session-actions.ts` | Deletes the session row, deletes the cookie, redirects to `/` |

**Token:** 32 random bytes from `crypto.getRandomValues`, sent as 64 hex characters. The table stores only its SHA-256 digest, so a copy of the table cannot be used as a cookie. Cookie values that are not exactly 64 hex characters are rejected before any database access.

**Cookie `osl_session`:** `HttpOnly` (page scripts cannot read it), `SameSite=Lax`, `Path=/`, `Max-Age` of 30 minutes, and `Secure`. `Secure` is left off only when the request's `Origin` is plain-http `localhost`, `127.0.0.1` or `[::1]`, so the local development server works over http. A missing or any other origin gets `Secure`.

**Expiry and cleanup:** expiry is absolute (30 minutes from login, not extended by activity) and is enforced by the server, not only by the cookie lifetime. An expired session is deleted when it is next used. Each new login also deletes up to 100 expired rows.

**Multiple logins:** each login gets its own token. Logging out ends only the session in that browser.

## Cross-site request forgery (CSRF)

Login and logout are server actions, which the framework accepts only as `POST` requests. vinext rejects a server-action request whose `Origin` header does not match the site's host (read from `node_modules/vinext/dist/server/request-pipeline.js`; requests with no `Origin` header are allowed). Separately, `SameSite=Lax` means browsers do not send the session cookie on cross-site `POST` requests, so a forged logout cannot reach a user's session. No other action changes state using the session cookie. These two layers were checked by reading the framework source, not by an attack test.

## Database and deployment

`sessions` is created lazily in the secure `DB` on first use, like `users` and `login_attempt_limits`. A future deployment would add this table to the hosted database on the first login. This change does not deploy, provision or modify a live database.

## Tests

`pnpm test` runs `tests/session.test.mjs`, which runs the real actions against in-memory SQLite with a fixed clock and stand-ins for the framework's `cookies()`, `headers()` and `redirect()`. It checks:

- a valid login redirects to `/account`, sets the cookie with the attributes above, and stores only the token digest
- the cookie is `Secure` for an https origin, a missing origin, and a lookalike host
- wrong, unknown, blank and throttled logins start no session and set no cookie
- missing, malformed, injection-shaped, unknown and tampered tokens are rejected; a session is valid just before 30 minutes and rejected (and deleted) at 30 minutes
- logout deletes the row and the cookie, and the old token no longer works; logging out twice is harmless
- separate logins get separate tokens, and logging out one leaves the other valid
- expired-row cleanup removes at most 100 rows per login

Negative controls each made at least one test fail: storing the raw token, ignoring expiry, logout without deleting the row, a non-`HttpOnly` cookie, and starting a session without checking the result of `login`.

## Not covered

- Session rotation on privilege change, idle timeout, and "log out everywhere" are not implemented.
- Sessions are not shared with the lab pages.
- Browser behavior of `Secure` cookies on plain-http localhost differs between browsers. Chromium accepts them; that is why `Secure` is dropped only for local http.
