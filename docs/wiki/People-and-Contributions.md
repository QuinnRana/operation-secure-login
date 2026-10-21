# People and contributions

[Wiki home](README.md) · Snapshot: October 21, 2026

## Verified identities and attribution

| Identity recorded by GitHub | Recorded activity | What can be credited | What cannot be inferred |
| --- | --- | --- | --- |
| [QuinnRana](https://github.com/QuinnRana) | Repository owner; author account for all three development commits; author of issues #1–#15 and PR #16; actor on issue updates and closures | Recorded code/documentation authorship, issue planning, PR proposal, and the specific events below | Real name, sole physical authorship, complete team roster, or personal ownership of every suggested role |
| [DavidE2525](https://github.com/DavidE2525) | Author account of this wiki's [PR #17](https://github.com/QuinnRana/operation-secure-login/pull/17), created October 21, 2026 at 21:02:32 UTC | Requested documentation published through this account with Codex assistance; nine wiki pages and contribution/history research | Does not establish authorship of earlier application commits or a formal assignment to all documentation tasks |
| GitHub / `web-flow` | Committer of the initial commit | Platform commit operation for the initial commit; QuinnRana remains its recorded author | A separate student contributor |
| `github-project-automation[bot]` | Adds issues to a project and changes project item status | Automated project-board maintenance | Human implementation, testing, or review |

No other named person appears as an assignee in the retrieved issues. The [roadmap #15](https://github.com/QuinnRana/operation-secure-login/issues/15) explicitly says actual teammates should be assigned together and that no teammates were assigned automatically.

## Commit-level contribution ledger

| UTC timestamp | Recorded author / committer | Work recorded | Why, to the extent supported |
| --- | --- | --- | --- |
| 2026-08-31 21:00:34 | QuinnRana / GitHub | [Initial commit `bef6300`](https://github.com/QuinnRana/operation-secure-login/commit/bef6300ecf6dcefb87991197bdde53e8a027d43a) | Establishes the repository baseline; the message supplies no fuller rationale |
| 2026-09-01 20:28:03 | QuinnRana / QuinnRana | [`d351791`: Build secure login and isolated SQL injection attack lab](https://github.com/QuinnRana/operation-secure-login/commit/d351791ca80b1873bea6b8ea94ba2c8a7def53dd) | Implements the two login paths used by the classroom exercise; current code still shares one DB binding |
| 2026-09-01 20:28:31 | QuinnRana / QuinnRana | [`da12c7c`: Document Build-Attack-Defend lab workflow](https://github.com/QuinnRana/operation-secure-login/commit/da12c7c42336c82a058576fdbe7aa760fac6d794) | Explains the project phases, demo account, and testing boundary |
| 2026-10-05 20:56:18 | QuinnRana / QuinnRana | [`e03eedd`: verified local startup guide and second-machine checklist](https://github.com/QuinnRana/operation-secure-login/commit/e03eedd687a4177abc373dfaa9d37c33e822b324) | PR #16 states the README lacked reproducible setup commands; this commit remains on its separate branch |

The first three are reachable from `codex/development`. The fourth is proposed by PR #16 and must not be described as merged application history.

## Who posted what?

- **QuinnRana opened issue #1 on September 14:** verify the existing database-backed login and document what success actually means.
- **QuinnRana opened issues #2–#14 on September 28:** break work into reproducible setup, isolation, attack evidence, defense, testing, documentation, rehearsal, and submission.
- **QuinnRana opened issue #15 on September 28 and it was updated September 30:** provide the ordered roadmap and provisional planning guidance. An updated timestamp is not a line-by-line edit audit.
- **QuinnRana opened PR #16 on October 5:** propose a 60-line local setup guide with a recorded first-machine test.
- Issues #2–#15 and PR #16 identify the ChatGPT Codex Connector as the application used to post them. This describes the posting mechanism, not a separate human author.
- Every item in the retrieved issue collection reports zero discussion comments. The retrieved PR review list is empty. There are therefore no teammate discussion quotations or approval statements to attribute from those sources.

## Formal assignments versus suggested roles

The roadmap suggests coordinator/maintainer, application/database lead, attack/test lead, and defense/documentation lead. These are **proposed responsibilities**, not named appointments. See [Roadmap and ownership](Roadmap-and-Ownership.md).

Before attributing a teammate's work, add their chosen display name and GitHub account, link their assigned issue and commit/PR, identify a separate reviewer, and attach dated evidence. Do not substitute a GitHub issue creator for its implementer.

## Contribution record template

| Field | Entry to supply |
| --- | --- |
| Contributor and GitHub account | Confirmed identity |
| Task and issue | Link |
| Contribution | Concrete change or test performed |
| Reason | Stated requirement or documented decision |
| Date/time | Include timezone |
| Commit / PR | Immutable commit and review link |
| Evidence | Logs, screenshots, expected and actual results |
| Reviewer | Different teammate and review outcome |
