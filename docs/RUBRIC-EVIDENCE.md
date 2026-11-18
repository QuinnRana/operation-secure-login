# Rubric-to-evidence map

Each criterion in the [capstone grading rubric](https://uiwcyber.github.io/cis3353-public/capstone/capstone-grading-rubric.html), with where its evidence is and what is still missing. Checked against `codex/development` `caba9c6`, the project board, the repository settings and the wiki on 2026-11-18. Part of [issue #12](https://github.com/QuinnRana/operation-secure-login/issues/12).

This is a team checklist, not a self-grade. "Status" describes the evidence, not the score the instructor will give.

**Status key:** ✅ evidence in place · 🟡 partly in place · ❌ missing · ❓ needs the team or instructor to decide

## 2. Project Implementation (12% of the course grade)

| Criterion (weight) | Evidence | Status | Still needed (who) |
|---|---|---|---|
| Technical complexity and execution (40%) | Working app with a secure login, sessions, a vulnerable lab and a defended lab, separate databases ([REPORT: Build](REPORT.md#build), [ARCHITECTURE.md](ARCHITECTURE.md)); attack demonstrated ([baseline](evidence/attack-baseline-2026-11-11.md)); 9 controls verified ([REPORT: Defend](REPORT.md#defend)) | 🟡 / ❓ | The rubric says "built in VMs or virtual networks". This project is a local web app. Confirm with the instructor whether that is acceptable (team). |
| Defenses verified, not asserted (35%) | Before/after evidence for each control: [REPORT: Defend](REPORT.md#defend), [before/after matrix](evidence/before-after-2026-11-09.md), [clickjacking](evidence/clickjacking-2026-11-11.md), 39 automated tests (the session tests were checked with negative controls). David reported a second-person Windows check of the anti-framing headers (PR #38). | ✅ | Second-teammate reproductions for #1, #7 and #11 would strengthen this (teammate). |
| Residual risk stated honestly (25%) | [REPORT: Residual risk](REPORT.md#residual-risk), each with the reason or compensating control | ✅ | Keep it current if anything changes. |

## 3. GitHub Repository (7%)

| Criterion (weight) | Evidence | Status | Still needed (who) |
|---|---|---|---|
| Repository structure and README (30%) | [README](../README.md): what was built, demo accounts, workflow, setup steps, safety boundary; docs in `docs/`, evidence in `docs/evidence/`, tests in `tests/` | 🟡 | `main` and `codex/development` must be brought together before submission (#14): `main` also has PR #41's fix, which `codex/development` does not. Whether CI is a required check is unverified; #11 recorded it as not enabled on Nov 4. The README has no one-sentence mission statement; the team should add its approved mission from the proposal (team). |
| Commits stand behind the board (30%) | Done items with merged PRs behind them: #8 (PR #27, plus Quinn's #28 and #29 for its tests and rate limit) and #9 (#33, #34, #36). Which commits stand behind #3, #4 and #6 was not checked. Non-merge commits on `codex/development` by month: Aug 1, Sep 2, Oct 5, Nov 26 | 🟡 | Most commits are from November. That can't be changed now; keep new work in small, real commits. Link each Done issue, including #3, #4 and #6, to the PRs or commits behind it (team). |
| Individual Contribution Summary Table (25%) | At the bottom of the [README](../README.md#individual-contribution-summary-table) | 🟡 | It must **match the board**. #3, #4 and #6 (8 points) are Done but unassigned, and Quinn and David have no assigned points. Assign the issues, then update the table (Quinn, as board owner). |
| Evidence stored where it is cited (15%) | All screenshots and logs are in `docs/evidence/` at the paths the README and docs link to ([REPORT: Evidence index](REPORT.md#evidence-index)) | 🟡 | The wiki (last updated 2026-10-21) does not yet link to this evidence. See the wiki section below (team). |

## 4. Project Board (6%)

| Criterion (weight) | Evidence | Status | Still needed (who) |
|---|---|---|---|
| User stories with story points (35%) | [Board](https://github.com/users/QuinnRana/projects/1): 15 items, 55 points in the Estimate field, each with a completion checklist | 🟡 | Items are written as tasks with checklists, not "As a … I want … so that …" user stories (team decision). |
| Planned across the semester (35%) | Status changes over time; issue progress notes from Nov 4 and comments from Nov 9 onward | ❌ | Only #1 has a milestone (Build), and the board has **no iteration field**. Add milestones and an iteration field and fill them in (Quinn, as board owner). |
| Assigned, current and complete (20%) | Statuses are updated as work moves | 🟡 | 7 of 15 items have no assignee: #3, #4, #6, #10, #13, #14, #15. Most have no milestone, and none has an iteration (Quinn). |
| Coordination is visible (10%) | Progress, blockers and hand-offs recorded in issue comments (for example on #1, #5, #11) and PR comments (for example #39) | 🟡 | Almost all issue comments come from one member, and PRs have comments but no formal GitHub reviews. Every member should record decisions and reviews in issues and PRs (team). |

## 5. GitHub Wiki Final Report (4%)

The [wiki](https://github.com/QuinnRana/operation-secure-login/wiki) has 9 pages: Home, Architecture and Code, History and Decisions, Issue and Activity Archive, Local Setup, People and Contributions, Roadmap and Ownership, Source Register, and Verification and Known Gaps. It was last updated **2026-10-21**, before the lab isolation, defended lab, rate limiting and sessions work.

| Criterion (weight) | Evidence | Status | Still needed (who) |
|---|---|---|---|
| Architecture and diagrams (40%) | The diagram with trust boundaries is in the repo: [ARCHITECTURE.md](ARCHITECTURE.md) | 🟡 | Copy it, or link it, into the wiki's architecture page (whoever has wiki access). |
| Technical documentation (40%) | Runbook material is in the repo: [LOCAL-SETUP.md](LOCAL-SETUP.md), [REPORT.md](REPORT.md), [REHEARSAL.md](REHEARSAL.md); proposed wiki updates in [`docs/wiki-updates/`](wiki-updates/) | 🟡 | Publish it to the wiki so the environment can be rebuilt "from the wiki alone", including test results (team). |
| Wiki structure and navigation (20%) | Home page exists | ❌ | No `_Sidebar` page. The rubric asks for Home, Architecture, Setup, **Sprint Notes** and **Final Report** sections (team). |

## 6. Final Presentation (5%), Nov 30 / Dec 2

| Criterion (weight) | Evidence | Status | Still needed (who) |
|---|---|---|---|
| Technical demo (40%) | Live sequence and recovery plan in [REHEARSAL.md](REHEARSAL.md): `/attack-lab` bypass, then the same payload failing on `/defended-lab`, then throttling | 🟡 | A timed team rehearsal (#13). |
| Content and architecture (30%) | [ARCHITECTURE.md](ARCHITECTURE.md), [REPORT.md](REPORT.md) | 🟡 | Slides, and which course modules were integrated (team). |
| Professionalism and Q&A (30%) | — | ❌ | 10–15 minutes, **every member speaks**; a missed slot costs 15% of the team's capstone grade (team). |

## 1. Capstone Proposal (1%)

Not tracked here; this map covers only what the repository and board can show.

## Individual grades

Each member's grade is the team score × the number of members × that member's share of the story points (capped per component). The README table and the board are what the instructor checks, so **the board's assignments must be correct before grading**.
