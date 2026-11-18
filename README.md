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

## Project reports

- [Build–Attack–Defend report](docs/REPORT.md): the attack, each defense with before/after evidence, plain-language explanations, test results and residual risk
- [Architecture and data flow](docs/ARCHITECTURE.md): diagram and trust boundaries
- [Rubric-to-evidence map](docs/RUBRIC-EVIDENCE.md): where each grading criterion is covered and what is still missing

## Run locally

**Prerequisites:** Git, Node.js 22.13 or later (Node 24 recommended), and pnpm 11.25.0 (`npm install --global pnpm@11.25.0`).

```sh
git clone --branch codex/development https://github.com/QuinnRana/operation-secure-login.git
cd operation-secure-login
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

Open the URL the server prints (for example `http://localhost:3000/`). Stop the server with Ctrl+C.

- **Databases:** local development creates both D1-compatible databases (`DB` and `LAB_DB`) under `.wrangler/`. Their tables and fictional records are created the first time each login runs.
- **Reset the lab:** use the **Reset lab data** button on `/attack-lab` and **Reset defended lab** on `/defended-lab`. Do not delete `.wrangler/`, because that also erases the secure login's data.
- **Checks:** `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build`.

Full steps, startup checks and troubleshooting are in [local setup](docs/LOCAL-SETUP.md).

**Team workflow:**
1. Branch from `codex/development`.
2. Open a pull request back into it. CI runs the checks on every pull request, and a teammate should review it before it is merged.
3. The final merge to `main` is the last step (#14).
4. Track every task on the [project board](https://github.com/users/QuinnRana/projects/1).

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

Run `pnpm test:login` with Node 22.13+ for disposable SQLite-backed server-action regression tests. These limits bound application processing after form parsing; they are not request-body limits or rate limiting. The intentionally vulnerable Attack Lab is unchanged. A successful login now starts a server-side session and opens `/account`; see [login sessions](docs/SESSIONS.md).

## Combined verification

Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`. The test suite includes actual Workers-runtime tests with disposable local D1 databases, in addition to the focused Node/SQLite tests. Workers tests require local loopback sockets; they do not access the hosted website or database. GitHub Actions runs these checks on pushes and pull requests. Deployment remains separate.

## Login rate limiting

The secure login and defended lab each allow five attempts per account per 60-second window using an atomic shared-D1 budget and timestamped outcome-only logs. See [policy, tradeoffs, and verification](docs/LOGIN-RATE-LIMIT.md). The intentionally vulnerable local Attack Lab is unchanged.

## Authentication failure work

Normal secure login derives a candidate password hash for both known and unknown usernames after rate-limit admission, then returns the same generic invalid-credential response. This removes the large difference from skipping credential hashing for unknown accounts; it does not promise constant response time or prevent all account enumeration. Input rejection and throttled requests still avoid password work. The disposable regression test checks actual hash-call counts rather than flaky wall-clock thresholds. The intentionally vulnerable Attack Lab is unchanged.

## Individual Contribution Summary Table

Story points come from the [project board](https://github.com/users/QuinnRana/projects/1)'s Estimate field and count only items marked **Done** with the member as assignee. Commits and merged pull requests are listed as the evidence behind the board. Last updated 2026-11-18 (`codex/development` `caba9c6`); **the team must review and correct this table before submission.**

| Member | GitHub | Story points Done | Done issues | In review (points) | Authored commits on `codex/development` | Merged PRs |
|---|---|---|---|---|---|---|
| Matthew | [@matthewgill3035-rgb](https://github.com/matthewgill3035-rgb) | 29 | #1, #5, #7, #8, #9, #11 | 0 | 14 | 13 |
| Quinn | [@QuinnRana](https://github.com/QuinnRana) | 0 | — | 0 | 16 | 11 |
| David | [@DavidE2525](https://github.com/DavidE2525) | 0 | — | 0 | 4 | 3 |
| *Unassigned* | — | 16 | #3, #4, #6, #10, #13 | — | — | — |
| **Total** | | **45** | | **0** | **34** | **27** |

**To fix before submission:**
- #3, #4 and #6 (8 points) are Done but unassigned, so they count toward no one. Assign them to whoever did the work.
- Quinn's merged work (for example PRs #20, #21, #23, #24, #28–#30, #40, #41) and David's (#17, #38, #39) is not yet linked to assigned board items. The team should decide which issues match that work (for example #10, rate limiting, whose code is merged) and who they are assigned to.
- Recount the points after the remaining in-review items reach Done.

Matthew's commits appear under the Git author name `mcgill24`. Authored commits come from `git log --no-merges --format='%an' origin/codex/development` and leave out merge commits; Quinn also made 31 merge commits: 16 merge other members' pull requests (13 of Matthew's, 3 of David's), 9 merge Quinn's own, and 6 are branch-integration merges. Merged PRs come from `gh pr list --state merged --author <member>` and include PRs into any branch, so a stacked PR (for example #32, #34) is counted alongside the PR it fed into.

## Completion update — November 18, 2026

Quinn confirmed #1, #5, #7 and #13 complete in the project chat. #2 was closed as not planned and removed from the board. #11 is complete: the GitHub Actions `checks` job is now required on `main`, with up-to-date branches required; the existing pull-request and one-approval requirements remain. Done points are 45: 29 assigned to Matthew and 16 currently unassigned. These are board assignments, not a reassignment of authorship. Historical commit and PR counts above describe the earlier `caba9c6` snapshot. Final submission and professor access remain tracked in #14.
