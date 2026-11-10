# Current state — November 2026

[Wiki home](Home)

Repository evidence snapshot: **November 10, 2026**. Development branch: `codex/development` at [`b8651e7`](https://github.com/QuinnRana/operation-secure-login/commit/b8651e73624644464f230967e65e0cd912b48d59). The other wiki pages keep the October 21 snapshot by design; this page records what changed since then.

## Branches

| Branch | Commit | State |
|---|---|---|
| `codex/development` | `b8651e7` | Contains all the merged work below. CI ("Security and build checks") passes. |
| `main` (default) | `59cbc3a` (Nov 4) | Has #20 and #21, which were merged straight into `main`. It is 25 commits behind development and lacks #22–#32; that later work reaches `main` with the final reviewed merge ([#14](https://github.com/QuinnRana/operation-secure-login/issues/14)). |

## What is implemented now

| Area | Where | Pull requests |
|---|---|---|
| Lint fixes for the form status markup and FormData reads | `app/actions.ts`, `app/attack-lab/actions.ts`, both form components | [#22](https://github.com/QuinnRana/operation-secure-login/pull/22) |
| Separate lab database (`LAB_DB`), fail-closed when missing | `db/local-bindings.ts`; the shared check later moved to `lib/lab-db.ts` (#27); [`docs/DATABASE-ISOLATION.md`](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/DATABASE-ISOLATION.md) | [#20](https://github.com/QuinnRana/operation-secure-login/pull/20) |
| Secure-login input validation and portable PBKDF2 hashing | `app/actions.ts`, `lib/password.ts` | [#20](https://github.com/QuinnRana/operation-secure-login/pull/20), [#21](https://github.com/QuinnRana/operation-secure-login/pull/21), [#30](https://github.com/QuinnRana/operation-secure-login/pull/30) |
| Automated tests and GitHub Actions CI | `tests/`, `.github/workflows/` | [#20](https://github.com/QuinnRana/operation-secure-login/pull/20), [#23](https://github.com/QuinnRana/operation-secure-login/pull/23) |
| Lab-only reset (transactional) | **Reset lab data** on `/attack-lab` | [#25](https://github.com/QuinnRana/operation-secure-login/pull/25) |
| Defended lab: bound SQL, salted PBKDF2 hashes, generic errors | `/defended-lab`, [`docs/DEFENDED-LAB.md`](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/DEFENDED-LAB.md) | [#27](https://github.com/QuinnRana/operation-secure-login/pull/27), [#28](https://github.com/QuinnRana/operation-secure-login/pull/28) |
| Login rate limiting (5 attempts per account per minute) and safe outcome logs | `lib/login-security.ts`, [`docs/LOGIN-RATE-LIMIT.md`](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/LOGIN-RATE-LIMIT.md) | [#24](https://github.com/QuinnRana/operation-secure-login/pull/24), [#29](https://github.com/QuinnRana/operation-secure-login/pull/29) |
| Rehearsal guide and recovery plan | [`docs/REHEARSAL.md`](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/REHEARSAL.md) | [#23](https://github.com/QuinnRana/operation-secure-login/pull/23), [#32](https://github.com/QuinnRana/operation-secure-login/pull/32) |

The vulnerable query in `/attack-lab` is intentionally kept as the baseline for the before/after comparison; the page itself gained the separate lab database, a reset button and a link to the defended lab. #20 and #21 were merged into `main` first and then reached development; everything else in the table was merged into development only.

**In review, not merged yet:** server-side login sessions with a protected `/account` page, logout and 30-minute expiry, plus a runtime CSRF check ([#33](https://github.com/QuinnRana/operation-secure-login/pull/33), [#34](https://github.com/QuinnRana/operation-secure-login/pull/34); issue #9). Until they merge, the secure login still returns only a success message.

## Evidence records

| Record | What it shows |
|---|---|
| [Secure login evidence (Nov 4)](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/evidence/secure-login-2026-11-04.md) | Browser run of 7 secure-login cases, with 5 screenshots |
| [Before/after lab evidence (Nov 9)](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/evidence/before-after-2026-11-09.md) | The same inputs on `/attack-lab` and `/defended-lab`, plus rate-limit behavior |
| [Rehearsal evidence (Nov 4)](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/evidence/rehearsal-2026-11-04.json) | Automated server-action assertions at a pinned commit |

Each record states its own limits. None of them is a second-teammate reproduction.

## Project board (November 10)

The [project](https://github.com/users/QuinnRana/projects/1) has 15 items with an Estimate field totaling 55. Status on November 10:

| Status | Estimate | Issues |
|---|---|---|
| Done | 13 | #3, #4, #6, #8 |
| In review | 21 | #1, #5, #9, #11 |
| In progress | 19 | #2, #7, #10, #12, #13, #15 |
| Backlog | 2 | #14 |

Board status is set by the team and can lag behind the code; for example #10's code is merged into development while its item is still "In progress". The project is currently private.

## Still open

- **#1, #11:** a second teammate reproduces the recorded cases.
- **#5:** the team confirms the permitted lab target and data.
- **#9:** review and merge #33 and #34.
- **#11:** an admin confirms which checks are required on `main`.
- **#2:** the professor's grading criteria, points and deadline.
- **#12, #13, #14:** final README and report, timed team rehearsal, and the reviewed merge into `main` and submission.
