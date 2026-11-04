# Attack Lab database boundary

The secure login uses `DB`. Every Attack Lab query, initialization statement, and seed write uses `LAB_DB`. The server action rejects a missing binding or the exact same binding object as `DB`, without reading or writing either database. It never falls back to `DB`.

`pnpm dev --host 127.0.0.1` configures different local database names and IDs. The existing secure DB ID is preserved. Lab records initialize on the first lab submission in the new database. Existing fictional `lab_accounts` in the old secure database are left untouched; this patch does not delete or migrate data. Preserve any existing before/after evidence before resetting local storage.

The lab deliberately retains its unsafe SQL and fictional plaintext credentials. Ordinary lab credentials and the supplied classroom bypass still work. SQL injections that reference `users` cannot reach the separate secure database. This is database isolation, not a fix for SQL injection, arbitrary server-code execution, or a production authentication system.

## Build and hosting

Production builds omit `LAB_DB`; the existing Sites hosting declaration remains `DB` only. The Attack Lab page remains available for instructions, but submissions return an unavailable error when the binding is absent. The secure login is unchanged. Local `pnpm start` uses the production build and likewise has no lab binding.

No database is provisioned, no credentials are created, and no deployment is performed by this change. Binding names and object inequality cannot prove physical separation in an arbitrary external deployment. Do not manually alias two bindings to the same database. Before any future restricted hosted lab, the operator must independently provision and verify distinct physical databases and access restrictions using a hosting system that supports them, then review its configuration separately. Do not add the local placeholder ID to a live deployment. Hosted isolation is not claimed or verified here.

## Regression checks

Run `pnpm test:isolation` (Node 22.13+). Tests execute the actual TypeScript server actions using disposable in-memory SQLite adapters for the D1 API. They cover secure login success/failure, legitimate lab login, the classroom bypass, cross-table and schema probes, fail-closed bindings, and local/build configuration. They do not connect to a hosted database. Node may print an experimental SQLite warning on supported older versions.

Run `pnpm lint` and `pnpm build` separately; record any pre-existing failures. The intentionally vulnerable baseline remains in Git history and in the local lab for the class evidence workflow.
