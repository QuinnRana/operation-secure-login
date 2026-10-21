# Verification and known gaps

[Wiki home](README.md)

## Evidence levels

- **Code-inspected:** behavior visible in the pinned source.
- **Reported:** a repository author recorded a test result; not rerun by this wiki.
- **Administrative state:** issue closure, branch flags, or project activity.
- **Unverified:** no sufficient result in the inspected repository sources.

This wiki uses repository-only evidence. Separate local terminal output or chat screenshots should be attached to an issue/PR by the team before being treated as a repository verification record.

## First-machine record in PR #16

The proposed [LOCAL-SETUP.md](https://github.com/QuinnRana/operation-secure-login/blob/e03eedd687a4177abc373dfaa9d37c33e822b324/docs/LOCAL-SETUP.md) records October 5, 2026 testing on an Apple Silicon MacBook, macOS 26.6.2, using Node 24.19.0 and pnpm 11.25.0 from a bundled runtime. It explicitly says that does not install the tools into the owner's normal terminal PATH.

| Check | Repository-reported result |
| --- | --- |
| Frozen-lockfile installation | Passed with registry retries; lockfile unchanged |
| Local dev startup | Passed; localhost:3000 |
| Both pages | Rendered successfully |
| Valid secure login | Passed |
| Wrong password | Rejected |
| Classroom payload | Exactly three fictional records |
| Restart and valid login | Passed |
| Development warning | Inconsistently optimized lucide-react client dependency |
| Production build | Not tested in that record |
| Docker | Not tested |
| Second machine | Still marked pending in the proposed document |

The PR author is QuinnRana; the record does not name the human operator of the Mac separately.

## Reconcile closure with evidence

QuinnRana closed #4 on October 21 at 20:47:22 UTC and #6 at 20:51:57 UTC. Both have zero discussion comments in the retrieved collection. The proposed setup guide still says machine 2 is pending, and PR #16 remains draft/unmerged. Record both facts. Do not infer failure from the older guide or infer every test passed from closure alone. The team should attach the second-machine report and reconcile the documentation.

## Known code and verification gaps

| Area | Evidence and practical implication | Tracked work |
| --- | --- | --- |
| Status-message markup | The two form result wrappers use role=status on generic HTML elements; the team's lint findings identify prefer-tag-over-role | Quality verification #11 |
| FormData handling | Both actions use String(formData.get(...) ?? ''); FormData values may be File or text | Quality verification #11 |
| Database boundary | Both actions use env.DB; table separation is not database isolation | #5 |
| Lab query | Concatenates input into SQL and reveals results/query | #8 |
| Lab passwords | Stored as plaintext fictional values | #8 |
| Secure demo salt | Fixed hard-coded salt, not an enrollment process | Document limitation; defense review |
| Session behavior | Success message only in inspected action | #9 |
| Rate limiting/logging | Absent from inspected login actions | #10 |
| Automated regression/CI | No test script or CI workflow in inspected tree | #11 |
| Access controls | README says hosting is owner-only; external access enforcement was not reproduced here | #6 closed; evidence reconciliation |
| Rubric/deadline | Not established by the repository plan | #2 |

The six-error lint result discussed during teammate verification is not attached in the retrieved repository records. Until logs are committed or linked, its exact execution status should be reported by the tester rather than invented as a repository artifact.

## Resolving the six discussed lint findings

For the two status wrappers, use semantic output elements and update their matching closing tags while preserving the layout classes. For username/password reads, check `typeof value === 'string'` before use; preserve username trimming on the secure path. These are proposed fixes, not changes made by this wiki.

Rerun lint, build, valid/invalid login, and the authorized lab baseline after code edits. A passing build shows compilation succeeded; it is not security certification.

## PR #16 review gate

1. Reconcile the second-machine report with #4's closed state.
2. Record installation, lint, build, both pages, correct/incorrect secure login, fictional record count, and restart results against an exact commit.
3. Resolve required failing checks and rerun affected checks.
4. Obtain review from a different teammate; the retrieved PR review list is empty.
5. Complete the team's draft/approval process and merge only into `codex/development`.
6. Reserve the final development-to-main release for the reviewed submission workflow.

Creating this documentation does not approve or merge PR #16 and does not close other tasks.
