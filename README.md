# Operation Secure Login

CIS 3353 Build–Attack–Defend capstone lab.

## Current build

- Responsive database-backed username/password login
- Secure login using prepared SQL statements
- PBKDF2-SHA-256 password hashing
- Generic authentication errors
- Local SQL-injection Attack Lab with its own database and fictional records only
- Visible unsafe query and repeatable classroom test payload
- Hosted secure-login site; Attack Lab disabled without a dedicated lab binding

## Demo accounts

Secure login:

- Username: `student`
- Password: `Training123!`

Attack Lab:

- Open `/attack-lab`
- Use the authorized payload shown on that page
- Capture the payload, unsafe query, bypass result, and fictional records as evidence

## Build–Attack–Defend workflow

1. **Build:** demonstrate the working database-backed login.
2. **Attack:** use the supplied SQL-injection payload in the isolated lab and document the authentication bypass.
3. **Defend:** replace string-built SQL with bound parameters, hash passwords, add rate limiting and logging, then repeat the same test to verify it fails.

## Run locally

Install dependencies and start the development site with the package scripts in `package.json`. The local development environment creates and retains the D1-compatible database automatically.

## Safety boundary

This application is for an authorized classroom lab and contains only fictional training records. Do not aim the payload at any other website or system. Keep the hosted site restricted to the project owner and approved teammates.

## Project wiki

See the [project Wiki](https://github.com/QuinnRana/operation-secure-login/wiki) for architecture, setup, contribution history, the roadmap, and verification notes originally contributed by DavidE2525.

## Rehearsal preparation

See [the rehearsal and recovery guide](docs/REHEARSAL.md) for the pinned tested release, local demonstration sequence, evidence sheet and network-failure plan. It records remaining work rather than claiming the final rehearsal is complete.

## Database isolation

See [database isolation](docs/DATABASE-ISOLATION.md) for local behavior, regression checks, and deployment requirements.

## Secure login input checks

The secure server action requires exactly one text username and password. It rejects file uploads, duplicate credential fields, usernames longer than 256 UTF-16 code units, and passwords longer than 1,024 code units before database or hashing work. Limits apply to raw input, so excessive padding is rejected. Username edges are trimmed; passwords are never trimmed, truncated, or Unicode-normalized. Other form keys remain permitted for framework metadata.

Run `pnpm test:login` with Node 22.13+ for disposable SQLite-backed server-action regression tests. These limits bound application processing after form parsing; they are not request-body limits or rate limiting. The intentionally vulnerable Attack Lab is unchanged. This is a success-message authentication demo, not a session system.

## Combined verification

Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`. The test suite includes actual Workers-runtime tests with disposable local D1 databases, in addition to the focused Node/SQLite tests. Workers tests require local loopback sockets; they do not access the hosted website or database. GitHub Actions runs these checks on pushes and pull requests. Deployment remains separate.

## Login rate limiting

The secure login and defended lab each allow five attempts per account per 60-second window using an atomic shared-D1 budget and timestamped outcome-only logs. See [policy, tradeoffs, and verification](docs/LOGIN-RATE-LIMIT.md). The intentionally vulnerable local Attack Lab is unchanged.

## Server-action request size

Server-action bodies are capped at **16 KiB (16,384 bytes)** before form decoding, including credential fields and framework metadata. This complements the existing per-field limits, which apply after parsing. Both declared-length and streamed bodies are checked by the framework. Oversized ordinary form submissions receive HTTP 413; client-invoked actions receive the framework's HTTP 500 RSC error response before the action runs. This is not a global traffic limit or a limit on all HTTP routes.

Run `pnpm build && pnpm test:http` to verify the actual built Worker with disposable local D1. The check rejects 16,385-byte forms and fetch-action bodies with and without a declared length, verifies no authentication tables were created, and authenticates valid forms at exactly 16,384 bytes. CI runs this after the build. The cap also applies to local lab server actions; the intentional SQL-injection demonstration and reset forms remain small and unchanged. No deployment or live database changes are included.
