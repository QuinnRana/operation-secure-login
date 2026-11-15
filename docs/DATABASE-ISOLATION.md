# Attack Lab database boundary

The secure login uses `DB`. Every Attack Lab query, initialization statement, and seed write uses `LAB_DB`. The server action rejects a missing binding or the exact same binding object as `DB`, without reading or writing either database. It never falls back to `DB`.

`pnpm dev --host 127.0.0.1` configures different local database names and IDs. The existing secure DB ID is preserved. Lab records initialize on the first lab submission in the new database. Existing fictional `lab_accounts` in the old secure database are left untouched; this patch does not delete or migrate data. Preserve any existing before/after evidence before resetting local storage.

The lab deliberately retains its unsafe SQL and fictional plaintext credentials. Ordinary lab credentials and the supplied classroom bypass still work. SQL injections that reference `users` cannot reach the separate secure database. This is database isolation, not a fix for SQL injection, arbitrary server-code execution, or a production authentication system.

## Schemas and seed data

| Binding | Table | Columns | Seed | Created by |
|---|---|---|---|---|
| `DB` (secure login) | `users` | `id`, `username` (unique), `password_hash`, `password_salt`, `created_at` | `student`, stored as a PBKDF2-SHA-256 hash | `prepareDatabase()` in `app/actions.ts`, on each login submission that passes input validation |
| `LAB_DB` (Attack Lab) | `lab_accounts` | `id`, `username`, `password` (plaintext, intentional), `display_name`, `role`, `private_note` | `alex`, `jamie`, `casey` with fictional notes | `prepareLab()` in `app/attack-lab/actions.ts`, on each non-blank lab submission (seeding only when the table is empty) and on reset |
| `LAB_DB` (defended lab) | `defended_lab_accounts` | `id`, `username` (unique), `password_hash`, `password_salt`, `display_name`, `role`, `private_note` | The same three accounts, each with a random salt and a PBKDF2-SHA-256 hash | `prepareDefendedLab()` in `app/defended-lab/actions.ts`, on each valid defended submission (seeding only when the table is empty) and on defended reset. See [DEFENDED-LAB.md](DEFENDED-LAB.md). |

`users` is also described in `db/schema.ts` and `drizzle/`. `lab_accounts` and `defended_lab_accounts` exist only in their lab actions' `CREATE TABLE` statements, not in `db/schema.ts` or `drizzle/`. All seed values are fictional training data written in the source; no real people, real passwords, or reused passwords are involved.

## How requests reach each database

1. **Secure login:** `/` renders `components/login-form.tsx`, which submits to the `login` server action in `app/actions.ts`. It validates input, ensures the `users` table and seed exist, and reads the account with a bound parameter. It only ever uses `env.DB`.
2. **Attack Lab login:** `/attack-lab` renders `components/attack-form.tsx`, which submits to `vulnerableLogin` in `app/attack-lab/actions.ts`. It looks up `env.LAB_DB`, stops with an "unavailable" error if that binding is missing or is the same object as `env.DB`, seeds `lab_accounts` if it is empty, then runs the deliberately string-built query against `LAB_DB` only.
3. **Attack Lab reset:** the **Reset lab data** button on the same page submits to `resetLab`. It applies the same binding check, drops `lab_accounts` in `LAB_DB`, and re-creates the three seed records. It has no access path to `DB`.
4. **Defended lab:** `/defended-lab` renders `components/defended-form.tsx`, which submits to `defendedLogin` and `resetDefendedLab` in `app/defended-lab/actions.ts`. They use the same binding check and only touch `defended_lab_accounts` in `LAB_DB`.

All lab actions share one binding check, `isolatedLabDb()` in `lib/lab-db.ts`.

Locally, both bindings come from `db/local-bindings.ts` through `vite.config.ts`. Wrangler stores each database as its own SQLite file under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` (ignored by Git). The file names are derived hashes, not the binding names.

## Resetting the lab

Use the **Reset lab data** button at the bottom of `/attack-lab` before each recorded demonstration, or whenever lab rows look wrong. It restores the three fictional records with IDs 1–3, works even if the lab has never been used, and can be repeated safely. Save any evidence you need before resetting, because changed lab rows are discarded. The lab and reset buttons are disabled while the other one is running. Server-side reset uses a single D1 transaction for drop, create and seed. First-use initialization also creates and conditionally seeds within one transaction, so concurrent resets and logins cannot duplicate the seed or observe a half-reset table. If any reset statement fails, the previous lab schema and rows are retained; the action returns an error and can be retried.

The reset never touches the secure login database: the `users` table, the `student` account, and any other `DB` data stay as they were. In production builds there is no `LAB_DB`, so the reset returns the same "unavailable" error as the lab login and writes nothing.

Do not delete `.wrangler/` to reset the lab; that would also discard the secure login's local data. Use the reset button instead.

## Restart behavior

Stopping and restarting `pnpm dev` keeps both local database files. After a restart, the `student` login still works and the lab keeps whatever rows it had, including the result of the last reset. Clones made before this isolation change may still contain an old `lab_accounts` table inside the secure database file. It is left untouched and is no longer read by the lab.

## Permitted target and data

- **Permitted target:** only the Attack Lab on a teammate's own local development server (`pnpm dev --host 127.0.0.1`, reached at `localhost`). Do not aim the payload at the hosted site, another teammate's machine, or any other system.
- **Permitted data:** only the fictional seed records above. Do not add real names, real credentials, or reused passwords to either database.
- **Team confirmation:** TODO. The team still needs to confirm this target and data scope against the professor's rubric (issue #2), and record who confirmed it and when.

## Build and hosting

Production builds omit `LAB_DB`; the existing Sites hosting declaration remains `DB` only. The Attack Lab page remains available for instructions, but submissions return an unavailable error when the binding is absent. The secure login is unchanged. Local `pnpm start` uses the production build and likewise has no lab binding.

No database is provisioned, no credentials are created, and no deployment is performed by this change. Binding names and object inequality cannot prove physical separation in an arbitrary external deployment. Do not manually alias two bindings to the same database. Before any future restricted hosted lab, the operator must independently provision and verify distinct physical databases and access restrictions using a hosting system that supports them, then review its configuration separately. Do not add the local placeholder ID to a live deployment. Hosted isolation is not claimed or verified here.

## Regression checks

Run `pnpm test:isolation` (Node 22.13+). Tests execute the actual TypeScript server actions using disposable in-memory SQLite adapters for the D1 API. They cover secure login success/failure, legitimate lab login, the classroom bypass, cross-table and schema probes, fail-closed bindings, lab reset (seed restored, secure `users` rows unchanged), and local/build configuration. They do not connect to a hosted database. Node may print an experimental SQLite warning on supported older versions.

Run `node --test tests/lab-reset.test.mjs` for disposable Workers/D1 concurrency, rollback and missing-binding checks. It covers ten simultaneous resets, overlapping first logins, reset/login overlap, failed-batch rollback, and preservation of unrelated lab and secure data.

`tests/defended-lab.test.mjs` covers the defended lab; see [DEFENDED-LAB.md](DEFENDED-LAB.md). `pnpm test` runs every test file.

Run `pnpm lint` and `pnpm build` separately; record any pre-existing failures. The intentionally vulnerable baseline remains in Git history and in the local lab for the class evidence workflow.
