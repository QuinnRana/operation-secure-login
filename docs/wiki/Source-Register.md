# Source register

[Wiki home](README.md)

## Snapshot and method

Compiled October 21, 2026 from the repository's development tree, commit history, branch metadata, all 16 returned issue/PR collection entries, relevant issue event collections, PR #16 metadata/files/commits, and PR review submissions. The issue collection contained 15 issues and one PR. All issue assignee arrays were empty; all discussion-comment counts were zero; PR #16's review list was empty.

GitHub Projects draft cards, complete project membership, private group chats, and off-platform work were not available through the inspected records. Absence from these sources does not prove a person did no work.

## Sources

| Source | Used for |
| --- | --- |
| [Pinned README](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/README.md) | Project purpose, phases, demo account, stated boundary |
| [Pinned package.json](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/package.json) | Exact scripts, Node requirement, versions |
| [Secure action](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/app/actions.ts) | Bound query, seed account, generic errors, success-only behavior |
| [Attack action](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/app/attack-lab/actions.ts) | Unsafe query, plaintext fictional data, three records |
| [Password helper](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/lib/password.ts) | PBKDF2 parameters and comparison implementation |
| [DB helper](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/db/index.ts) and [schema](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/db/schema.ts) | D1 binding and schema tooling |
| [Login form](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/components/login-form.tsx) and [attack form](https://github.com/QuinnRana/operation-secure-login/blob/da12c7c42336c82a058576fdbe7aa760fac6d794/components/attack-form.tsx) | Result display and lint-related markup |
| [Development commits](https://github.com/QuinnRana/operation-secure-login/commits/codex/development) | Recorded authors, messages, timestamps |
| [Roadmap #15](https://github.com/QuinnRana/operation-secure-login/issues/15) | Proposed work order, roles, provisional schedule |
| [PR #16](https://github.com/QuinnRana/operation-secure-login/pull/16) | Why setup documentation was proposed; draft and target branch |
| [Proposed setup document](https://github.com/QuinnRana/operation-secure-login/blob/e03eedd687a4177abc373dfaa9d37c33e822b324/docs/LOCAL-SETUP.md) | First-machine reported verification and limitations |
| [Branches API](https://api.github.com/repos/QuinnRana/operation-secure-login/branches?per_page=100) | Branch heads and protected flags |
| [Issues collection](https://api.github.com/repos/QuinnRana/operation-secure-login/issues?state=all&per_page=100) | Authors, states, assignees, timestamps, comment counts |
| Issue events linked in archive | Actors for closure and project updates |

## Evidence wording

“Authored” means the identity in Git commit or GitHub item metadata. “Reported” means a written claim by the repository author. “Observed in code” means source inspection. “Suggested” means planned work. No record is presented as a new test executed by the wiki author.

This documentation was prepared with Codex at the repository collaborator's request. Any connector-created commit identity identifies the account used to publish the documentation; it should not imply that every historical contributor authored this wiki.

## Keeping the wiki current

On later updates, record the new inspected commit/date, refresh task states and assignments, attach review and test evidence, and distinguish what changed after this snapshot. Preserve original source links and avoid publishing personal emails, secrets, tokens, or real user data.
