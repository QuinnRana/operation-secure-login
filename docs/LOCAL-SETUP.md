# Local classroom setup

Use a separate local copy on each teammate's computer. The lab intentionally contains a vulnerable endpoint; use fictional data and keep the development server on localhost.

## Prerequisites

- Git. On macOS, if Git reports an Xcode license problem, the computer owner must review and accept Apple's license themselves before using Apple's Git.
- Node.js 22.13 or later (Node 24 recommended for matching the setup verification).
- pnpm. Install it after Node using `npm install --global pnpm@11.25.0`.

Check `git --version`, `node --version`, and `pnpm --version` in a new terminal before continuing. A `command not found` error means that tool is missing or not on PATH.

## Fresh checkout

```sh
git clone --branch codex/development https://github.com/QuinnRana/operation-secure-login.git
cd operation-secure-login
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

Open the local URL printed by the server. Open both `/` and `/attack-lab` at that same address. Keep this terminal running; Ctrl+C stops the server.

The checked-in `.openai/hosting.json` supplies the `DB` binding name. Local development uses Cloudflare's local D1-compatible storage in `.wrangler/`; it does not require connecting to the hosted database. Tables and fictional demo records are initialized when their login actions first run, not simply when a page is opened. Both sets of tables currently share a database binding; separate database isolation is tracked in issue #5.

## Startup checks

1. On `/`, sign in with `student` and `Training123!`. Expect `Access granted. Welcome, student.`
2. Try an incorrect password. Expect the generic incorrect-credentials message.
3. On `/attack-lab`, use its supplied classroom payload with a dummy password. Expect three fictional records.
4. Restart the server and repeat the valid login to confirm the local database remains usable.

Record the computer/OS, branch and commit, Node/pnpm versions, local URL, and results. Never include personal credentials or real database records in evidence.

## Troubleshooting

- Use the printed port if the default is already occupied.
- Do not delete or regenerate the lockfile to get past an install error. Record the failing package and error first.
- Slow registry downloads may take several minutes on a first install.
- `pnpm build` checks the production build; it is separate from the initial development startup check.
- Do not use `--host 0.0.0.0` or publish the vulnerable lab to make a second-computer test easier. Each teammate should run their own local copy.

## Second-computer verification (required)

Issue #4 stays open until a second teammate reproduces these steps using only this document. A successful test on one computer does not satisfy the two-machine requirement.

## Verification record — October 5, 2026

- Machine 1: Apple Silicon MacBook, macOS 26.6.2.
- Source: `codex/development`, commit `da12c7c42336c82a058576fdbe7aa760fac6d794`.
- Tested tools: Node v24.19.0 and pnpm 11.25.0, using Codex's bundled runtime. This does not install these tools into the owner's normal Terminal PATH.
- `pnpm install --frozen-lockfile`: passed, with registry retries; lockfile unchanged.
- `pnpm dev --host 127.0.0.1`: passed, printed `http://localhost:3000/`.
- `/` and `/attack-lab`: rendered successfully in browser.
- Correct demo login: passed; incorrect password: rejected.
- Supplied classroom SQL-injection payload: returned exactly three fictional records.
- Server restart followed by valid login: passed.
- Observed local database: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` (SQLite files).
- Non-blocking development warning: Vite reported an inconsistently optimized client dependency from lucide-react.
- Machine 2: pending teammate verification. Production build and Docker were not tested as part of this startup check.
