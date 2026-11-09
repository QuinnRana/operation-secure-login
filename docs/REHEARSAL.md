# Rehearsal and recovery guide

Preparation for [task #13](https://github.com/QuinnRana/operation-secure-login/issues/13), not a record of a completed team rehearsal or instructor approval.

## Confirm before scheduling

Record the professor's deadline, allotted demo time, rubric, permitted testing scope, submission format and acceptable backup medium. Assign a speaker and a different reviewer for each segment below. Do not invent timing or mark rubric requirements complete without evidence.

## Use the tested release, not an arbitrary branch

The verified November 4 checkpoint is main commit `59cbc3a9dd81129ffb208a6f77c5bc5f74790d94`. Its [CI run](https://github.com/QuinnRana/operation-secure-login/actions/runs/41895773581) passed seven tests, lint, TypeScript and build. Sites v6 used source `3cf49d94ad047186129e07d6b40b93ff411c25f6` with the same source tree.

As of November 4, development at `da32960067aeb376b4dc2a699ab8c576fdfdd91a` contained the lint fixes but lacked the later isolation, input-validation, hashing-compatibility and CI changes. This guide can live on a documentation branch from development; run the following commands in a **new checkout** of the pinned checkpoint. Do not reset or switch a teammate's working checkout. If the team chooses a later release, rerun checks and record its exact SHA before substituting it.

**Later verified state (November 9):** development at `48617f4e238ddcec4957946b33f588f278e2af9b` contains everything in the pinned checkpoint plus later work including the lab reset buttons (#25), the defended lab (#27, with #28–#29), secure and defended login rate limiting (#24, #29), and the unknown-account hashing change (#30). A fresh checkout of it passed 29 tests, lint, TypeScript and build; see the [before/after evidence](evidence/before-after-2026-11-09.md). The defended retest, reset and rate-limit segments below need that commit or a later verified one; the pinned checkpoint does not have them. Whether to move the pinned release is a team decision; if you do, replace the SHA in the commands below.

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
| Defended retest (needs `48617f4` or later) | `/defended-lab`: the same classroom payload with a dummy password, then `alex` / `falcon7` | Payload gets the generic "The username or password is incorrect." with no query or records; valid credentials succeed. Explain bound parameters and salted hashes (see `docs/DEFENDED-LAB.md`). |
| Rate limit (needs `48617f4` or later) | `/defended-lab`: six wrong passwords for one fictional account not used in the last minute (for example `casey`, if the retest above used `alex`) | The sixth returns "Too many login attempts. Try again in a minute." Other accounts still work; the vulnerable `/attack-lab` has no limit. |
| Current defense limits | Explain what is still missing | The local Attack Lab intentionally remains injectable with fictional plaintext seeds as the baseline. Isolation is not a repaired lab query. The defended lab (#8) and rate limiting (#10) exist on `48617f4` and later; sessions (#9) are not implemented. |

The defended-lab retest was recorded on development `48617f4` in the [before/after evidence](evidence/before-after-2026-11-09.md), with the baseline retained. During the rehearsal, repeat it live on that commit or a later verified one. Do not replace it with the secure-login control above.

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

Capture successful login, generic rejection, the local baseline query/results, the isolation checks, and the defended retest. Keep evidence in a team-approved location, using fictional records only; exclude browser account details, tokens, private logs and personal paths. Include each contributor's explanation and a reviewer sign-off. A passing automated run does not substitute for a timed group rehearsal or second-machine reproduction.

## Recovery plan

- **Network unavailable:** use the preinstalled local checkout and fictional local data. Test offline startup in advance. If dependencies were not installed, use an instructor-approved recording/screenshots; do not claim a live run occurred.
- **Hosted sign-in/access fails:** use each teammate's local checkout or the approved backup. Do not change sharing or authentication to complete a demo.
- **Port occupied:** use the alternate localhost port printed by the server and record it; do not expose the server on `0.0.0.0`.
- **Lab unavailable:** confirm the pinned checkpoint and development command. Production-mode absence of `LAB_DB` is expected. Do not add production bindings.
- **Unexpected database state:** preserve evidence first. On `48617f4` or later, use **Reset lab data** on `/attack-lab` and **Reset defended lab** on `/defended-lab`; each resets only its own lab table and never the secure login database (see `docs/DATABASE-ISOLATION.md` and `docs/DEFENDED-LAB.md`). On the pinned checkpoint (no reset buttons), or whenever a reset does not help, stop the local server and use another fresh checkout with an unused directory name and new project-local storage. Either way, do not delete `.wrangler` from anyone's working copy.
- **"Too many login attempts" (`48617f4` or later; the pinned checkpoint has no limit):** the secure and defended logins allow five attempts per account per minute, and resets do not clear this. Wait a minute or use another fictional account; plan the demo order so one account is not reused more than five times in a minute.
- **Login/build/check failure:** retain the failing command and exact commit, stop the affected segment, and use the verified backup. Do not disable checks or lower password-hashing work to force a successful demonstration.

Before calling task #13 done, the whole team must finish the timed rehearsal, resolve rubric gaps, reproduce the defended retest, and obtain approval of the backup format. Task #14 submission remains separate.

## Reproducible machine evidence

The [November 4 evidence record](evidence/rehearsal-2026-11-04.json) contains 14 passing assertions against the pinned release. It records expected and actual server-action results, including the intentionally unsafe query and fictional records. It also verifies that disposing and restarting the local Workers runtime preserves a fictional secure-database marker and both login paths. This is not a full browser/offline-startup recording or a lab-only reset test. Browser records with screenshots are in [secure login evidence](evidence/secure-login-2026-11-04.md) and [before/after lab evidence](evidence/before-after-2026-11-09.md).

From this documentation branch, after preparing a clean pinned-release checkout and installing its locked dependencies as above:

```sh
node scripts/rehearsal-evidence.mjs /absolute/path/to/operation-secure-login-rehearsal > rehearsal-evidence.json
```

Use your actual checkout path. The runner refuses a different commit or dirty target, loads the target's installed `esbuild` and `miniflare`, and bundles the actual server actions. It creates its own temporary D1 fixtures, never uses the checkout's `.wrangler` database, restarts only its own runtime, and removes only its own temporary directory. All requests use local Miniflare dispatch, not the hosted site. A failed assertion exits nonzero; do not treat an empty/partial redirected file as a passing record. Preserve the bundled result; choose a new output filename for later runs.

The recorded run used Node v24.22.1 on macOS arm64 and already-installed dependencies. It did not test installing packages without networking. The output intentionally omits absolute personal paths and contains only fictional training data. Review any future output before sharing it.

### Speaker/reviewer prompts to practice

Assign actual teammates before rehearsal; these prompts do not assign or credit contributions:

- Build speaker: trace the form to the server action and bound SQL lookup. Explain hash comparison and why the success message is not a session.
- Attack speaker: show an ordinary failed lab login before the supplied local bypass. Explain how input changes the SQL condition without discovering a password.
- Defense speaker: distinguish secure-query parameterization from database isolation. Explain why the intentionally vulnerable lab still needs a separate defended implementation and before/after evidence.
- Reviewer: ask which exact commit was run, which database each action can reach, what a missing lab binding does, and which rubric requirements still lack proof.

Do not fill speaker names, elapsed times, reviewer sign-offs or rubric scores from this automated run. Those require the real team session.
