# Defended lab (issue #8)

`/defended-lab` is the Defend phase of the classroom lab. It uses the same three fictional accounts as `/attack-lab`, so the same valid credentials and the same attack payload can be compared on both pages. The vulnerable `/attack-lab` is kept unchanged as the baseline for the before/after demonstration.

Both pages render in any build, including production, but only a local development server provides `LAB_DB`. In production builds both forms return "The isolated Attack Lab database is unavailable." and touch no database. There is no setting that switches the defended login back to the vulnerable query.

Both lab tables live in the same `LAB_DB`. A UNION injection on the vulnerable `/attack-lab` can therefore read the defended table's hashes and salts. That is acceptable here because every account and password is fictional and published, but do not describe the defended table as unreadable: the defense is in how `/defended-lab` queries and stores passwords, not in hiding its table from the vulnerable page.

## What changed compared with the vulnerable lab

| | Vulnerable `/attack-lab` | Defended `/defended-lab` |
|---|---|---|
| Query | Built by pasting the input into the SQL text | Fixed SQL text; the username is passed as a bound parameter |
| Password storage | Plaintext `password` column | `password_hash` (PBKDF2-SHA-256, 120,000 iterations, same as the secure login) and a random 16-byte `password_salt` per account |
| Password check | Inside the SQL `WHERE` clause | In code, by hashing the attempt with the stored salt and comparing in constant time |
| On failure | Shows the query and, for a bypass, the exposed records | One generic message: "The username or password is incorrect." |
| On success | Lists records | "Access granted. Welcome, *name*." No other records or notes |
| Attempt budget | None (intentional baseline) | Five attempts per exact username per 60 seconds in shared LAB_DB; [policy and tests](LOGIN-RATE-LIMIT.md) |
| Table | `lab_accounts` | `defended_lab_accounts` (same `LAB_DB`, separate table) |

Input is limited to one username of up to 256 characters and one password of up to 1,024 characters, like the secure login. By design, unknown usernames are still hashed once against a random salt, so they should take about as long as a wrong password. This was not measured.

## Before/after retest

Run `pnpm dev --host 127.0.0.1`, open the URL it prints, and try the same input on both pages:

| Input | `/attack-lab` (before) | `/defended-lab` (after) |
|---|---|---|
| `alex` / `falcon7` | 1 record shown | "Access granted. Welcome, Alex Morgan." |
| `alex` / `wrong` | "Login failed." with the query | "The username or password is incorrect." |
| `' OR 1=1 --` / any password | Bypass: 3 records and the query shown | "The username or password is incorrect." |

After five attempts for the same username, wait one minute for the fixed cooldown; even correct credentials are throttled until expiry. Reset does not clear the budget.

Record the actual results in the team's evidence location. A browser run of these cases on development `48617f4` is recorded in [before/after evidence](evidence/before-after-2026-11-09.md). The automated tests below check the same cases, but they do not replace the browser demonstration.

## Reset

**Reset defended lab** on `/defended-lab` drops and re-creates `defended_lab_accounts` and seeds the three accounts with new random salts and hashes, in one D1 transaction. First use also seeds only an empty table inside a transaction, so overlapping logins and resets cannot duplicate accounts. The defended reset never touches `lab_accounts` or the secure `DB`; the Attack Lab keeps its own **Reset lab data** button.

## Tests

`pnpm test` runs `tests/defended-lab.test.mjs`. It checks:

- the baseline payload still bypasses `/attack-lab`, while it and four other injection inputs get the generic failure on the defended login
- valid logins succeed; wrong, unknown and whitespace-altered passwords fail with the same message; oversized and duplicate fields are rejected
- stored rows contain 64-character hashes and 32-character salts, all different, and no plaintext password
- reset restores IDs 1–3 with new salts, leaves the vulnerable lab and secure `users` rows unchanged, and creates no lab table in `DB`
- overlapping first logins that all find the table empty still seed exactly three accounts (this test fails if the conditional insert is removed)
- a missing or same-object `LAB_DB` returns the unavailable error without touching any database
- end to end in the local Workers runtime, parallel logins and resets succeed, leave three accounts, and reject the baseline payload. The local runtime handled these requests one after another, so this test does not by itself prove the race is handled; the test above does.

`tests/defended-failures.test.mjs` additionally exercises the actual local Workers/D1 runtime with a deliberately failing statement appended to the reset transaction. It verifies that prior defended rows, schema and an index survive rollback; a subsequent reset and valid login recover; and the vulnerable-lab table and secure database remain unchanged. It also verifies generic lookup-error responses and missing-binding rejection for both defended actions. Run it with `node --test tests/defended-failures.test.mjs`; `pnpm test` includes it automatically. These checks use disposable fictional data, not the hosted database.

## Not covered

Sessions and the hosted site remain out of scope here (see issue #9). Of the two lab logins, rate limiting applies only to the defended one (the secure login on `/` has its own limit); the intentionally vulnerable login remains unlimited. The account-only control does not prevent username spraying or reset-endpoint abuse; neither lab is a public production authentication service.
