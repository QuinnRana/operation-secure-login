# Operation Secure Login

CIS 3353 Build–Attack–Defend capstone lab.

## Current build

- Responsive database-backed username/password login
- Secure login using prepared SQL statements
- PBKDF2-SHA-256 password hashing
- Generic authentication errors
- Local SQL-injection Attack Lab with its own database and fictional records only
- Visible unsafe query and repeatable classroom test payload
- Hosted secure-login site; Attack Lab disabled without a dedicated lab binding

## Demo accounts

Secure login:

- Username: `student`
- Password: `Training123!`

Attack Lab:

- Open `/attack-lab`
- Use the authorized payload shown on that page
- Capture the payload, unsafe query, bypass result, and fictional records as evidence

## Build–Attack–Defend workflow

1. **Build:** demonstrate the working database-backed login.
2. **Attack:** use the supplied SQL-injection payload in the isolated lab and document the authentication bypass.
3. **Defend:** replace string-built SQL with bound parameters, hash passwords, add rate limiting and logging, then repeat the same test to verify it fails.

## Run locally

Install dependencies and start the development site with the package scripts in `package.json`. The local development environment creates and retains the D1-compatible database automatically.

## Safety boundary

This application is for an authorized classroom lab and contains only fictional training records. Do not aim the payload at any other website or system. Keep the hosted site restricted to the project owner and approved teammates.

## Project wiki

See the [project Wiki](https://github.com/QuinnRana/operation-secure-login/wiki) for architecture, setup, contribution history, the roadmap, and verification notes originally contributed by DavidE2525.

## Rehearsal preparation

See [the rehearsal and recovery guide](docs/REHEARSAL.md) for the pinned tested release, local demonstration sequence, evidence sheet and network-failure plan. It records remaining work rather than claiming the final rehearsal is complete.

## Database isolation

See [database isolation](docs/DATABASE-ISOLATION.md) for local behavior, regression checks, and deployment requirements.

## Secure login input checks

The secure server action requires exactly one text username and password. It rejects file uploads, duplicate credential fields, usernames longer than 256 UTF-16 code units, and passwords longer than 1,024 code units before database or hashing work. Limits apply to raw input, so excessive padding is rejected. Username edges are trimmed; passwords are never trimmed, truncated, or Unicode-normalized. Other form keys remain permitted for framework metadata.

Run `pnpm test:login` with Node 22.13+ for disposable SQLite-backed server-action regression tests. These limits bound application processing after form parsing; they are not request-body limits or rate limiting. The intentionally vulnerable Attack Lab is unchanged. Successful secure login creates one private, expiring session shared by `/dashboard` and `/account`; see [login sessions](docs/SESSIONS.md). The lab endpoints retain their classroom demonstration behavior.

## Combined verification

Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:http` (after build). The test suite includes actual Workers-runtime tests with disposable local D1 databases, in addition to the focused Node/SQLite tests. Workers tests require local loopback sockets; they do not access the hosted website or database. GitHub Actions runs these checks on pushes and pull requests. Deployment remains separate.

## Login rate limiting

The secure login and defended lab each allow five attempts per account per 60-second window using an atomic shared-D1 budget and timestamped outcome-only logs. See [policy, tradeoffs, and verification](docs/LOGIN-RATE-LIMIT.md). The intentionally vulnerable local Attack Lab is unchanged.

## Authentication failure work

Normal secure login derives a candidate password hash for both known and unknown usernames after rate-limit admission, then returns the same generic invalid-credential response. This removes the large difference from skipping credential hashing for unknown accounts; it does not promise constant response time or prevent all account enumeration. Input rejection and throttled requests still avoid password work. The disposable regression test checks actual hash-call counts rather than flaky wall-clock thresholds. The intentionally vulnerable Attack Lab is unchanged.


## Create an account and return later

Select **Create account** on the secure login page. Choose a unique, case-sensitive username (3–64 letters, numbers, periods, underscores, or hyphens) and a password of 12–1,024 UTF-16 code units, then confirm the password. Username edges are trimmed. Passwords are never trimmed, truncated, or normalized. Both password fields are masked; the username stays visible.

After creation, select **Log in to your new account**. The username is carried into the login form; enter the same password. You can close the page or restart the local server and sign in again. The database stores the username, a random 32-byte salt, and the existing PBKDF2-SHA-256 hash format (120,000 iterations), never the plaintext password. Duplicate submissions cannot replace an existing account. The demo account remains available.

Accounts live in the secure `DB`, not the browser or the isolated `LAB_DB`. Local accounts persist in this checkout's ignored `.wrangler/` state. A different checkout, computer, or hosted database has different accounts. Removing the local database deletes local accounts. Publishing the code alone does not migrate accounts or configure hosted persistence. Successful login opens a private account dashboard with an eight-hour authenticated session. Password recovery uses a saved, single-use recovery key; there is no email collection or email verification. Use unique fictional training credentials, not credentials reused on real services.

Registration allows ten valid-shaped attempts per shared database per 60 seconds, including duplicates and successful signups. The atomic quota is checked before credential hashing and does not consume sign-in quota. The shared limit bounds username-rotation abuse but can temporarily block other students during a burst; it is intentionally conservative for this classroom service. Outcomes are logged without usernames or passwords. Username availability is disclosed at signup. Do not treat this lab as a production identity service.

`pnpm test` covers signup validation, random salts, duplicate/concurrent creation, unchanged existing passwords, exact password bytes, shared signup throttling, and returning login after a database and Workers-runtime restart. The Attack Lab's intentional vulnerability and database boundary remain unchanged.


## Private dashboard and password recovery

After signing in, `/dashboard` displays only the account associated with the secure session cookie. The session expires after eight hours, rotates on login, and is revoked on logout. Pages and account responses are marked private/no-store.

From your dashboard, enter your current password to generate a recovery key. Save the key privately, for example in your password manager: it is displayed once. Generating a replacement invalidates the old key. If you forget your password, select **Forgot password?** on the login page, then enter your username, saved key, and new password. A successful reset consumes the key and invalidates all existing sessions. Log in and create a fresh key afterward.

Existing accounts must sign in once to set up recovery. Without either the password or a previously saved valid key, the account cannot be recovered. The shared `student` demo account cannot set up recovery or reset its password. No email provider, API keys, or live service configuration are needed for this recovery method.

All account state uses the existing secure `DB`; additive table initialization preserves existing accounts and does not touch `LAB_DB`. Production needs HTTPS and a durable secure D1 binding. For local browser tests, use `http://localhost` with a browser supporting secure cookies on localhost. No deployment or existing database migration is implied by a branch push. See [private account security](docs/ACCOUNT-SECURITY.md) for controls, limits, and tests.
