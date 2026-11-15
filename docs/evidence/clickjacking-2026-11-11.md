# Clickjacking and cross-site cookie evidence — November 11, 2026

Evidence for the security headers added for [issue #9](https://github.com/QuinnRana/operation-secure-login/issues/9) and the browser-side `SameSite=Lax` behavior of the session cookie. All data is fictional; both servers ran only on this computer.

## Setup

| Field | Value |
|---|---|
| App | `pnpm dev --host 127.0.0.1 --port 5179` on branch `agent/security-headers` (from `codex/development` `a8240e9`); the server printed `http://localhost:5179/` |
| "Attacker" page | A local HTML file served at `http://127.0.0.1:5199/` (`python3 -m http.server`) with two frames: `http://localhost:5179/` and `http://localhost:5179/account` |
| Browser | The Claude desktop app's built-in Chromium browser |
| Signed in | Yes: the browser logged in as `student` on `http://localhost:5179` first |

`localhost` and `127.0.0.1` are different sites to the browser, so the frames are cross-site, as they would be for a real attacker.

## Results

| Run | App headers | Frame 1 (`/`) | Frame 2 (`/account`) | Screenshot |
|---|---|---|---|---|
| Before | None (for this run only, `next.config.ts` was temporarily replaced with the `codex/development` version, which sets no headers; the branch version was put back afterwards) | **Loaded the login page inside the attacker's frame**: clickjacking possible | Loaded the **login page**, not the account page | [01](clickjacking-2026-11-11/01-before-framing-allowed.jpg) |
| After | `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | **Blocked** (empty frame) | **Blocked** (empty frame) | [02](clickjacking-2026-11-11/02-after-framing-blocked.jpg) |

In the "after" run the browser console reported, for both frames: *Framing 'http://localhost:5179/' violates the following Content Security Policy directive: "frame-ancestors 'none'". The request has been blocked.* (Frame 2 also names `/`, because `/account` redirected there first; see below.)

## The cookie result

In the "before" run Frame 2 showed the login page, even though the same browser was signed in. Opening `http://localhost:5179/account` directly in that browser right afterwards showed "Signed in as student". So the browser did **not** send the session cookie with the cross-site frame request, and `/account` redirected to `/`.

This is consistent with the cookie's `SameSite=Lax` setting, which withholds it from cross-site frame requests. The cause was not isolated, though: if the browser blocks third-party cookies in general, the result would look the same, and that setting was not checked (no cookie-exclusion reason was recorded from the browser's developer tools). It covers a framed `GET`; a cross-site form `POST` was not tried in the browser.

## Automated checks

- `tests/security-headers.test.mjs` (in `pnpm test`) checks that the header rules give all four headers to `/`, `/account`, `/attack-lab`, `/defended-lab` and an unknown path. It fails if the separate rule for `/` is removed: vinext's `/:path*` pattern does not match the bare root.
- `node scripts/session-csrf-check.mjs http://localhost:5179` now also checks the four headers on `/` and `/account` and the signed-in link on `/`.
- The production build (`pnpm build`, then `wrangler dev` on the build) sent the four headers on `/` and `/defended-lab`.

## Limits

- Redirect responses (for example `/account` without a session) carry no page and do not get these headers.
- The CSP sets only `frame-ancestors`; a full script policy would need nonces for the framework's inline scripts.
- The screenshots show the attacker page only. They do not prove which commit ran; this record states it.
