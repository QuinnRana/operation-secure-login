# Local setup

[Wiki home](README.md)

This page consolidates the package scripts, PR #16's proposed instructions, and the team's requested verification sequence. It does not claim a new execution of these commands.

## Requirements

- Git.
- Node.js **22.13.0 or later**, required by package.json.
- pnpm **11.25.0**, the version recorded in PR #16 and chosen for reproduction.

Check versions before cloning:

```powershell
git --version
node --version
pnpm.cmd --version
```

On macOS/Linux use `pnpm` in place of `pnpm.cmd`. If a program is not recognized, resolve its installation/PATH first and open a new terminal. On macOS, an Apple Git license prompt must be reviewed and accepted by the computer owner.

## Fresh checkout and exact installation

Run each command and inspect its result before proceeding:

```powershell
git clone --branch codex/development https://github.com/QuinnRana/operation-secure-login.git
cd operation-secure-login
git branch --show-current
git rev-parse HEAD
pnpm.cmd install --frozen-lockfile
```

Record the actual commit, not just a branch name. If installation fails, retain the complete error and **do not delete or regenerate pnpm-lock.yaml**. A newer package-manager notice is not a requirement to upgrade during a pinned reproduction.

## Checks and startup

```powershell
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd dev --host 127.0.0.1
```

Record each result separately. A build pass does not cancel a lint failure. Use the URL/port printed by the terminal. Do not bind to `0.0.0.0`, expose a database port, or publish the vulnerable lab.

## Functional checklist

| Test | Procedure | Expected result |
| --- | --- | --- |
| Secure page | Open / | Page renders |
| Lab page | Open /attack-lab | Page and classroom instructions render |
| Valid secure login | student / Training123! | Access-granted message |
| Invalid secure login | student with incorrect fictional password | Generic incorrect-credentials message |
| Lab baseline | Page's supplied payload; nonempty fictional password | Exactly three fictional records |
| Restart | Stop, restart, repeat valid secure login | Login remains usable |

A wrong-password rejection on the attack page does not replace the wrong-password check on the secure page.

## Stop and restart

In the terminal running the server, press **Ctrl+C**. If Windows asks to terminate the batch job, answer Y. Restart from the same project folder with:

```powershell
pnpm.cmd dev --host 127.0.0.1
```

Local D1-compatible state is stored under `.wrangler/`, according to PR #16. Its first-machine record identifies `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`. Do not delete local state during the restart test. A successful seeded login after restart proves usability; because initialization can recreate missing data, it is not alone proof that every pre-restart record persisted.

## Troubleshooting and evidence

- Copy full errors and warnings, not just a screenshot of the final line.
- Record dependency-registry retries even when installation later succeeds.
- If the port is occupied, use the newly printed local port consistently.
- package.json has no dedicated test, typecheck, or reset script at the inspected baseline. Do not claim they ran.
- `pnpm start` maps to Wrangler using the built server configuration; the documented verification here uses `pnpm dev`.
- Docker is a conditional roadmap requirement, not a supplied/tested setup in the inspected tree.

## Verification report template

```text
Teammate / GitHub account:
Operating system and version:
Git:
Node:
pnpm:
Branch:
Full commit:
Local URL:
Frozen-lockfile installation:
Lint:
Build:
Secure page /:
Attack page /attack-lab:
Valid secure login:
Invalid secure login and exact displayed message:
Classroom payload / fictional record count:
Server restart and repeat login:
Complete warnings/errors:
Evidence links:
Reviewer:
```
