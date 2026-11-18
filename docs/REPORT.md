# Build–Attack–Defend report

The project's final technical report: what was built, how it was attacked, how each defense was added, the evidence that each defense works, and what the build still does not stop. Part of [issue #12](https://github.com/QuinnRana/operation-secure-login/issues/12).

Based on `codex/development` `caba9c6` (2026-11-18). All data is fictional, and every attack ran only against a local development server.

**Contents:** [Build](#build) · [Attack](#attack) · [Defend](#defend) · [Plain-language explanations](#plain-language-explanations) · [Test results](#test-results) · [Residual risk](#residual-risk) · [Evidence index](#evidence-index)

---

## Build

A database-backed username/password login site, plus two deliberately separate training labs.

| Page | Purpose |
|---|---|
| `/` | The **secure login**. A successful login starts a server-side session and opens `/account`. |
| `/account` | A protected page. Without a valid session it redirects to `/`. |
| `/attack-lab` | The **intentionally vulnerable** login, kept as the "before" state. It shows the SQL it ran. |
| `/defended-lab` | The **same lab accounts, defended**: the "after" state. |

The app is one vinext (Next.js-compatible) app on the Cloudflare Workers runtime, using two Cloudflare D1 (SQLite) databases:
- **`DB`** holds the secure login's users, sessions and rate-limit counters.
- **`LAB_DB`** holds only fictional lab data. Only the local development server provides it.

The lab code is given only `LAB_DB` and refuses to run without a separate one, and tests check this locally. Hosted isolation is not verified. See the [architecture and data-flow diagram](ARCHITECTURE.md) and [database isolation](DATABASE-ISOLATION.md).

**Why these choices.** The team's starting point was a working login with an SQL-injection lab next to it ([commit `d351791`](https://github.com/QuinnRana/operation-secure-login/commit/d351791), 2026-09-01; see the [wiki](https://github.com/QuinnRana/operation-secure-login/wiki/History-and-Decisions)).
- The lab got its own database so a successful injection could not touch real login data (#5).
- The vulnerable lab was kept rather than fixed, so the same attack can be shown failing on a defended copy (#8).

**Build evidence:** the [secure login run](evidence/secure-login-2026-11-04.md) (valid, wrong, unknown, empty and oversized input, with 5 screenshots), and the [isolation tests](DATABASE-ISOLATION.md#regression-checks).

## Attack

**Threat:** SQL injection against a login form, leading to authentication bypass and data exposure.

The vulnerable lab builds its SQL by pasting the form fields straight into the query text (`app/attack-lab/actions.ts`, line 65):

```ts
`SELECT display_name, role, private_note FROM lab_accounts WHERE username = '${username}' AND password = '${password}'`
```

With the username `' OR 1=1 --` and any password, the database receives:

```sql
SELECT display_name, role, private_note FROM lab_accounts
WHERE username = '' OR 1=1 --' AND password = 'anything'
```

**Root cause:** user input is treated as **SQL code instead of data**.
- The quote closes the string.
- `OR 1=1` makes the condition true for every row.
- `--` comments out the password check.

The page treats the returned rows as a successful login.

**Result:** "Login bypassed. 3 fictional records exposed." This showed all three accounts' names, roles and private notes without knowing any password.

**Evidence:** the [baseline record](evidence/attack-baseline-2026-11-11.md) (#7): a reset first, a wrong password, a real password, then the payload, with screenshots. It is reproducible with `node scripts/attack-baseline-log.mjs <local URL>`. That script refuses any non-local target.

## Defend

Each control below is shown working against the attack it was chosen for. The last column links to a before/after browser result where one exists, and otherwise names the automated test that checks the control.

| # | Control | Stops | Where in the code | Before → after evidence |
|---|---|---|---|---|
| 1 | **Bound parameters** (prepared statements) | SQL injection | `app/actions.ts`, `app/defended-lab/actions.ts` | `' OR 1=1 --` exposed 3 records, then got "The username or password is incorrect." ([matrix case 6](evidence/before-after-2026-11-09.md), screenshots 01 → 02) |
| 2 | **PBKDF2-SHA-256 password hashes** (120,000 iterations). The defended lab uses a random salt per account; the secure login's one demo account uses a fixed salt written in the source (see [residual risk](#residual-risk)). | Plaintext passwords leaking from a stolen table | `lib/password.ts`, `app/actions.ts`, `app/defended-lab/actions.ts` | The vulnerable lab table stores plaintext; the defended table stores only salts and hashes ([DEFENDED-LAB.md](DEFENDED-LAB.md)). The test "defended accounts store unique salted hashes and never plaintext passwords" in `tests/defended-lab.test.mjs` checks this. |
| 3 | **One generic failure message** | Learning which usernames exist from the error text | `app/actions.ts`, `app/defended-lab/actions.ts` | On the defended lab, a wrong password and the payload return the same message ([matrix cases 2 and 6](evidence/before-after-2026-11-09.md)). On the secure login, an unknown user gets that same message ([secure login run, case 3](evidence/secure-login-2026-11-04.md)). `tests/defended-lab.test.mjs` checks wrong and unknown users on the defended lab. |
| 4 | **Rate limiting**: 5 attempts per account per 60 seconds | Password guessing (brute force) | `lib/login-security.ts` | The 6th attempt for `casey` got "Too many login attempts", and a 7th with the correct password was still refused ([matrix cases 8–9](evidence/before-after-2026-11-09.md), screenshot 03) |
| 5 | **Outcome-only security logging** | Attacks going unnoticed | `lib/login-security.ts` | One JSON event per attempt with exactly `event`, `outcome` and `timestamp`, and no usernames or passwords ([LOGIN-RATE-LIMIT.md](LOGIN-RATE-LIMIT.md#logs)); the server-log outcome totals from the browser run are in the [matrix](evidence/before-after-2026-11-09.md) |
| 6 | **Input limits** | Oversized or malformed input reaching the database or hashing | `app/actions.ts`, `app/defended-lab/actions.ts` | An oversized username got the length-limit message ([secure login run](evidence/secure-login-2026-11-04.md), screenshot 05). The test "malformed and oversized credentials are rejected before DB access" shows it happens before any database work. |
| 7 | **Server-side sessions** with a hashed token | A login that proves nothing to the next page; stolen session tables being reused | `lib/session.ts`, `app/session-actions.ts` | `/account` without a session redirects to `/`; logout deletes the session ([SESSIONS.md](SESSIONS.md)); forged cross-site logins got `403` (`scripts/session-csrf-check.mjs`) |
| 8 | **Anti-framing headers** | Clickjacking: hiding the real page under an attacker's page | `next.config.ts` | Before: the login page loaded inside an attacker's frame. After: the frame is blocked ([clickjacking evidence](evidence/clickjacking-2026-11-11.md), screenshots 01 → 02) |
| 9 | **Separate lab database** | An injection reaching real users or sessions | `lib/lab-db.ts` | Injections that reference `users` fail, and resetting the lab leaves secure data unchanged: `pnpm test:isolation` ([isolation tests](DATABASE-ISOLATION.md#regression-checks)) |

The vulnerable `/attack-lab` is **unchanged on purpose**, so the "before" state can always be shown again.

## Plain-language explanations

**Prepared statements (bound parameters).** The query is sent to the database with blank slots (`WHERE username = ?`), and the user's input is sent separately to fill those slots. The database always treats what fills a slot as *a value to compare*, never as SQL. `' OR 1=1 --` becomes a strange username that matches nobody, so the query's structure cannot change.

**Password hashing.** The site never stores the password itself. It stores a one-way "fingerprint" made with PBKDF2 using 120,000 iterations and a *salt*, an extra value mixed in before hashing. To check a login, it fingerprints what was typed and compares the result. If the table is stolen, the attacker gets fingerprints, not passwords, and the 120,000 iterations make every guess slow. In the defended lab each account gets its own random salt, so two people with the same password still get different fingerprints. The secure login's single demo account uses one fixed salt from the source code.

**Rate limiting.** Each account gets 5 login attempts per minute. The 6th attempt is refused without even checking the password, until the minute is up. This turns "try thousands of passwords" into "try 5 a minute". It counts per account, not per computer, because the site cannot reliably tell computers apart.

**Logging.** Every login attempt writes one line saying only *what happened* and *when* (for example `{"event":"secure_login","outcome":"throttled",...}`). That is enough to notice a burst of failures or throttles. Usernames and passwords are deliberately left out, so the log itself is not a leak.

**Sessions.** After a correct login, the server creates a long random ticket (the session token) and gives it to the browser in a cookie. Page scripts cannot read it (`HttpOnly`), and browsers do not send it with form posts or frames that come from other sites (`SameSite=Lax`). The database stores only a fingerprint of the ticket, so a copied database table cannot be used to log in. Tickets expire 30 minutes after login, and logging out destroys them.

**Anti-framing headers.** Every page tells the browser "never show me inside another website's frame". Without this, an attacker's site could load our login page invisibly and trick a user into clicking its buttons.

## Test results

On `codex/development` `caba9c6`, 2026-11-18, macOS 14.5 (arm64), Node v24.22.1, pnpm 11.25.0:

| Check | Result |
|---|---|
| `pnpm test` (Node/SQLite tests and local Workers/D1 runtime tests) | **39 passed, 0 failed** |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed |

GitHub Actions ("Security and build checks") runs the same checks on every push and pull request.

The tests use disposable fictional data and never touch a hosted database. The session tests were checked with **negative controls**: a defense was deliberately broken (for example by storing the raw session token, or by ignoring expiry) to confirm that a test then fails. See the "Tests" sections in [SESSIONS.md](SESSIONS.md) and [DEFENDED-LAB.md](DEFENDED-LAB.md).

**Browser runs** are in the [evidence index](#evidence-index). The secure login, baseline and before/after runs were each **one person's run** (Matthew, with Claude Code driving the browser); the clickjacking record does not name its runner. David separately reported a pass of the Windows security-header check on all three pages on 2026-11-14 ([LOCAL-SETUP.md](LOCAL-SETUP.md#windows-security-header-smoke-test), PR #38). A second teammate repeating the other runs is still pending (#1, #7, #11).

## Residual risk

What the build still does not stop, and why that was accepted or what partly covers it.

| Residual risk | Why it remains | Compensating control or reason accepted |
|---|---|---|
| The vulnerable `/attack-lab` still allows SQL injection | It is the "before" state the project must demonstrate | It runs only on a local dev server with fictional data. Production builds have no `LAB_DB`, so the labs say "unavailable" there. It cannot reach `DB` ([isolation](DATABASE-ISOLATION.md)). |
| An injection on `/attack-lab` can read the defended lab's salts and hashes | Both lab tables share `LAB_DB` | All lab accounts and passwords are fictional and published in the source. The defense being shown is how `/defended-lab` queries and stores passwords, not hiding its table ([DEFENDED-LAB.md](DEFENDED-LAB.md)). |
| An attacker can lock an account out for one minute (5 wrong tries) | The limit counts per account | The lockout is short and fixed. Per-IP limits were not used because the site has no trusted way to identify a client, and client-supplied IP headers can be faked ([LOGIN-RATE-LIMIT.md](LOGIN-RATE-LIMIT.md#tradeoffs-and-limits)). |
| Trying one password across many usernames (password spraying) | Each username has its own budget | Accepted for a classroom lab with no real accounts; not a production authentication service. |
| The secure login's demo account uses a fixed salt written in the source, not a random one | The account was seeded that way before this project's defenses; only the defended lab was built with per-account random salts | There is one fictional account with a published password and no registration, so a per-account salt protects nothing extra here. A real system would need a random salt per account. |
| Response timing may still hint whether a username exists | Times are not made equal | Unknown usernames are still hashed, which removes the largest difference; constant time is not promised (README, "Authentication failure work"). |
| No idle timeout, "log out everywhere", password change, account registration or multi-factor login | Not implemented | The 30-minute absolute session expiry bounds a stolen session ([SESSIONS.md](SESSIONS.md#not-covered)). |
| A cross-site form `POST` in a real browser was not tested, and requests with **no** `Origin` header pass the framework's CSRF check | Only scripted forged requests and a framed `GET` were tested; the no-`Origin` case was not tested at runtime | The `Origin` check returned `403` for forged logins, and `SameSite=Lax` keeps the cookie off cross-site posts ([SESSIONS.md](SESSIONS.md#not-covered)). |
| The rate limit uses fixed one-minute windows and has no per-request-size, global or denial-of-service limit | Simple, shared counter design | Accepted for a lab: bursts at a window's edge are possible, but every account is still capped ([LOGIN-RATE-LIMIT.md](LOGIN-RATE-LIMIT.md#tradeoffs-and-limits)). |
| The vulnerable lab can read the defended lab's rate-limit keys, which are SHA-256 digests of usernames that can be guessed offline | They share `LAB_DB` | Only fictional lab usernames are stored there ([LOGIN-RATE-LIMIT.md](LOGIN-RATE-LIMIT.md#shared-storage-and-failures)). |
| The reset buttons and the vulnerable lab login are not rate limited | They are lab tools, and the vulnerable login is the baseline | Local dev server only, with fictional data ([DEFENDED-LAB.md](DEFENDED-LAB.md#not-covered)). |
| The Content Security Policy only blocks framing; it has no script policy | A script policy would need nonces for the framework's own inline scripts | Pages show user input only as text: there is no `dangerouslySetInnerHTML` in `app/` or `components/`. Clickjacking, the threat this header was chosen for, is covered. |
| Redirect responses carry no security headers, and `frame-ancestors 'none'` would also block a hosting platform's own preview frame | Headers are set per page route; a redirect has no page to frame | A redirect shows nothing to click. The hosting-preview case was not checked ([SESSIONS.md](SESSIONS.md#not-covered), [clickjacking evidence](evidence/clickjacking-2026-11-11.md)). |
| Logs go to the server console only; retention and alerting are not set up | The hosting platform controls log storage | Accepted for a lab. The logs contain no credentials, so keeping them carries little risk. |
| Hosted-site behavior (headers, the absence of `LAB_DB`, isolation) is not verified here | Testing used local servers only | This comes from repository configuration ([isolation: build and hosting](DATABASE-ISOLATION.md#build-and-hosting)). |
| The environment is a local web app, not VMs or virtual networks | The project is a single web application | **Open question for the team and instructor:** the rubric's implementation criterion mentions VMs or virtual networks. |
| The permitted lab target and data scope are not yet confirmed by the team | Recorded as a TODO in [DATABASE-ISOLATION.md](DATABASE-ISOLATION.md#permitted-target-and-data) | The documented scope is a local dev server and fictional data only. Confirmation belongs to #2. |

## Evidence index

All evidence files are stored in this repository at the paths below.

| Evidence | Issue | What it shows |
|---|---|---|
| [secure-login-2026-11-04.md](evidence/secure-login-2026-11-04.md) + 5 screenshots | #1 | The secure login: valid, wrong, unknown, whitespace and oversized input |
| [attack-baseline-2026-11-11.md](evidence/attack-baseline-2026-11-11.md) + 3 screenshots | #7 | The SQL-injection bypass before any defense, with a reproducible log script |
| [before-after-2026-11-09.md](evidence/before-after-2026-11-09.md) + 3 screenshots | #8, #10, #11 | The same inputs against the vulnerable and defended labs, plus the rate limit |
| [clickjacking-2026-11-11.md](evidence/clickjacking-2026-11-11.md) + 2 screenshots | #9 | Framing allowed before, blocked after |
| [David's Windows header check](https://github.com/QuinnRana/operation-secure-login/pull/38) (see [LOCAL-SETUP.md](LOCAL-SETUP.md#windows-security-header-smoke-test)) | #9 | A second person, on Windows, reported the anti-framing headers on `/`, `/attack-lab` and `/defended-lab` |
| [rehearsal-2026-11-04.json](evidence/rehearsal-2026-11-04.json) | #13 | 14 passing server-action checks against the pinned rehearsal release ([REHEARSAL.md](REHEARSAL.md)) |
| [SESSIONS.md](SESSIONS.md), [DEFENDED-LAB.md](DEFENDED-LAB.md), [LOGIN-RATE-LIMIT.md](LOGIN-RATE-LIMIT.md), [DATABASE-ISOLATION.md](DATABASE-ISOLATION.md) | #5, #8, #9, #10 | Design, tests and limits for each control |

Where each rubric criterion is covered: [RUBRIC-EVIDENCE.md](RUBRIC-EVIDENCE.md).
