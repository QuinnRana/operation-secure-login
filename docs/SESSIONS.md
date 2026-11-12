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
| Sign-in | `signIn` in `app/session-actions.ts` | Calls `login`; only on success ends this browser's previous session (if any), creates a new one, sets the cookie, and redirects to `/account` |
| Session store | `lib/session.ts`, `sessions` table in the secure `DB` | `token_hash`, `username`, `created_at`, `expires_at` (milliseconds) |
| Protected page | `app/account/page.tsx` | Reads the cookie and checks it against `sessions` on the server for every request |
| Logout | `signOut` in `app/session-actions.ts` | Deletes the session row, deletes the cookie, redirects to `/`. If the database fails, the cookie is still deleted and the user is still redirected; the row then ends at its normal expiry. |

**Token:** 32 random bytes from `crypto.getRandomValues`, sent as 64 lowercase hex characters. The table stores only its SHA-256 digest, so a copy of the table cannot be used as a cookie. Cookie values that are not exactly 64 lowercase hex characters are rejected before any database access.

**Cookie `osl_session`:** `HttpOnly` (page scripts cannot read it), `SameSite=Lax`, `Path=/`, `Max-Age` of about 30 minutes (computed just after the session is created and rounded down, so the browser usually sees 1799 seconds and the cookie ends just before the server-side session), and `Secure`. `Secure` is left off only when the request's `Origin` is plain-http `localhost`, `127.0.0.1` or `[::1]`, so the local development server works over http. A missing or any other origin gets `Secure`.

**Expiry and cleanup:** expiry is absolute (30 minutes from login, not extended by activity) and is enforced by the server, not only by the cookie lifetime. An expired session is deleted when it is next used. Each new login also deletes up to 100 expired rows.

**Multiple logins:** each login gets its own token. Logging in again in the same browser ends that browser's previous session. Logins in other browsers are separate, and logging out ends only the session in that browser.

## Cross-site request forgery (CSRF)

Login and logout are server actions, which vinext 1.0.0-beta.5 handles only for `POST` requests and checks with `validateCsrfOrigin` before running them (`node_modules/vinext/dist/server/app-server-action-execution.js` calls it for both the no-JavaScript form path and the fetch path; the check itself is in `request-pipeline.js`). A request whose `Origin` host differs from the site's `Host`, or whose `Origin` is `null`, gets `403`. A request with no `Origin` header is allowed. Separately, `SameSite=Lax` means browsers do not send the session cookie on cross-site `POST` requests. No other action changes state using the session cookie.

### Runtime verification

`node scripts/session-csrf-check.mjs http://localhost:5179` runs against a local dev server (it refuses any other host) and sends the same no-JavaScript form posts a browser would, using only the demo account. On November 10 against `localhost:5179` it passed all seven checks:

| Check | Result |
|---|---|
| `GET /account` with no session | `307` to `/` |
| Login with `Origin: https://attacker.example` | `403`, no cookie set |
| Login with `Origin: null` | `403` |
| Same-origin login | `303` to `/account`; cookie `Path=/`, `Max-Age=1799`, `HttpOnly`, `SameSite=lax`, no `Secure` on local http |
| `GET /account` with that cookie | Signed-in page |
| Logout with `Origin: https://attacker.example` and the valid cookie | `403`, no cookie change, still signed in afterwards |
| Same-origin logout | `303` to `/`, cookie cleared, the old cookie then gets `307` to `/` |

The forged requests deliberately carried the session cookie, so this tests the `Origin` check on its own. In a real browser the cookie was also not sent cross-site: on 2026-11-11 a signed-in Chromium browser loaded `/account` inside a frame on another site and got the login page, while opening `/account` directly showed the signed-in page ([clickjacking evidence](evidence/clickjacking-2026-11-11.md)). That is consistent with `SameSite=Lax`, but the cause was not isolated: the browser's third-party-cookie blocking would give the same result and was not ruled out. It covers a framed `GET`; a cross-site form `POST` was not tried in the browser. The script now also checks the security headers below and the signed-in link on `/`.

## Clickjacking protection and security headers

Every app route sends four headers, set in `next.config.ts` (static files in `public/`, such as the project dashboard, are served directly and were not checked):

| Header | Value | Effect |
|---|---|---|
| `Content-Security-Policy` | `frame-ancestors 'none'` | Browsers refuse to show the page inside another site's frame, so an attacker cannot overlay the Log in or Log out button with invisible clicks |
| `X-Frame-Options` | `DENY` | The same protection for older browsers |
| `X-Content-Type-Options` | `nosniff` | Browsers must not reinterpret a response as a different content type |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other sites see only this site's origin, not full page URLs |

vinext's `/:path*` pattern does not match the bare root, so `/` has its own rule; `tests/security-headers.test.mjs` fails if that rule is removed. Redirect responses carry no page and do not get these headers. The CSP sets only `frame-ancestors`; a full script policy would need nonces for the framework's inline scripts. A before/after browser test with an attacker page on another origin is in the [clickjacking evidence](evidence/clickjacking-2026-11-11.md).

## Home page

When a valid session cookie is present, `/` shows "Signed in as *name*" with a link to `/account` above the login form. A missing, tampered or malformed cookie, or a session-store error, shows the plain login form. The page is rendered per request and sent with `Cache-Control: no-store`, so one user's name is never cached for another.

An expired session was also checked end to end: after logging in, `/account` returned `200`; after the session's `expires_at` was set to the past in the local secure database, `/account` returned `307` to `/` and the row was deleted.

## Database and deployment

`sessions` is created lazily in the secure `DB` on first use, like `users` and `login_attempt_limits`. A future deployment would add this table to the hosted database on the first login. This change does not deploy, provision or modify a live database.

## Tests

`pnpm test` runs `tests/session.test.mjs`, which runs the real actions against in-memory SQLite with a fixed clock and stand-ins for the framework's `cookies()`, `headers()` and `redirect()`. It checks:

- a valid login redirects to `/account`, sets the cookie with the attributes above, and stores only the token digest
- the cookie is `Secure` for an https origin, a missing origin, and a lookalike host
- wrong, unknown, blank and throttled logins start no session and set no cookie
- missing, malformed, injection-shaped, unknown and tampered tokens are rejected; a session is valid just before 30 minutes and rejected (and deleted) at 30 minutes
- logout deletes the row and the cookie, and the old token no longer works; logging out twice is harmless
- a new login in the same browser ends its previous session, while another browser's session stays valid
- if the session store fails, logout still clears the cookie and redirects, and login returns an error without setting a cookie
- expired-row cleanup removes at most 100 rows per login

Negative controls each made at least one test fail: storing the raw token, ignoring expiry, logout without deleting the row, a non-`HttpOnly` cookie, starting a session without checking the result of `login`, not ending the previous session on re-login, and letting a database error stop logout.

## Automated framework regression check

Run `pnpm test:sessions:runtime` after installing dependencies. The runner starts
its own loopback-only Vite/vinext server in a fresh temporary source copy with
empty local D1 state, runs all nine checks in `session-csrf-check.mjs`, and removes
the fixture afterwards. It accepts no URL and never copies `.env` files or an
existing `.wrangler` database. The server must own its selected port before any
login/logout checks are sent. Node 22.13+ and local runtime sockets are required.

The Security and build checks workflow runs this command on each push and pull
request, alongside the unit/Workers suite. It verifies actual framework action
routing, cross-origin rejection, cookie attributes, protected-route access,
security headers, signed-in rendering, logout, and rejection of the old token.
This closes the gap where these checks were manual only. It is HTTP evidence,
not a real-browser SameSite test or a production-hosting certification. No lab
application code, baseline evidence, or hosted configuration is changed.

## Not covered

- Idle timeout and "log out everywhere" are not implemented.
- Sessions are not shared with the lab pages.
- Some browsers do not accept `Secure` cookies over plain-http localhost, which is why `Secure` is dropped only for local http. Which browsers behave which way was not tested here; the in-app Chromium browser worked.
- A cross-site form `POST` in a real browser (as opposed to a framed `GET`) and the no-`Origin` case were not tested at runtime.
- The browser test showed the session cookie was not sent in a cross-site frame, but did not isolate whether `SameSite=Lax` or third-party-cookie blocking caused it.
- If a hosting platform shows the site inside its own preview frame, `frame-ancestors 'none'` would block that preview. Not checked.
