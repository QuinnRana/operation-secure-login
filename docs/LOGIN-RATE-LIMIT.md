# Login attempt budgets and audit events

Scope: issue #10, the secure `/` and `/defended-lab` server actions. The intentionally vulnerable `/attack-lab` and its fictional baseline stay unchanged.

## Policy

After existing single-text-field and length validation, reserve from a shared budget of **60 login attempts per database per 60-second window**, starting with the first request. All valid-shaped attempts count, including successes and requests that later hit an account limit. Attempt 61 and later return the existing generic retry message before username hashing, account-budget work, account lookup or password hashing. The shared counter saturates at 61, blocked requests do not move its expiry, and the next request at expiry starts a new window. Changing usernames cannot bypass this work cap.

Within that shared budget, allow five attempts for each account identity in a fixed 60-second window starting with the first attempt. Count successes and failures alike. Attempt six and later return a generic retry message before account lookup, seed hashing or password verification. Blocked attempts do not extend the expiry, and success does not reset quota. At expiry the next attempt starts a new window. The same policy applies to nonexistent usernames, preserving the generic wrong-credential response for admitted requests.

Identity matches each case-sensitive SQL lookup: `/` trims username edges; `/defended-lab` preserves them. Both preserve case and Unicode and never transform passwords. Padding or changing case cannot authenticate as an existing defended account. Malformed/empty credentials are rejected and logged before database access; they do not consume either budget. Other form fields and untrusted forwarding headers cannot choose or reset the limiter identity.

## Shared storage and failures

`DB` holds the secure login budget; `LAB_DB` holds the defended login budget in its own `login_attempt_limits(account_key, attempts, expires_at)` table with an expiry index. The same username has independent quotas in the two databases. Neither lab reset clears either quota. Keys are SHA-256 digests of the endpoint’s account identity; no passwords, IPs, usernames or tokens are stored in the limiter table. Digests are not anonymization: common names can be guessed offline. The intentionally vulnerable lab can read tables in its shared `LAB_DB`, including these digests; this is not a confidentiality boundary. Only fictional lab identities belong there.

Each database also has a separate singleton `login_global_limit(scope, attempts, expires_at)` table. Its fixed `global` scope stores no account identity. Separate atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` statements reserve the global attempt first and then the account attempt, returning each counter. The account counter saturates at six. A rejected global reservation does not initialize, clean up, create or update account-limit rows. A later account/storage failure does not refund global quota, so failures cannot restore work capacity. There is no process-local budget or separate read/check/write race. Workers must share the same D1 database for the corresponding endpoint; independently configured databases do not share limits. Each globally admitted request removes at most 100 expired account-limit rows through the expiry index. At most 60 requests per global window can reach this cleanup or create new account-limit rows, even with rotating usernames. No account or lab data is deleted. Without subsequent traffic, expired rows remain until cleanup is next triggered.

If budget storage or authentication database work fails, the action fails closed with a generic temporary-unavailability response. Raw exceptions are not logged or returned. Limiter schema creation follows the existing application's lazy initialization convention; a future deployment would add these tables/index to the corresponding DB on the first valid-shaped request. This feature branch does not deploy, provision or modify a live database.

## Logs

Each result emits one JSON console event with exactly `event`, `outcome`, and `timestamp` (server UTC ISO time). Event is `secure_login` or `defended_login` according to the endpoint; outcomes are `invalid_input`, `denied`, `success`, `throttled`, or `unavailable`. Credentials, usernames, account keys, SQL, request headers, tokens and raw exception contents are never included. Logs support aggregate outcome/cooldown evidence, not per-person attribution. Hosting log retention, sampling and access policies remain operator-controlled; this patch does not configure them.

## Tradeoffs and limits

These are account and database-wide work budgets, not per-IP limits. No reliable trusted client identity contract has been established for this Sites deployment; accepting client-supplied IP headers would be spoofable. A shared classroom account can exhaust its quota, and an outsider can temporarily deny that account attempts. The shared cap is intentionally conservative for this small classroom service. An outsider or busy class can also exhaust all 60 slots and temporarily block every login in that database, including correct credentials. Switching usernames does not help once the shared budget is exhausted. Each window expires after one minute, but sustained abuse can exhaust later windows too; coordinate demonstrations accordingly. A fixed window permits bursts around its boundary, and quota follows server time, so substantial clock skew affects expiry.

The shared cap limits admitted login work and account-row creation, not incoming requests or all database work: even blocked requests still perform singleton schema/reservation operations and emit a safe outcome event. Existing expired account rows are cleaned incrementally, not by a destructive migration. The intentionally vulnerable login and lab reset endpoints remain outside this login-specific cap; defended reset can still do password hashing. This is not a network/body-size limit, distributed-denial-of-service defense, session system, or general production-authentication certification. Review trusted edge/client controls separately if the site's exposure changes.

## Reproduce checks locally

Install with the locked dependencies, then run:

```sh
node --test tests/login-rate-limit.test.mjs tests/defended-rate-limit.test.mjs tests/login-global-budget.test.mjs
pnpm test:workers
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

The SQLite tests use a deterministic clock to verify five denied attempts, throttling (including correct credentials), no cooldown extension, success at the exact expiry, distinct unknown-account quotas, no reset on success, bounded cleanup, unrelated-data preservation, safe storage failure, and fixed-schema logs without credential leakage. The Workers test sends twenty concurrent attempts across two Workers sharing D1 and expects exactly five admitted credential checks and fifteen throttled requests. Existing tests retain Unicode/password semantics, invalid-input bounds, portable PBKDF2, and lab isolation/baseline behavior. All data is disposable and local; no live endpoint is attacked.

The defended regressions additionally verify exact untrimmed identity, reset-resistant quota, and twenty concurrent requests across two Workers sharing LAB_DB (five admitted, fifteen throttled). They verify that both lab resets preserve the budget, the vulnerable payload still exposes three fictional records, and exhausting a lab username does not consume the secure database budget. The deterministic test prints only the safe outcome events for failures, throttle and exact cooldown recovery. These are automated local results, not a team rehearsal or hosted-site test.

The global-budget regressions reproduce the rotating-username gap before this change: 120 concurrent distinct usernames across two Workers were all admitted. With the cap, exactly 60 are admitted and only 60 account-limit rows exist. Tests also check exact cooldown recovery, saturated counters, skipped identity/credential work on global denial, malformed reservation and storage failure handling, invalid-input exclusion, fixed-schema logs, independent DB/LAB_DB budgets, both resets preserving exhausted quota, and the unchanged fictional baseline. No live load test is performed.
