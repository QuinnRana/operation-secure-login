# History and decisions

[Wiki home](README.md)

All times below are **UTC** as returned by GitHub. Reasons are paraphrases of source descriptions, except where explicitly identified as inference.

## Timeline

| Date/time | Actor | Event | Purpose or significance |
| --- | --- | --- | --- |
| 2026-08-31 21:00:34 | QuinnRana, GitHub committer | Initial commit | Starts the repository history |
| 2026-09-01 20:28:03 | QuinnRana | Secure login and attack-lab commit | Establishes the implementation used by the demo |
| 2026-09-01 20:28:31 | QuinnRana | Workflow documentation commit | Explains Build, Attack, Defend |
| 2026-09-14 20:32:18 | QuinnRana | Opens issue #1 | Verify normal login before changing the attack lab |
| 2026-09-14 20:40:48 | QuinnRana | Assigns issue #1 to the Build milestone | Organizes baseline login verification |
| 2026-09-28 21:13–21:14 | QuinnRana; project automation | Creates task breakdown and roadmap | Records dependencies, roles, completion criteria, and project items |
| 2026-09-30 21:15:36 | Item update timestamp on #15 | Roadmap last-updated timestamp | Body includes provisional planning guidance; precise edit author/content history was not retrieved |
| 2026-10-05 20:56:18 | QuinnRana | Creates setup documentation commit | Reproducible commands and second-machine checklist |
| 2026-10-05 20:56:22 | QuinnRana via connector | Opens draft PR #16 | Proposes setup guide into development, with first-machine results |
| 2026-10-21 20:47:22 | QuinnRana | Closes #4 | Repository state changes to closed; no evidence comment accompanies closure |
| 2026-10-21 20:49:27–20:49:59 | QuinnRana | Changes project item status for #5, #1, #7, #11 | Events show activity; retrieved event data does not establish resulting status labels or completed tests |
| 2026-10-21 20:51:57 | QuinnRana | Closes #6 | Access task marked closed; no discussion comment supplies a testing record |
| 2026-10-21 20:51:59 | Project automation | Changes #6 project status | Automated follow-up, not a human verification result |

Sources: [commits](https://github.com/QuinnRana/operation-secure-login/commits/codex/development), [issue #1](https://github.com/QuinnRana/operation-secure-login/issues/1), [roadmap](https://github.com/QuinnRana/operation-secure-login/issues/15), [PR #16](https://github.com/QuinnRana/operation-secure-login/pull/16), and the event records in the [archive](Issue-and-Activity-Archive.md).

## Decision register

| Decision / proposal | Documented reason | Source | State at snapshot |
| --- | --- | --- | --- |
| Use Build–Attack–Defend phases | Show normal behavior, preserve a baseline bypass, then demonstrate why a defense works | README; #1, #7, #8 | Build and vulnerable baseline code exist; defense work remains open |
| Use feature branches into development | Review incremental work before a final tested release into main | #3, #14, #15 | Branches exist; main reports protected; precise protection requirements unverified |
| Use exact lockfile installation | Make another computer's dependency installation reproducible | PR #16 setup guide | Proposed documentation; no lockfile change in PR #16 |
| Keep vulnerable testing local/restricted | Use only authorized fictional records and avoid exposing the lab | README; #6; PR #16 | Requirement, not proof of hosted access enforcement |
| Separate the vulnerable database boundary | Separate tables through one DB binding do not provide database isolation | #5 | Open; shared binding confirmed in code |
| Preserve evidence before defense | Once the unsafe path is changed, baseline behavior needs historical evidence | #7, #8 | Open work |
| Decide session scope using the rubric | A success message does not establish a persistent authenticated session | #9 | Open and rubric-dependent |
| Add rate limiting and security logging | README's Defend phase calls for these controls | #10 | Open; absent from inspected login actions |
| Add regression checks and CI | Verify the earlier attack fails after defense and catch regressions | #11 | Open; no CI workflow in inspected development tree |

## Scheduling caveat

Roadmap #15 names September 30–October 30, 2026 as a **provisional internal schedule**. October 30 is not established as the professor's deadline. The roadmap says rubric, deadline, team size, and availability still require confirmation. Estimates are story points, not hours; older overlapping draft cards should not be double-counted.

## Limits on “why”

A commit title describes recorded intent, not every design discussion. Where no rationale is provided, this wiki leaves it unknown. No private group-chat statements, unrecorded meetings, or personal motivations are reconstructed.
