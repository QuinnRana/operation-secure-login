# Private account security

## Sessions

The server issues a fresh 256-bit random token after a successful credential check. The browser receives it in an eight-hour `__Host-osl-session` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and root-path flags. The database stores only its SHA-256 digest. Session identity comes exclusively from a server-side join with the user and credential-version records, never a submitted username or user ID.

Sign-in rotates the current browser's token. Sign-out deletes the server-side record and expires the cookie. Authentication checks both absolute expiration and credential version on every lookup. Password recovery rotates the credential version, immediately invalidating every older session, including sessions on other devices. Revoked rows may remain until expiry cleanup; their presence does not grant access.

## Request authorization

Account mutations require a canonical same-origin `Origin` matching the request `Host`. Missing, foreign, malformed, and insecure non-local origins fail closed. Authenticated sign-out and recovery-key enrollment additionally require a session-derived CSRF token. Enrollment requires the exact current password and rechecks session validity and password hash at the final write to reject revocation/reset races.

The application relies on the hosting platform to route requests to the correct trusted host and on framework server actions to enforce POST dispatch. HTTPS is required for production cookies.

## Password recovery

A signed-in user can generate a 256-bit recovery key after verifying their password. The raw key is returned once; only its digest is persisted. Generating another key replaces the previous one. Users must store their key privately before losing access. There is no email recovery service or support bypass: without the password or a saved valid recovery key, this implementation cannot restore an account.

Recovery requires a username, valid key, and matching new passwords of 12–1024 JavaScript string code units. Password whitespace and Unicode representation are preserved exactly. A transactional D1 batch updates the salted password hash and consumes the key while changing the credential version. Conditional updates ensure simultaneous attempts with one key have only one winner. A failed transaction leaves the password and key unchanged. Recovery does not automatically sign in the caller.

The shared `student` demonstration account cannot enroll a recovery key or change its password through recovery. It is not a private account.

## Abuse controls and operational limits

Recovery has independent one-minute quotas: five attempts per hashed username and ten globally. Requests that reach quota reservation consume quota even when successful. Enrollment shares the login password-check quota. Counters saturate without extending the window and are reserved through atomic SQL writes.

These global limits are intentionally conservative for a training application and may deny service to legitimate users under sustained abuse. Production deployments should add trusted per-client/network controls and observability rather than remove the global backstop. The application does not implement MFA, email verification, active-device management, or automatic account rescue.

## Regression tests

Run `node --test tests/account-security.test.mjs` or `npm test` with Node 22.13+ and dependencies installed. Tests transpile and execute the real TypeScript modules against disposable in-memory SQLite databases. Their D1 adapter executes transactional batches with `RETURNING` results and rollback on failure; it does not substitute mocked authentication logic.

Coverage includes secure cookies, hashed session storage, rotation, tampered tokens, expiry, old-credential rejection, origin checks, CSRF, password-gated enrollment, demo exclusions, hashed/rotating/single-use recovery keys, all-session invalidation, exact password preservation, concurrent recovery, atomic rollback, database failures, malformed/duplicate/uploaded fields, quota behavior, and enrollment revocation races. The Workers suite additionally tests actual local D1 transactions, simultaneous recovery, cookies, CSRF, persistence across runtime restart, and isolation from the lab database. Hosted deployment is not exercised by these tests.

Run `npm run build && npm run test:http` for built-app HTTP checks. These load the production bundle in a disposable Workers runtime and submit the rendered forms through the real framework, covering cookie delivery, protected dashboard redirects, CSRF/origin checks, recovery and logout, and private/no-store responses. They do not substitute request/cookie mocks or exercise browser JavaScript, animations, or layout.
