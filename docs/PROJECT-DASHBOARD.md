# Project progress dashboard

Open `/project-dashboard.html` on the running application, or download `public/project-dashboard.html` and open it in a browser with internet access. GitHub’s file preview does not execute HTML.

The dashboard connects to QuinnRana/operation-secure-login automatically and reads live GitHub issues on startup. Public access requires no token. Use the menu → Reload from GitHub to refresh while the page is open.

## Completion percentage

Completed issues / total issues × 100, rounded to the nearest whole percent. Each issue has equal weight. Pull requests and the START HERE roadmap issue #15 are excluded. The list of remaining work links directly to each open task, including its checklist and acceptance criteria. A task marked closed counts as complete; that does not independently verify its code or evidence. No tasks means “Not tracked yet”, not 100%.

Update the shared tasks on GitHub. Dashboard edits are local to your browser and do not update the team’s repository. Use reload to discard local changes and retrieve shared status. The percentage is task completion, not a predicted course grade. Confirm the professor’s rubric in issue #2.

## Source and license

Adapted from UIWCyber/UIW-PMD, supplied by the team. Original MIT license and documentation are retained in `docs/uiw-pmd/`. The timeline, board, activity and analytics views remain available. No credentials are included in the repository.

## Assignee selector text safety

Imported member names and roles are untrusted text. The issue modal, inline assignee editor and board filter now share an option renderer that escapes both option values and labels. Explicit values preserve the selected member name even when the visible modal label also contains a role. Markup and quotes must remain text rather than close an option/select or create attributes.

`pnpm test` covers these three call sites, script parsing, markup-shaped names/roles, quotes, ampersands, Unicode and normal selection values. These are source/renderer regression tests, not a full browser audit. Other dashboard rendering paths still require separate review; this change does not claim to make arbitrary imported project files safe. No login, database, or intentionally vulnerable classroom lab behavior is changed.
