# Issue and activity archive

[Wiki home](README.md)

Repository-source snapshot retrieved October 21, 2026. Times are UTC. Original item bodies follow their metadata; these contain proposals and historical statements that may not match current completion evidence. Items with empty assignees are not assigned to their creators.

## Issue #1 — 05 · Build: Verify the database-backed secure login flow

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/1)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-14T20:32:18Z |
| Updated | 2026-09-28T21:13:42Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | Not recorded |

### Source body

## Goal
Verify the existing database-backed login before changing the attack lab. This is the existing Build task, expanded rather than duplicated.

**Depends on:** steps 03 and 04 in the project roadmap.
**Suggested owner:** application lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Demonstrate the seeded training account succeeds and wrong/unknown credentials fail.
- [ ] Verify empty fields and unusual input are handled without a crash or data disclosure.
- [ ] Verify the normal login uses bound SQL parameters and stored password hashes; explain both.
- [ ] Record current behavior accurately: a success message is not a persistent login session.
- [ ] Save the tested commit, commands, screenshots, expected results, and actual results.

## Done when
A second teammate reproduces the test cases from the written steps.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for the release step. These tasks are a provisional plan based on the README until the professor’s rubric is confirmed.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-14T20:32:20Z | QuinnRana | added_to_project_v2 |
| 2026-09-14T20:32:20Z | QuinnRana | project_v2_item_status_changed |
| 2026-09-14T20:40:48Z | QuinnRana | milestoned |
| 2026-09-14T20:51:43Z | QuinnRana | project_v2_item_status_changed |
| 2026-09-28T21:13:21Z | QuinnRana | renamed |
| 2026-10-21T20:49:35Z | QuinnRana | project_v2_item_status_changed |


---

## Issue #2 — 01 · Confirm grading rubric, deadline, and team responsibilities

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/2)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:31Z |
| Updated | 2026-09-28T21:13:31Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Capture the actual assignment before treating this plan as final. The rubric is not available in the project reference files; the tasks below are based on the repository’s Build–Attack–Defend README, not confirmed grading criteria.

**Depends on:** roadmap steps None (step numbers are not GitHub issue numbers).
**Suggested owner:** Project coordinator; choose a different teammate as reviewer.

## Completion checklist
- [ ] Create a requirement-to-evidence checklist with each rubric item, points, deliverable, and linked issue.
- [ ] Record the deadline, demo length, submission format, and professor-approved testing scope.
- [ ] Choose an owner and a different reviewer for each task; record each member’s contribution.
- [ ] Confirm whether Docker, a specific database, real sessions, a report, or a video is required; adjust later tasks accordingly.

## Done when
A teammate can map every graded requirement to a task and planned evidence.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:33Z | github-project-automation[bot] | added_to_project_v2 |


---

## Issue #3 — 02 · Set up team access and protect the main branch

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/3)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:32Z |
| Updated | 2026-09-28T21:13:32Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Use codex/development as the integration branch; create individual feature branches from it.

**Depends on:** roadmap steps 01 (step numbers are not GitHub issue numbers).
**Suggested owner:** Repository maintainer; choose a different teammate as reviewer.

## Completion checklist
- [ ] Verify each approved teammate can access the repo and knows how to fetch and switch branches.
- [ ] Configure main to require pull requests and at least one teammate review; prevent force pushes and deletion where supported.
- [ ] Document feature branch → codex/development → main workflow and conflict resolution.
- [ ] Verify the rule is active and document any administrator bypass; creating a branch alone does not protect main.

## Done when
A reviewed change can reach development, and ordinary direct pushes to main are blocked.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:34Z | github-project-automation[bot] | added_to_project_v2 |


---

## Issue #4 — 03 · Run the project from a fresh clone on two teammates’ computers

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/4)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:33Z |
| Updated | 2026-10-21T20:47:22Z |
| State | closed |
| Closed | 2026-10-21T20:47:22Z |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
The repository requires Node >=22.13.0 and uses pnpm, vinext/Vite, and a local D1-compatible database. Do not assume the README's startup claim is already verified.

**Depends on:** roadmap steps 01, 02 (step numbers are not GitHub issue numbers).
**Suggested owner:** Setup lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Document tested Node and pnpm versions and exact install/start commands.
- [ ] Use the lockfile to install dependencies; resolve any package-access or platform problems.
- [ ] Open the login and /attack-lab pages from a clean checkout on at least two team machines.
- [ ] Record the actual local URL, database storage location, and troubleshooting steps.
- [ ] If the rubric requires Docker, add and test it as a separate scoped deliverable; it is not currently supplied.

## Done when
Two teammates reproduce startup using only the written instructions; attach logs without secrets.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:35Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:36Z | github-project-automation[bot] | project_v2_item_status_changed |
| 2026-10-21T20:47:21Z | QuinnRana | project_v2_item_status_changed |
| 2026-10-21T20:47:22Z | QuinnRana | closed |


---

## Issue #5 — 04 · Isolate the training database and make the lab repeatable

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/5)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:34Z |
| Updated | 2026-09-28T21:13:34Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Current login and attack lab use different tables through the same DB binding. That is not a separate database security boundary.

**Depends on:** roadmap steps 03 (step numbers are not GitHub issue numbers).
**Suggested owner:** Database lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Document the schema, seed records, and how website requests reach the database.
- [ ] Separate the vulnerable lab from normal-login data using a dedicated database/binding, or a separate local lab instance with only disposable fictional data.
- [ ] Create and document a repeatable seed/reset process scoped to lab data only.
- [ ] Verify lab reset preserves unrelated data and that restarting behaves as documented.
- [ ] Record the permitted local or private lab target and confirm no real personal data or reused passwords are present.

## Done when
The team can explain and demonstrate isolation, seed a clean lab, and repeat a test from the same baseline.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:37Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:38Z | github-project-automation[bot] | project_v2_item_status_changed |
| 2026-10-21T20:49:27Z | QuinnRana | project_v2_item_status_changed |


---

## Issue #6 — 06 · Confirm approved teammates can reach the running lab

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/6)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:35Z |
| Updated | 2026-10-21T20:51:57Z |
| State | closed |
| Closed | 2026-10-21T20:51:57Z |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
A GitHub code repository is not a running website. The README describes owner-only hosting, but teammate access has not been verified.

**Depends on:** roadmap steps 03, 04 (step numbers are not GitHub issue numbers).
**Suggested owner:** Deployment lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Choose local copies or an approved private shared lab; record which approach the professor accepts.
- [ ] For a shared site, verify each approved teammate can sign in and that an unapproved visitor cannot access the lab.
- [ ] Confirm the hosting database binding and record the actual lab URL in an appropriate team location.
- [ ] Keep the vulnerable lab restricted; do not expose a database port or publish secrets to solve access problems.
- [ ] Document start, stop, and recovery steps; local copies can each use their own fictional database.

## Done when
Each teammate can reach the intended lab, and access boundaries are tested.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:39Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:40Z | github-project-automation[bot] | project_v2_item_status_changed |
| 2026-10-21T20:51:57Z | QuinnRana | closed |
| 2026-10-21T20:51:59Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## Issue #7 — 07 · Capture the baseline SQL-injection lab demonstration

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/7)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:37Z |
| Updated | 2026-09-28T21:13:37Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Use only the repository’s supplied classroom example against the team’s authorized disposable lab.

**Depends on:** roadmap steps 04, 05, 06 (step numbers are not GitHub issue numbers).
**Suggested owner:** Attack demonstration lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Record the tested commit, lab target, date, and seed/reset state.
- [ ] Show that an ordinary wrong password fails.
- [ ] Run the page’s supplied classroom test and record input, displayed unsafe query, result, and fictional records returned.
- [ ] Explain how string concatenation lets input change query meaning, and distinguish bypass from knowing a password.
- [ ] Save screenshots and a short reproducible test log with no real data or secrets.

## Done when
Another teammate repeats the baseline result and understands the root cause; evidence is saved before defensive edits.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:39Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:40Z | github-project-automation[bot] | project_v2_item_status_changed |
| 2026-10-21T20:49:39Z | QuinnRana | project_v2_item_status_changed |


---

## Issue #8 — 08 · Fix the vulnerable query and password storage

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/8)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:38Z |
| Updated | 2026-09-28T21:13:38Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
The attack-lab action currently builds SQL from input and stores plaintext lab passwords. Keep baseline evidence in history; do not leave a public toggle to a vulnerable path.

**Depends on:** roadmap steps 07 (step numbers are not GitHub issue numbers).
**Suggested owner:** Defense lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Replace input-concatenated SQL with bound parameters in the defended lab login.
- [ ] Replace plaintext lab password storage with password hashes and a unique random salt per account, using a suitable maintained implementation.
- [ ] Update seed/reset and any schema migration for the defended format.
- [ ] Return generic authentication failures and remove query/record disclosures from the defended UI.
- [ ] Retest valid login, wrong password, quoted inputs, and the exact baseline attack.

## Done when
Valid credentials succeed; the earlier bypass fails; no plaintext passwords or training records leak through failed login.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:40Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:41Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## Issue #9 — 09 · Decide and implement session behavior required by the assignment

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/9)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:39Z |
| Updated | 2026-09-28T21:13:39Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Current login returns a success message; it does not by itself establish a persistent authenticated session. Confirm expected scope before adding features.

**Depends on:** roadmap steps 01, 05 (step numbers are not GitHub issue numbers).
**Suggested owner:** Authentication lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Confirm whether a success-message demo satisfies the rubric or whether protected pages and logout are required.
- [ ] If required, implement server-validated sessions, protected routes, logout, expiration, and appropriate cookie settings.
- [ ] If cookies authorize state-changing requests, document and verify CSRF defenses.
- [ ] Test direct unauthenticated access, expired sessions, and access after logout.
- [ ] If sessions are out of scope, record the limitation explicitly rather than claiming full authentication.

## Done when
The delivered behavior matches the rubric and report; any implemented protected route rejects unauthenticated requests.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:41Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:42Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## Issue #10 — 10 · Add login rate limiting and useful security logging

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/10)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:40Z |
| Updated | 2026-09-28T21:13:40Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
The README lists rate limiting and logging as part of Defend; the inspected login actions do not implement them.

**Depends on:** roadmap steps 08 (step numbers are not GitHub issue numbers).
**Suggested owner:** Defense lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Choose and document a reasonable lab limit, cooldown, and account/client tracking strategy.
- [ ] Apply the control server-side to the defended authentication path.
- [ ] Log authentication outcomes and throttling with timestamps, avoiding passwords, session tokens, and sensitive payload contents.
- [ ] Verify repeated failures trigger the limit and valid behavior resumes after the cooldown.
- [ ] Explain any process-local or multi-instance limitation and use a suitable shared store if the deployment needs one.

## Done when
An evidence log shows failed attempts, throttling, recovery, and no leaked credentials.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:42Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:43Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## Issue #11 — 11 · Add automated checks and run the before/after test matrix

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/11)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:41Z |
| Updated | 2026-09-28T21:13:41Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Use meaningful tests against an isolated test database, never production or teammates’ working data.

**Depends on:** roadmap steps 08, 09, 10 (step numbers are not GitHub issue numbers).
**Suggested owner:** Test lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Test valid and invalid login, empty/long input, quoted input, and the saved baseline injection case.
- [ ] Test lab reset and relevant session and rate-limit behavior.
- [ ] Run lint, type checking, build, and focused automated tests; fix blockers or document justified limitations.
- [ ] Add a GitHub Actions workflow for supported checks using disposable test data and no committed secrets.
- [ ] Once checks work, make relevant checks required for main; record before/after expected and actual results.

## Done when
A fresh run passes, and the exact previously successful bypass is demonstrated to fail in the defended build.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:44Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:46Z | github-project-automation[bot] | project_v2_item_status_changed |
| 2026-10-21T20:49:59Z | QuinnRana | project_v2_item_status_changed |


---

## Issue #12 — 12 · Finish README, architecture explanation, and evidence report

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/12)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:42Z |
| Updated | 2026-09-28T21:13:42Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Turn the implementation and results into material the professor and another student can reproduce.

**Depends on:** roadmap steps 01, 03–11 (step numbers are not GitHub issue numbers).
**Suggested owner:** Documentation lead; choose a different teammate as reviewer.

## Completion checklist
- [ ] Document prerequisites, exact startup commands, database initialization/reset, and team workflow.
- [ ] Explain browser → server action → database, including separate lab boundaries.
- [ ] Write Build, Attack, and Defend sections with the root cause, code changes, screenshots, and repeated-test outcomes.
- [ ] Explain prepared statements, password hashing, rate limiting, logging, and any session behavior in plain language.
- [ ] Map each rubric requirement to evidence and credit individual contributions; remove secrets and unsupported security claims.

## Done when
A reviewer can reproduce the project using the README and locate evidence for every applicable rubric item.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:44Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:44Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## Issue #13 — 13 · Rehearse the group demonstration and resolve rubric gaps

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/13)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:43Z |
| Updated | 2026-09-28T21:13:43Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Practice the exact submission/demo flow rather than relying only on screenshots.

**Depends on:** roadmap steps 11, 12 (step numbers are not GitHub issue numbers).
**Suggested owner:** Whole team; choose a different teammate as reviewer.

## Completion checklist
- [ ] Assign speaking parts so every member explains their own contribution.
- [ ] Rehearse clean startup, normal login, recorded or isolated baseline attack, and defended retest within the assigned time.
- [ ] Have a teammate ask why the attack worked and why the defense stops it.
- [ ] Audit every rubric row and resolve missing evidence.
- [ ] Prepare an instructor-acceptable backup recording/screenshots and recovery plan if networking fails.

## Done when
The group completes a timed rehearsal and all rubric requirements have verified evidence.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:45Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:46Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## Issue #14 — 14 · Review and merge the finished project, then submit

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/14)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:13:44Z |
| Updated | 2026-09-28T21:13:44Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## Goal
Merge only when the tested and documented development version is ready.

**Depends on:** roadmap steps 02, 11–13 (step numbers are not GitHub issue numbers).
**Suggested owner:** Repository maintainer and reviewer; choose a different teammate as reviewer.

## Completion checklist
- [ ] Open a pull request from codex/development into main with linked tasks and test results.
- [ ] Get teammate review, resolve conflicts and comments, and rerun affected checks after changes.
- [ ] Merge the approved pull request, then verify a fresh checkout of main works.
- [ ] Record the final commit or release tag and submit the exact files/links requested by the professor.
- [ ] Confirm the professor can access the submission and retain evidence and contribution records.

## Done when
Submission is complete before the deadline and corresponds to the reviewed, verified main commit.

Work on a feature branch from `codex/development`, review into development, and reserve the final merge to `main` for step 14. This plan is based on the repository README and inspected code; confirm the professor’s rubric in step 01.

### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:13:46Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:13:47Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## Issue #15 — START HERE · Build–Attack–Defend project roadmap

[Open source item](https://github.com/QuinnRana/operation-secure-login/issues/15)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-09-28T21:14:04Z |
| Updated | 2026-09-30T21:15:36Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

## How to use this roadmap
Follow the numbered steps below and each task’s dependencies. The 01–14 prefixes are the work order, not GitHub issue numbers. Each task has a checklist, suggested role, and completion criteria. Assign actual teammates together; none have been assigned automatically.

This is a provisional plan based on the repository README and inspected code, not a guarantee of a grade. Confirm the professor’s rubric and deadline in step 01; remove out-of-scope optional work and add any missing graded requirements.

## Ordered tasks
- [ ] 01 — Confirm grading rubric, deadline, and team responsibilities: #2
- [ ] 02 — Set up team access and protect the main branch: #3
- [ ] 03 — Run the project from a fresh clone on two teammates’ computers: #4
- [ ] 04 — Isolate the training database and make the lab repeatable: #5
- [ ] 05 — Build: Verify the database-backed secure login flow: #1
- [ ] 06 — Confirm approved teammates can reach the running lab: #6
- [ ] 07 — Capture the baseline SQL-injection lab demonstration: #7
- [ ] 08 — Fix the vulnerable query and password storage: #8
- [ ] 09 — Decide and implement session behavior required by the assignment: #9
- [ ] 10 — Add login rate limiting and useful security logging: #10
- [ ] 11 — Add automated checks and run the before/after test matrix: #11
- [ ] 12 — Finish README, architecture explanation, and evidence report: #12
- [ ] 13 — Rehearse the group demonstration and resolve rubric gaps: #13
- [ ] 14 — Review and merge the finished project, then submit: #14

## Suggested division of work
- Coordinator/repository maintainer: rubric, branch rules, review, final submission.
- Application/database lead: reproducible startup, database isolation, baseline login, and required session behavior.
- Attack/test lead: baseline demonstration, evidence, and repeatable regression tests.
- Defense/documentation lead: query/password fixes, rate limiting/logging, report and presentation.

Combine roles for smaller teams and rotate reviewers. Documentation and evidence collection should happen throughout the work, even though their final review is step 12. Tasks can overlap when dependencies are met; preserve attack evidence before implementing the defense.

## Development workflow
Create feature branches from `codex/development` → reviewed pull requests into `codex/development` → tested final pull request into `main`. Branch protection is a task to implement, not a setting already enabled.

## Every completed task should include
- A responsible teammate and another reviewer.
- Linked commit/pull request when code changes.
- Expected versus actual results, tested commit, and reproducible evidence.
- Updated documentation and an explanation each contributor can give in class.

Close this roadmap only when the professor-required submission is delivered and all applicable tasks are complete.

## Planning fields — provisional schedule added September 30, 2026
All 19 current project items have Priority, Size, Estimate, Start date, and Target date filled in. Target date is the planned end date, not an actual completion date.

- **P0:** blockers or essential release/submission work. **P1:** core planned work. **P2:** conditional work (session implementation depends on the rubric).
- **Estimate is story points, not hours:** XS = 1, S = 2, M = 3, L = 5, XL = 8. These are initial relative-effort estimates for the team to refine.
- **Dates are provisional:** September 30–October 30, 2026. Only the four-month semester length is known; the actual semester end, submission deadline, team size, and weekly availability remain unconfirmed. October 30 is an internal planning target, not the professor’s deadline. Replan after confirming those details.
- Setup and database work precede baseline tests; baseline attack evidence precedes defense; regression checks precede final documentation, rehearsal, and submission. Parallel tasks assume different teammates can work at the same time.
- The four older draft cards overlap the detailed attack/defense issues. Their dates align with those issues; do not add their points again when forecasting total work. The roadmap’s 1 point covers coordination only, not the sum of its linked tasks.
- Status was left unchanged; a planned start date does not claim that the task has actually started. Collect evidence throughout the project, not just during the final documentation window.


### Retrieved events

| UTC timestamp | Actor | Event |
| --- | --- | --- |
| 2026-09-28T21:14:08Z | github-project-automation[bot] | added_to_project_v2 |
| 2026-09-28T21:14:09Z | github-project-automation[bot] | project_v2_item_status_changed |


---

## PR #16 — Document verified local startup and teammate reproduction steps

[Open source item](https://github.com/QuinnRana/operation-secure-login/pull/16)

| Field | Repository value |
| --- | --- |
| Author | QuinnRana |
| Created | 2026-10-05T20:56:22Z |
| Updated | 2026-10-05T20:56:22Z |
| State | open |
| Closed | Not closed |
| Assignees | None |
| Discussion comments | 0 |
| Posted via app | chatgpt-codex-connector |

### Source body

The README does not provide reproducible setup commands. This adds a local setup guide with prerequisites, frozen-lockfile installation, localhost startup, database storage details, troubleshooting, and a second-machine checklist.

Verified from a fresh clone on Apple Silicon macOS with Node 24.19.0 and pnpm 11.25.0: installation, both pages, valid and invalid login, the supplied classroom payload returning three fictional records, and valid login after server restart. No application code or lockfile changes.

Partially addresses #4. Keep the issue open until a second teammate reproduces startup. Production build and Docker were not tested. Main remains unchanged.

### Retrieved events

No events returned in the inspected event collection.

