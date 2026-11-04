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

## Database isolation

See [database isolation](docs/DATABASE-ISOLATION.md) for local behavior, regression checks, and deployment requirements.
## Secure login input checks

The secure server action requires exactly one text username and password. It rejects file uploads, duplicate credential fields, usernames longer than 256 UTF-16 code units, and passwords longer than 1,024 code units before database or hashing work. Limits apply to raw input, so excessive padding is rejected. Username edges are trimmed; passwords are never trimmed, truncated, or Unicode-normalized. Other form keys remain permitted for framework metadata.

Run `pnpm test:login` with Node 22.13+ for disposable SQLite-backed server-action regression tests. These limits bound application processing after form parsing; they are not request-body limits or rate limiting. The intentionally vulnerable Attack Lab is unchanged. This is a success-message authentication demo, not a session system.
