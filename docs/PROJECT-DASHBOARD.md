# Project progress dashboard

Open `/project-dashboard.html` on the running application, or download `public/project-dashboard.html` and open it in a browser with internet access. GitHub’s file preview does not execute HTML.

The dashboard connects to QuinnRana/operation-secure-login automatically and reads live GitHub issues on startup. Public access requires no token. Use the menu → Reload from GitHub to refresh while the page is open.

## Completion percentage

Completed issues / total issues × 100, rounded to the nearest whole percent. Each issue has equal weight. Pull requests and the START HERE roadmap issue #15 are excluded. The list of remaining work links directly to each open task, including its checklist and acceptance criteria. A task marked closed counts as complete; that does not independently verify its code or evidence. No tasks means “Not tracked yet”, not 100%.

Update the shared tasks on GitHub. Dashboard edits are local to your browser and do not update the team’s repository. Use reload to discard local changes and retrieve shared status. The percentage is task completion, not a predicted course grade. Confirm the professor’s rubric in issue #2.

## Source and license

Adapted from UIWCyber/UIW-PMD, supplied by the team. Original MIT license and documentation are retained in `docs/uiw-pmd/`. The timeline, board, activity and analytics views remain available. No credentials are included in the repository.
