# Secure login evidence — November 4, 2026

Evidence for [issue #1](https://github.com/QuinnRana/operation-secure-login/issues/1): the seeded training account succeeds, wrong and unknown credentials fail, and empty or unusual input is handled without a crash or data disclosure. All data is fictional.

This record covers the **secure login on `/` only**. It is not a team rehearsal, a second-machine reproduction, or evidence for the Attack Lab or a defended lab.

## Tested build

| Field | Value |
|---|---|
| Commit | `main` `59cbc3a9dd81129ffb208a6f77c5bc5f74790d94` (after PRs #20 and #21) |
| Checkout | Fresh clone, detached at that commit, no local changes, new local database |
| Computer | Apple Silicon Mac, macOS 14.5 (arm64) |
| Runtime | Node v24.22.1, pnpm 11.25.0 |
| Target | Local development server only. The server printed `Local: http://localhost:5180/`, and the browser opened that exact URL. |
| Run by | matthewgill3035-rgb, with Claude Code driving the browser |

## Commands

Run from a fresh clone in a new directory, following the [rehearsal guide](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/REHEARSAL.md) on `codex/development`:

```sh
git clone https://github.com/QuinnRana/operation-secure-login.git operation-secure-login-evidence
cd operation-secure-login-evidence
git switch --detach 59cbc3a9dd81129ffb208a6f77c5bc5f74790d94
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm dev --host 127.0.0.1 --port 5180 --strictPort
```

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed, lockfile unchanged |
| `pnpm test` | Passed: 7 tests, 7 pass, 0 fail |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed |

`pnpm test` output:

```text
✔ lab controls stay usable while UNION and metadata probes cannot reach secure data
✔ missing or same-object lab binding fails closed before any database access
✔ local configuration separates storage and omits the lab from production builds
✔ malformed and oversized credentials are rejected before DB access
✔ valid credentials, trimming, exact password bytes, and parameterized queries remain intact
✔ Workers runtime preserves hashes, secure login and isolated classroom baseline
✔ Workers runtime with production bindings disables the lab
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

## Browser test cases

Each case was submitted on `/` with the **Log in** button. The values were filled in by a script in the browser (setting each field's value and firing an input event), not typed by hand. Typing them gives the same result, because the fields have no length limit and the length, blank and credential checks all happen on the server. A valid `student` login was run between consecutive failure cases, so every failure message shown is a fresh server response rather than a leftover one.

| # | Username | Password | Expected | Actual | Screenshot |
|---|---|---|---|---|---|
| 1 | `student` | `Training123!` | Success message | ✅ "Access granted. Welcome, student." | [01](secure-login-2026-11-04/01-valid-login.jpg) |
| 2 | `student` | `incorrect-training-password` | Generic failure | ✅ "The username or password is incorrect." | [02](secure-login-2026-11-04/02-wrong-password.jpg) |
| 3 | `unknown` | `incorrect-training-password` | Same generic failure; no hint that the user does not exist | ✅ "The username or password is incorrect." | [03](secure-login-2026-11-04/03-generic-rejection.jpg) |
| 4 | `' OR 1=1 --` | `dummy` | Same generic failure; no query, records or error shown | ✅ "The username or password is incorrect." | [03](secure-login-2026-11-04/03-generic-rejection.jpg) |
| 5 | three spaces | `dummy` | Blank-input message | ✅ "Enter both a username and password." | [04](secure-login-2026-11-04/04-whitespace-username.jpg) |
| 6 | 300 × `a` | `dummy` | Length-limit message, before any database work | ✅ "Enter one valid username and password within the supported lengths." | [05](secure-login-2026-11-04/05-oversized-username.jpg) |
| 7 | (empty) | (empty) | Browser blocks submission | ✅ The form reported itself invalid, no submit event fired, and the message was unchanged. The browser's own validation text read "Please fill out this field." (wording varies by browser and language). | — |

After stopping and restarting the server, case 1 succeeded again and case 2 failed again. This was observed in the browser but not captured as a screenshot.

No case displayed a query, a stack trace, a password hash or any database record. The browser console showed no errors.

**About the screenshots:** the form clears its fields after each submission, so the screenshots show the response message, not the input. The inputs are recorded in the table. The images show the page only: no address bar, commit, timestamp or computer name. That they come from this run is stated by this record, not proven by the images. Cases 3 and 4 produced byte-identical screenshots, which is expected because both return the same generic message, so only one image is kept. Case 7 has no screenshot because the browser's validation bubble is not part of the page.

## What this shows and what it does not

- **Bound SQL is shown by the code and tests, not by the browser result.** Case 4 only shows that the injection attempt gets the same generic message as a wrong password, with nothing leaked. On its own that would not prove binding: even a vulnerable query would fail here, because the dummy password still has to match the stored hash. The proof is the source (`.bind(username)` in `app/actions.ts`) and the `pnpm test` case "valid credentials, trimming, exact password bytes, and parameterized queries remain intact".
- **Stored hashes:** the database stores a PBKDF2-SHA-256 hash (120,000 iterations) for the secure login, never the plaintext. The demo password itself is a published fictional value: it is written in the source and shown on the login page.
- **Not a session:** "Access granted" is a message only. No persistent login session or protected page is created (see issue #9).
- **Not covered here:** the Attack Lab, the hosted site, rate limiting (issue #10, added later on `codex/development`) and Node 22.13.
- **Related record:** the automated [rehearsal evidence](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/evidence/rehearsal-2026-11-04.json) on `codex/development` checks the same server-action results at the same commit without a browser. This record adds the browser run and screenshots.

## Second-teammate reproduction

Issue #1 is done only when a second teammate reproduces these cases from the written steps.

| Field | Value |
|---|---|
| Teammate, date, computer / OS | Pending |
| Commit and Node / pnpm versions | Pending |
| Cases 1–7 actual results | Pending |
| Differences from this record | Pending |
