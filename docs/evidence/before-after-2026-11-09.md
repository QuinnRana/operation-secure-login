# Before/after lab evidence — November 9, 2026

Evidence for [issue #11](https://github.com/QuinnRana/operation-secure-login/issues/11): the same inputs run against the vulnerable baseline (`/attack-lab`, "before") and the defended login (`/defended-lab`, "after", from #8 and #10), with expected and actual results. All data is fictional, and the target was a local development server only.

This is a single browser run by one person. It is not a team rehearsal or a second-machine reproduction.

## Tested build

| Field | Value |
|---|---|
| Commit | `codex/development` `48617f4e238ddcec4957946b33f588f278e2af9b` (after PRs #25–#30) |
| Checkout | Fresh clone, detached at that commit, no local changes, new local databases |
| Computer | Apple Silicon Mac, macOS 14.5 (arm64) |
| Runtime | Node v24.22.1, pnpm 11.25.0 |
| Target | Local development server only. The server printed `Local: http://localhost:5181/`, and the browser opened that exact URL. |
| Run by | matthewgill3035-rgb, with Claude Code driving the browser |

## Commands

```sh
git clone https://github.com/QuinnRana/operation-secure-login.git operation-secure-login-matrix
cd operation-secure-login-matrix
git switch --detach 48617f4e238ddcec4957946b33f588f278e2af9b
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm dev --host 127.0.0.1 --port 5181 --strictPort
```

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed, lockfile unchanged |
| `pnpm test` | Passed: 29 tests, 29 pass, 0 fail |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | Passed |
| Production build has `DB` and no `LAB_DB` (`dist/server/wrangler.json`) | Passed |

## How the browser cases were run

Values were filled in by a script in the browser (setting each field's value and firing an input event) and submitted with the page's button. For each case the script waited until the button went into its "checking" state and back, then read the message, so every result is that request's own response.

An earlier attempt that read the message after a fixed delay was discarded. The first defended login after startup is slower because it creates the seed hashes, so that attempt read the previous request's message.

The defended login allows 5 attempts per exact username per 60 seconds (#10). Cases 1–6 used each defended username at most twice. The discarded attempt also made defended logins that counted toward these budgets. They appear in the server-log totals: 9 denied, 8 success and 3 throttled across both attempts, 5 of them from the discarded one. The log timestamps (UTC) show the last discarded event at 18:36:46 and case 1 at 18:38:29, 103 seconds later, so every window the discarded attempt started had expired. Consistent with that, no case 1–6 was throttled, and `casey` was throttled at exactly its sixth attempt (case 8, 18:38:52).

## Matrix: same input, before and after

| # | Username | Password | Expected before (`/attack-lab`) | Actual before | Expected after (`/defended-lab`) | Actual after |
|---|---|---|---|---|---|---|
| 1 | `alex` | `falcon7` | Valid login | ✅ "Login bypassed. 1 fictional record exposed." with the query shown | Valid login | ✅ "Access granted. Welcome, Alex Morgan." |
| 2 | `alex` | `wrong` | Fails | ✅ "Login failed." with the query shown | Generic failure | ✅ "The username or password is incorrect." |
| 3 | `jamie` | `spring22` | Valid login | ✅ 1 record (Jamie Lee) | Valid login | ✅ "Access granted. Welcome, Jamie Lee." |
| 4 | `alex' --` | `anything` | Bypass: the comment removes the password check | ✅ "Login bypassed. 1 fictional record exposed." (Alex Morgan) | Generic failure | ✅ "The username or password is incorrect." |
| 5 | `casey` | `welcome1` | Valid login | — (not run before) | Valid login | ✅ "Access granted. Welcome, Casey Rivera." |
| 6 | `' OR 1=1 --` | `anything` | **Bypass: all records exposed** | ✅ "Login bypassed. 3 fictional records exposed." Alex Morgan, Jamie Lee, Casey Rivera and the query shown. [Screenshot 01](before-after-2026-11-09/01-before-payload-bypass.jpg) | **Generic failure, nothing exposed** | ✅ "The username or password is incorrect." [Screenshot 02](before-after-2026-11-09/02-after-payload-rejected.jpg) |

On `/defended-lab`, each case returned only the message shown; no query or record text appeared. (The page was also checked for the Attack Lab's query box and record cards, which the defended form cannot render, so that check is weak; the message text is the real evidence.)

The Attack Lab says "Login bypassed" for every matched row, including valid credentials (cases 1 and 3), because it reports any row its query returns.

## Repeated wrong attempts and reset

| # | Action | Before (`/attack-lab`) | After (`/defended-lab`) |
|---|---|---|---|
| 7 | Attempts 2–5 for `casey` with wrong passwords (attempt 1 was case 5) | — | ✅ "The username or password is incorrect." each time |
| 8 | Attempt 6 for `casey`, wrong password | — | ✅ "Too many login attempts. Try again in a minute." [Screenshot 03](before-after-2026-11-09/03-after-throttled.jpg) |
| 9 | Attempt 7 for `casey`, **correct** password | — | ✅ Still throttled. (That the limit is checked before the password is shown by `app/defended-lab/actions.ts` and `docs/LOGIN-RATE-LIMIT.md`, not by this result alone.) |
| 10 | **Reset defended lab**, then `casey` / `welcome1` again | — | ✅ Reset succeeded; `casey` was still throttled (reset does not clear the limit) |
| 11 | `jamie` / `spring22` while `casey` is throttled | — | ✅ "Access granted. Welcome, Jamie Lee." (the limit is per account) |
| 12 | Six wrong passwords for `casey`, then `casey` / `welcome1` | ✅ "Login failed." six times, then "Login bypassed. 1 fictional record exposed." No limit on the baseline. | — |
| 13 | About 178 seconds after `casey`'s first attempt (case 5 at 18:38:34, case 13 at 18:41:32 UTC), `casey` / `welcome1` | — | ✅ "Access granted. Welcome, Casey Rivera." |

**Server log check:** the dev server printed only `{"event":"defended_login","outcome":…,"timestamp":…}` lines for defended logins, with outcomes `success`, `denied` and `throttled`. A fixed-string search of the saved server output for each of `falcon7`, `spring22`, `welcome1`, `wrong`, `anything`, `alex'`, `OR 1=1`, `"alex"`, `casey`, `jamie` and `password` found 0 matches. The browser console showed no errors.

## What this shows and what it does not

- **Before vs after:** the same `' OR 1=1 --` and `alex' --` inputs bypass the vulnerable lab and fail on the defended lab. Valid credentials work on both.
- **Why the defense works** is shown by the code and the automated tests, not by these browser results alone: bound parameters, salted hashes and generic errors are covered in `tests/defended-lab.test.mjs` and the negative controls in #27. The browser results show the behaviour a classmate or the professor would see.
- **Rate limiting** (#10) is shown on the defended login only. The vulnerable baseline deliberately has none (case 12).
- **Screenshots** show the page response, not the typed input, and contain no address bar, commit, timestamp or computer name. That they come from this run is stated by this record, not proven by the images.
- **Not covered:**
  - sessions (#9 is not implemented, so there is nothing to test)
  - the secure login on `/` (see `secure-login-2026-11-04.md`)
  - the hosted site, Node 22.13, and a second machine

## Remaining #11 items

- **Required checks on `main`:** a repository setting only an admin can view or change. On Nov 4, #11 recorded that it was not enabled. GitHub showed "review required" for a PR into `main` on Nov 4, so some branch protection exists, but whether CI checks are required could not be verified with write access. An admin should confirm the setting and record it on #11.
- **Session tests:** depend on whether #9 is implemented.
- **Team reproduction:** another teammate should repeat cases 1–13 from these steps and add their results below.

| Field | Value |
|---|---|
| Teammate, date, computer / OS | Pending |
| Commit and Node / pnpm versions | Pending |
| Cases 1–13 actual results | Pending |
| Differences from this record | Pending |
