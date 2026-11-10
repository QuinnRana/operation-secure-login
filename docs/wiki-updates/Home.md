# Operation Secure Login — Project Wiki

Repository evidence snapshot: **October 21, 2026**. Application baseline: [`da12c7c42336c82a058576fdbe7aa760fac6d794`](https://github.com/QuinnRana/operation-secure-login/commit/da12c7c42336c82a058576fdbe7aa760fac6d794) on `codex/development`.

This wiki explains the CIS 3353 Build–Attack–Defend classroom project, how the code works, who GitHub credits for recorded activity, why work was proposed, and what still needs evidence. Originally authored by DavidE2525 in repository commits 0bd0129 and b95e78e, this documentation is now published in the GitHub Wiki. The historical snapshot below records the state at the time it was written.

## Read the wiki

| Page | What it answers |
| --- | --- |
| [People and contributions](People-and-Contributions) | Who authored, posted, or changed what? Which roles are actually assigned? |
| [History and decisions](History-and-Decisions) | When did work happen, and what reasons are documented? |
| [Architecture and code](Architecture-and-Code) | How do the pages, server actions, password helper, and database connect? |
| [Local setup](Local-Setup) | How does another teammate install, start, stop, and verify the lab? |
| [Verification and known gaps](Verification-and-Known-Gaps) | What is recorded as tested, what remains unverified, and what blocks sign-off? |
| [Roadmap and ownership](Roadmap-and-Ownership) | Which issue covers each task, its state, and its suggested role? |
| [Source register](Source-Register) | Which repository sources support the wiki? |
| [Issue and activity archive](Issue-and-Activity-Archive) | Exact issue descriptions, authors, dates, and retrieved activity |
| [Current state — November 2026](Current-State-November-2026) | What is implemented now, where the evidence is, and what is still open |

## Project purpose

The [README](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/README.md) describes three phases:

1. **Build:** demonstrate a working database-backed login with bound SQL parameters and password hashes.
2. **Attack:** use the page's supplied classroom test in the authorized fictional-data lab, preserving the unsafe query and returned records as evidence.
3. **Defend:** replace the vulnerable query, improve password storage, add applicable controls, and repeat the baseline test.

This is an educational implementation, not a production-ready authentication service. The secure login returns a success message; the inspected action does not create a persistent authenticated session. The attack page is intentionally vulnerable.

## Historical snapshot (before PRs #16 and #17 merged)

- `main` and `codex/development` point to the same application baseline above.
- The branches response reports `main` as protected and `codex/development` as unprotected. Exact protection settings and bypasses were not retrieved.
- [PR #16](https://github.com/QuinnRana/operation-secure-login/pull/16) is open, draft, and targets `codex/development`. Its head is `codex/verify-local-setup`, commit `e03eedd687a4177abc373dfaa9d37c33e822b324`.
- Issues [#4](https://github.com/QuinnRana/operation-secure-login/issues/4) and [#6](https://github.com/QuinnRana/operation-secure-login/issues/6) are closed. Other retrieved roadmap issues remain open.
- Every retrieved issue and PR has an empty assignee list. No complete named group roster is recorded in the inspected files.
- A closed issue or a success message is not, by itself, proof that all acceptance checks passed.

## Scope and source discipline

All contribution claims here come from repository metadata, code, issue bodies, PR descriptions, and issue events. No private chat history, personal email addresses, or guessed real-name mappings are included. GitHub account authorship does not prove who physically typed every line or which teammate operated a test machine. Proposed work is distinguished from implemented behavior, and reported tests from independently reproduced tests.

## Classroom boundary

Use fictional records and the supplied payload only in the authorized local lab. Bind development to `127.0.0.1`; do not publish the vulnerable endpoint to solve teammate access. Keep baseline attack evidence before defensive changes.

## Publication update — October 21, 2026

PRs #16 and #17 are now merged into `codex/development`. Issues #3, #4, and #6 are closed as completed. The pages retain DavidE2525’s original evidence snapshot and attribution; historical issue and PR states in those pages describe the earlier snapshot.

## Status update — November 10, 2026

The pages above keep the October 21 snapshot. Since then, `codex/development` gained a separate lab database, lab resets, a defended lab login, login rate limiting, automated tests with CI, and browser evidence records; login sessions are in review (#33, #34). See [Current state — November 2026](Current-State-November-2026) for details and links. The statement above that the secure login only returns a success message stays true until #33 merges.
