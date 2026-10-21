# Roadmap and ownership

[Wiki home](README.md) · Source: [roadmap #15](https://github.com/QuinnRana/operation-secure-login/issues/15)

Roadmap order numbers differ from GitHub issue numbers. All actual assignees and separate reviewers remain unrecorded in the retrieved issue metadata.

| Order | Issue / deliverable | Suggested role from issue | GitHub state | Named assignee |
| --- | --- | --- | --- | --- |
| 01 | [#2: Confirm grading rubric, deadline, and team responsibilities](https://github.com/QuinnRana/operation-secure-login/issues/2) | Project coordinator; choose a different teammate as reviewer. | open | Unassigned |
| 02 | [#3: Set up team access and protect the main branch](https://github.com/QuinnRana/operation-secure-login/issues/3) | Repository maintainer; choose a different teammate as reviewer. | open | Unassigned |
| 03 | [#4: Run the project from a fresh clone on two teammates’ computers](https://github.com/QuinnRana/operation-secure-login/issues/4) | Setup lead; choose a different teammate as reviewer. | closed | Unassigned |
| 04 | [#5: Isolate the training database and make the lab repeatable](https://github.com/QuinnRana/operation-secure-login/issues/5) | Database lead; choose a different teammate as reviewer. | open | Unassigned |
| 05 | [#1: Build: Verify the database-backed secure login flow](https://github.com/QuinnRana/operation-secure-login/issues/1) | application lead; choose a different teammate as reviewer. | open | Unassigned |
| 06 | [#6: Confirm approved teammates can reach the running lab](https://github.com/QuinnRana/operation-secure-login/issues/6) | Deployment lead; choose a different teammate as reviewer. | closed | Unassigned |
| 07 | [#7: Capture the baseline SQL-injection lab demonstration](https://github.com/QuinnRana/operation-secure-login/issues/7) | Attack demonstration lead; choose a different teammate as reviewer. | open | Unassigned |
| 08 | [#8: Fix the vulnerable query and password storage](https://github.com/QuinnRana/operation-secure-login/issues/8) | Defense lead; choose a different teammate as reviewer. | open | Unassigned |
| 09 | [#9: Decide and implement session behavior required by the assignment](https://github.com/QuinnRana/operation-secure-login/issues/9) | Authentication lead; choose a different teammate as reviewer. | open | Unassigned |
| 10 | [#10: Add login rate limiting and useful security logging](https://github.com/QuinnRana/operation-secure-login/issues/10) | Defense lead; choose a different teammate as reviewer. | open | Unassigned |
| 11 | [#11: Add automated checks and run the before/after test matrix](https://github.com/QuinnRana/operation-secure-login/issues/11) | Test lead; choose a different teammate as reviewer. | open | Unassigned |
| 12 | [#12: Finish README, architecture explanation, and evidence report](https://github.com/QuinnRana/operation-secure-login/issues/12) | Documentation lead; choose a different teammate as reviewer. | open | Unassigned |
| 13 | [#13: Rehearse the group demonstration and resolve rubric gaps](https://github.com/QuinnRana/operation-secure-login/issues/13) | Whole team; choose a different teammate as reviewer. | open | Unassigned |
| 14 | [#14: Review and merge the finished project, then submit](https://github.com/QuinnRana/operation-secure-login/issues/14) | Repository maintainer and reviewer; choose a different teammate as reviewer. | open | Unassigned |

## Dependencies and completion

Setup and access precede reproduction. Database isolation and baseline login verification precede the documented attack. Capture baseline evidence before defensive edits. Defense and applicable session/rate-limit controls precede final regression checks, documentation, rehearsal, and release. The [issue archive](Issue-and-Activity-Archive.md) preserves the detailed dependencies and acceptance checklists.

## Working roles proposed in #15

- **Coordinator / repository maintainer:** confirm rubric, branch rules, reviews, and submission.
- **Application / database lead:** startup, database isolation, baseline login, and required session behavior.
- **Attack / test lead:** baseline demonstration, evidence, and regression tests.
- **Defense / documentation lead:** query/password changes, rate limiting/logging, report, and presentation.

Combine roles for smaller teams and rotate reviewers. These are suggestions; the wiki does not assign them to QuinnRana or unnamed group members.

## Branch and review workflow

Create a feature branch from `codex/development`, propose reviewed changes back into development, and reserve a final verified PR into `main`. At this snapshot, main reports protected, but the detailed requirement for one review, blocked force pushes/deletion, required checks, and bypass rules has not been independently confirmed. Issue #3 remains open.

PR #16 proposes only setup documentation. The wiki is a separate documentation change so its content can be reviewed without mixing it with lint fixes or silently completing an earlier PR.

## Definition of done

Each task should have an owner, different reviewer, commit/PR link when applicable, reproducible evidence, expected versus actual outcomes, and updated explanations the contributor can present in class. Marking a project item as done is not a substitute for those records.
