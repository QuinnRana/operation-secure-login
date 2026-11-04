# Secure login attempt budget and audit events

Scope: issue #10, the defended `/` server action. The intentionally vulnerable `/attack-lab` and its fictional baseline stay unchanged. Step #8's separately defended lab implementation is still pending; this control does not complete that dependency or protect that deliberately vulnerable endpoint.

## Policy

After existing single-text-field and length validation, allow five attempts for each exact trimmed username in a fixed 60-second window starting with the first attempt. Count successes and failures alike. Attempt six and later return a generic retry message before account lookup, seed hashing or password verification. Blocked attempts do not extend the expiry, and success does not reset quota. At expiry the next attempt starts a new window. The same policy applies to nonexistent usernames, preserving the generic wrong-credential response for admitted requests.

The identity matches the current case-sensitive SQL lookup: trim username edges, preserve case and Unicode, and never transform passwords. Malformed/empty credentials are rejected and logged before database access; they do not consume an account budget. Other form fields and untrusted forwarding headers cannot choose or reset the limiter identity.

## Shared storage and failures

`DB` holds `login_attempt_limits(account_key, attempts, expires_at)` with an expiry index. Keys are SHA-256 digests of the normalized username; no passwords, IPs, usernames or tokens are stored in the limiter table. Digests are not anonymization: common names can be guessed offline. Do not expose the table.

A single `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` atomically reserves the attempt and returns the resulting counter. It saturates at six. There is no process-local budget or separate read/check/write race. Workers must share the same secure D1 database; independently configured databases do not share limits. Each request removes at most 100 expired limiter rows through the expiry index. No account or lab data is deleted. Without subsequent traffic, expired rows remain until cleanup is next triggered.

If budget storage or authentication database work fails, the action fails closed with a generic temporary-unavailability response. Raw exceptions are not logged or returned. Limiter schema creation follows the existing application's lazy initialization convention; a future deployment would add this table/index to its secure DB on the first valid-shaped request. This feature branch does not deploy, provision or modify a live database.

## Logs

Each result emits one JSON console event with exactly `event`, `outcome`, and `timestamp` (server UTC ISO time). Event is `secure_login`; outcomes are `invalid_input`, `denied`, `success`, `throttled`, or `unavailable`. Credentials, usernames, account keys, SQL, request headers, tokens and raw exception contents are never included. Logs support aggregate outcome/cooldown evidence, not per-person attribution. Hosting log retention, sampling and access policies remain operator-controlled; this patch does not configure them.

## Tradeoffs and limits

This is an account budget, not a per-IP limit. No reliable trusted client identity contract has been established for this Sites deployment; accepting client-supplied IP headers would be spoofable. A shared classroom account can exhaust its quota, and an outsider can temporarily deny that account attempts. The one-minute fixed cooldown bounds that delay; coordinate demonstrations accordingly. A fixed window permits bursts around its boundary, and quota follows server time, so substantial clock skew affects expiry.

Attackers can rotate usernames to avoid a single account budget and create many short-lived rows. Bounded cleanup controls work per request, not aggregate request volume or database size under sustained abuse. This is not a network/body-size limit, global traffic cap, distributed-denial-of-service defense, session system, or general production-authentication certification. Review trusted edge/client controls separately if the site's exposure changes.

## Reproduce checks locally

Install with the locked dependencies, then run:

```sh
node --test tests/login-rate-limit.test.mjs
pnpm test:workers
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

The SQLite tests use a deterministic clock to verify five denied attempts, throttling (including correct credentials), no cooldown extension, success at the exact expiry, distinct unknown-account quotas, no reset on success, bounded cleanup, unrelated-data preservation, safe storage failure, and fixed-schema logs without credential leakage. The Workers test sends twenty concurrent attempts across two Workers sharing D1 and expects exactly five admitted credential checks and fifteen throttled requests. Existing tests retain Unicode/password semantics, invalid-input bounds, portable PBKDF2, and lab isolation/baseline behavior. All data is disposable and local; no live endpoint is attacked.
