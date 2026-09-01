# Operation Secure Login

CIS 3353 Build–Attack–Defend capstone lab.

## Current build

- Responsive username/password login page
- SQL database-backed user lookup
- Prepared SQL statements
- PBKDF2-SHA-256 password hashing with per-account salt support
- Generic login errors that do not reveal whether a username exists
- Demo account seeded on the first login attempt

## Demo account

- Username: `student`
- Password: `Training123!`

## Run locally

Install dependencies and start the development site with the package scripts in `package.json`. The local development environment creates and retains the D1-compatible database automatically.

## Capstone safety boundary

This application is for an isolated, authorized classroom lab. Do not deploy an intentionally vulnerable version to a public host. Keep the later Attack phase limited to the team-owned lab environment and document each test, result, defense, and verification step.
