# Wiki updates to publish

The GitHub Wiki has no pull requests, so these pages are reviewed here first. After this PR merges, a wiki maintainer copies them into the wiki:

| File here | Wiki page | Change |
|---|---|---|
| `Current-State-November-2026.md` | **New page** "Current State November 2026" | What is implemented now, evidence, board status, open items |
| `Home.md` | Replaces "Home" | One table row linking the new page, plus a dated "Status update" section; the October 21 text is unchanged |
| `Verification-and-Known-Gaps.md` | Replaces "Verification and Known Gaps" | A dated "Status update" section at the end; the October 21 text is unchanged |

Based on wiki commit `ddb6e7f` (2026-10-21). If the wiki changed since then, merge by hand instead of replacing.

To publish, run these from the root of an up-to-date checkout of `codex/development`. The wiki is cloned next to the repository, not inside it:

```sh
git clone https://github.com/QuinnRana/operation-secure-login.wiki.git ../operation-secure-login.wiki
cp docs/wiki-updates/Current-State-November-2026.md docs/wiki-updates/Home.md docs/wiki-updates/Verification-and-Known-Gaps.md ../operation-secure-login.wiki/
cd ../operation-secure-login.wiki
git status
git add Current-State-November-2026.md Home.md Verification-and-Known-Gaps.md
git diff --cached --stat
git commit -m "Add November 2026 current-state page and status updates"
git push
```

The wiki has only a `master` branch, so `git push` publishes immediately. It is the wiki maintainer's own action and needs their sign-off.

This folder can be deleted after the pages are published.
