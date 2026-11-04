# Rehearsal and recovery guide

Preparation for [task #13](https://github.com/QuinnRana/operation-secure-login/issues/13), not a record of a completed team rehearsal or instructor approval.

## Confirm before scheduling

Record the professor's deadline, allotted demo time, rubric, permitted testing scope, submission format and acceptable backup medium. Assign a speaker and a different reviewer for each segment below. Do not invent timing or mark rubric requirements complete without evidence.

## Use the tested release, not an arbitrary branch

The verified November 4 checkpoint is main commit `59cbc3a9dd81129ffb208a6f77c5bc5f74790d94`. Its [CI run](https://github.com/QuinnRana/operation-secure-login/actions/runs/41895773581) passed seven tests, lint, TypeScript and build. Sites v6 used source `3cf49d94ad047186129e07d6b40b93ff411c25f6` with the same source tree.

Development at `da32960067aeb376b4dc2a699ab8c576fdfdd91a` contains the lint fixes but lacks the later isolation, input-validation, hashing-compatibility and CI changes. This guide can live on a documentation branch from development; run the following commands in a **new checkout** of the pinned checkpoint. Do not reset or switch a teammate's working checkout. If the team chooses a later release, rerun checks and record its exact SHA before substituting it.

### Prepare while networking is available

Prerequisites: Git, Node 24 and pnpm 11.25.0. Install these through the team's approved setup process first. Choose an unused directory name if `operation-secure-login-rehearsal` already exists.

```sh
git clone https://github.com/QuinnRana/operation-secure-login.git operation-secure-login-rehearsal
cd operation-secure-login-rehearsal
git switch --detach 59cbc3a9dd81129ffb208a6f77c5bc5f74790d94
git rev-parse HEAD
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm dev --host 127.0.0.1
```

Stop if any command fails; a successful build alone does not establish working login. Open the exact localhost URL printed by the server. Each teammate should prepare their own checkout and dependencies before disconnecting from the network. Use fictional data only. Record the local URL and runtime versions. Ctrl+C stops the server.

## Demonstration sequence and expected results

| Segment | Action on the local checkout | Expected result / explanation |
| --- | --- | --- |
| Build | `/`: `student` / `Training123!` | Success message. This does not create a persistent session or protected account area. |
| Reject invalid login | `/`: `student` / `incorrect-training-password`, then `unknown` with that password | Generic incorrect-credentials response; no query or records displayed. |
| Secure query control | `/`: username `' OR 1=1 --`, dummy password | Rejected. Bound SQL parameters keep the input as data. |
| Attack baseline | `/attack-lab`: `alex` / `wrong`, then the page's supplied classroom payload with a dummy password | Wrong password fails; supplied bypass returns three fictional records. Record the displayed query and explain how concatenation changes its meaning. |
| Isolation | Explain `DB` versus `LAB_DB`; show `pnpm test:isolation` and `pnpm test:workers` results | Separate local databases; tests cover cross-database probes and missing-binding failure. Do not perform probes on the hosted site. |
| Current defense limits | Explain what still needs task #8, #9 and #10 work | The local Attack Lab intentionally remains injectable with fictional plaintext seeds. Isolation is not a repaired lab query. Rate limiting and sessions are not implemented. |

A defended-lab retest cannot honestly be demonstrated yet. Once task #8 is implemented and verified, add the exact earlier payload, expected rejection and actual result at the defended endpoint while retaining the baseline evidence. Do not replace this missing result with the secure-login control above.

The hosted Site is owner-private and production has only `DB`. Its Attack Lab page may render, but submissions must return unavailable without `LAB_DB`. Do not enable a production lab, change sharing, or publish local bindings for the rehearsal. `pnpm start` uses the production build and therefore does **not** provide the local vulnerable-lab demo; use `pnpm dev --host 127.0.0.1` for that segment.

## Evidence sheet (fill during an actual run)

| Field | Recorded value |
| --- | --- |
| Date, computer / OS, speaker and reviewer | Pending |
| Exact commit, Node and pnpm versions | Pending |
| Authorized local target and fresh-checkout state | Pending |
| Each segment: input, expected result, actual result, elapsed time | Pending |
| Screenshot / recording filenames and rubric rows | Pending |
| Reviewer reproduction, questions and unresolved failures | Pending |

Capture successful login, generic rejection, the local baseline query/results, the isolation checks, and the eventual defended retest. Keep evidence in a team-approved location, using fictional records only; exclude browser account details, tokens, private logs and personal paths. Include each contributor's explanation and a reviewer sign-off. A passing automated run does not substitute for a timed group rehearsal or second-machine reproduction.

## Recovery plan

- **Network unavailable:** use the preinstalled local checkout and fictional local data. Test offline startup in advance. If dependencies were not installed, use an instructor-approved recording/screenshots; do not claim a live run occurred.
- **Hosted sign-in/access fails:** use each teammate's local checkout or the approved backup. Do not change sharing or authentication to complete a demo.
- **Port occupied:** use the alternate localhost port printed by the server and record it; do not expose the server on `0.0.0.0`.
- **Lab unavailable:** confirm the pinned checkpoint and development command. Production-mode absence of `LAB_DB` is expected. Do not add production bindings.
- **Unexpected database state:** preserve evidence and the existing checkout. Stop the local server and use another fresh checkout with an unused directory name and new project-local storage. There is no verified lab-only reset procedure yet; do not delete `.wrangler` from anyone's working copy.
- **Login/build/check failure:** retain the failing command and exact commit, stop the affected segment, and use the verified backup. Do not disable checks or lower password-hashing work to force a successful demonstration.

Before calling task #13 done, the whole team must finish the timed rehearsal, resolve rubric gaps, reproduce the defended retest, and obtain approval of the backup format. Task #14 submission remains separate.
