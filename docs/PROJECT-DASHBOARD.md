# Project progress dashboard

Open `/project-dashboard.html` on the running application, or download `public/project-dashboard.html` and open it in a browser with internet access. GitHub’s file preview does not execute HTML.

The dashboard connects to QuinnRana/operation-secure-login automatically and reads live GitHub issues on startup. Public access requires no token. Use the menu → Reload from GitHub to refresh while the page is open.

## Completion percentage

Completed issues / total issues × 100, rounded to the nearest whole percent. Each issue has equal weight. Pull requests and the START HERE roadmap issue #15 are excluded. The list of remaining work links directly to each open task, including its checklist and acceptance criteria. A task marked closed counts as complete; that does not independently verify its code or evidence. No tasks means “Not tracked yet”, not 100%.

Update the shared tasks on GitHub. Dashboard edits are local to your browser and do not update the team’s repository. Use reload to discard local changes and retrieve shared status. The percentage is task completion, not a predicted course grade. Confirm the professor’s rubric in issue #2.

## Source and license

Adapted from UIWCyber/UIW-PMD, supplied by the team. Original MIT license and documentation are retained in `docs/uiw-pmd/`. The timeline, board, activity and analytics views remain available. No credentials are included in the repository.

## Tooltip text boundary

GitHub/GitLab issue titles, milestone notes, objective labels and sprint goals are untrusted text. Tooltip attributes are HTML-escaped once when the dashboard renders, then displayed with `textContent`. They must never be passed to `innerHTML`: the browser has already decoded the attribute, so parsing it again can turn a title into executable markup. Tooltips use line breaks and plain text instead of embedded HTML formatting, including chart and drag feedback.

This closes the tooltip interpretation boundary only. It is not an audit of every dashboard rendering path, connection setting, or token-storage behavior. The intentionally vulnerable Attack Lab and its evidence are unchanged.

### Regression checks

- `pnpm test` includes the dashboard script parse check and actual tooltip-handler tests for literal text, dismissal and dragging.
- `pnpm test:dashboard` requires an installed Chrome or Chromium executable. Set `CHROME_BIN` if it is not named `chromium`, `google-chrome` or `chromium-browser`. CI runs this check with `google-chrome`.
- The browser check uses the real standalone dashboard DOM, renderers, event handlers and CSP, replacing only its network startup with fictional fixtures. All connections are disabled. It checks SVG/event-handler-shaped titles, attribute-breakout text, entity text, quotes and Unicode in six tooltip sources, all four views, and drag feedback. Tooltip content must remain literal and create no child elements.
- The same command runs an in-memory negative control that restores the unsafe HTML sink. The control must fail at the tooltip security boundary. Neither version edits the source or contacts GitHub, GitLab, the hosted site or a database.

Each browser run uses a disposable profile and deletes it afterwards. The fixture uses headless Chrome's `--no-sandbox` mode for isolated CI/container compatibility; it must not be pointed at live or arbitrary pages. Environments that forbid Chrome's process sockets cannot run this browser check locally; the Node handler tests do not substitute for the browser check.
