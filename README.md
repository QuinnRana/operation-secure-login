# Operation Secure Login

CIS 3353 Build–Attack–Defend capstone lab.

## Current build

- Responsive database-backed username/password login
- Secure login using prepared SQL statements
- PBKDF2-SHA-256 password hashing
- Generic authentication errors
- Isolated SQL-injection Attack Lab with fictional records only
- Visible unsafe query and repeatable classroom test payload
- Hosted owner-only site for controlled testing across devices

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
