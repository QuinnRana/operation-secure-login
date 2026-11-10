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
| Secure-login input validation and portable PBKDF2 hashing | `app/actions.ts`, `lib/password.ts` | [#20](https://github.com/QuinnRana/operation-secure-login/pull/20), [#21](https://github.com/QuinnRana/operation-secure-login/pull/21) |
| Reduce known/unknown-account password-hashing work differences (not a constant-time guarantee) | `app/actions.ts` | [#30](https://github.com/QuinnRana/operation-secure-login/pull/30) |
| Automated tests and GitHub Actions CI | `tests/`, `.github/workflows/` | [#20](https://github.com/QuinnRana/operation-secure-login/pull/20), [#23](https://github.com/QuinnRana/operation-secure-login/pull/23) |
| Lab-only reset (transactional) | **Reset lab data** on `/attack-lab` | [#25](https://github.com/QuinnRana/operation-secure-login/pull/25) |
| Defended lab: bound SQL, salted PBKDF2 hashes, generic errors | `/defended-lab`, [`docs/DEFENDED-LAB.md`](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/DEFENDED-LAB.md) | [#27](https://github.com/QuinnRana/operation-secure-login/pull/27), [#28](https://github.com/QuinnRana/operation-secure-login/pull/28) |
| Login rate limiting (5 attempts per account per minute) and safe outcome logs | `lib/login-security.ts`, [`docs/LOGIN-RATE-LIMIT.md`](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/LOGIN-RATE-LIMIT.md) | [#24](https://github.com/QuinnRana/operation-secure-login/pull/24), [#29](https://github.com/QuinnRana/operation-secure-login/pull/29) |
| Rehearsal guide and recovery plan | [`docs/REHEARSAL.md`](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/REHEARSAL.md) | [#23](https://github.com/QuinnRana/operation-secure-login/pull/23), [#32](https://github.com/QuinnRana/operation-secure-login/pull/32) |

The vulnerable query in `/attack-lab` is intentionally kept as the baseline for the before/after comparison; the page itself gained the separate lab database, a reset button and a link to the defended lab. #20 and #21 were merged into `main` first and then reached development; everything else in the table was merged into development only.

## Unmerged account and session work

These implementations are separate from the pinned `codex/development` snapshot above:

- [#33](https://github.com/QuinnRana/operation-secure-login/pull/33) and [#34](https://github.com/QuinnRana/operation-secure-login/pull/34) propose server-side sessions, a protected `/account` page, logout, 30-minute expiry, and runtime CSRF verification. The combined source is pinned at [`8ff4d86`](https://github.com/QuinnRana/operation-secure-login/tree/8ff4d86bb2dcc9d3be51b7adffcb3bed0b4dd4fd).
- The separate custom-signup implementation at [`7a3be49`](https://github.com/QuinnRana/operation-secure-login/tree/7a3be49aa7163c6a8e591c070555322f3a9f5ca8) adds user-created accounts. The private-account implementation at [`684ae79`](https://github.com/QuinnRana/operation-secure-login/tree/684ae79f41821b31e4606d7cbd2bc77621a59111) adds a protected `/dashboard`, eight-hour sessions, and recovery-key password resets with credential-version invalidation. See its [account security documentation](https://github.com/QuinnRana/operation-secure-login/blob/684ae79f41821b31e4606d7cbd2bc77621a59111/docs/ACCOUNT-SECURITY.md).

**Integration requirement:** unify the session implementations before combining #33/#34 with the private-account work. They use different cookies, storage, and expiry policies; logout and password recovery must invalidate the sessions accepted by every protected route. Test those interactions before merging. This page does not establish that the integration is complete or approved. Secure login at the pinned development commit still returns only a success message.

## Evidence records

| Record | What it shows |
|---|---|
| [Secure login evidence (Nov 4)](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/evidence/secure-login-2026-11-04.md) | Browser run of 7 secure-login cases, with 5 screenshots |
| [Before/after lab evidence (Nov 9)](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/evidence/before-after-2026-11-09.md) | The same inputs on `/attack-lab` and `/defended-lab`, plus rate-limit behavior |
| [Rehearsal evidence (Nov 4)](https://github.com/QuinnRana/operation-secure-login/blob/codex/development/docs/evidence/rehearsal-2026-11-04.json) | Automated server-action assertions at a pinned commit |

Each record states its own limits. None of them is a second-teammate reproduction.

## Project board and grading confirmation

The [project board](https://github.com/users/QuinnRana/projects/1) is separate from the repository evidence above. This page does not verify board item counts, estimate totals, or current status assignments. Confirm the professor's deliverables, grading criteria, points, and deadline in [issue #2](https://github.com/QuinnRana/operation-secure-login/issues/2) before using them for planning or submission.

## Still open

- **#1, #11:** a second teammate reproduces the recorded cases.
- **#5:** the team confirms the permitted lab target and data.
- **#9:** unify and review #33/#34 with the separate private-account implementation; verify logout, expiry, and all-session invalidation after password recovery before merging.
- **#11:** an admin confirms which checks are required on `main`.
- **#2:** the professor's grading criteria, points and deadline.
- **#12, #13, #14:** final README and report, timed team rehearsal, and the reviewed merge into `main` and submission.
