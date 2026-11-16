# Project progress dashboard

Open `/project-dashboard.html` on the running application, or download `public/project-dashboard.html` and open it in a browser with internet access. GitHub’s file preview does not execute HTML.

The dashboard connects to QuinnRana/operation-secure-login automatically and reads live GitHub issues on startup. Public access requires no token. Use the menu → Reload from GitHub to refresh while the page is open.

## Completion percentage

Completed issues / total issues × 100, rounded to the nearest whole percent. Each issue has equal weight. Pull requests and the START HERE roadmap issue #15 are excluded. The list of remaining work links directly to each open task, including its checklist and acceptance criteria. A task marked closed counts as complete; that does not independently verify its code or evidence. No tasks means “Not tracked yet”, not 100%.

Update the shared tasks on GitHub. Dashboard edits are local to your browser and do not update the team’s repository. Use reload to discard local changes and retrieve shared status. The percentage is task completion, not a predicted course grade. Confirm the professor’s rubric in issue #2.

## Token destination safety

Project connections require HTTPS without embedded usernames or passwords. Saved connection hosts are validated again before their tokens are read. GitHub.com uses `api.github.com`; GitHub Enterprise and GitLab use the API on the selected host. Requests omit browser cookies and refuse redirects, including same-host redirects. If a repository moved or an API redirects, connect using its current HTTPS project link instead of forwarding a token through the redirect.

Editing a project can reuse its saved token only for the same provider and API destination (including the port). Changing the host, port or provider never copies the original token or deletes it. The edited destination can use its own previously saved token, a newly supplied token, or anonymous access for public data. The form explains this before connecting. Successful same-destination project moves retain the existing convenience of moving the token; failed moves keep the original credentials. The recent-project list still holds at most six entries.

`tests/dashboard-token-destinations.test.mjs` exercises the actual API helper, URL parser, connection handler and project-switching code with fictional tokens and isolated state. Two loopback servers verify that all five redirect statuses are rejected before the redirect target receives a request. These checks do not use real accounts or credentials and do not replace browser UI/vault integration testing. The existing browser CSP also restricts connections to HTTPS; these checks add explicit destination and redirect controls rather than relying only on CSP.

## Source and license

Adapted from UIWCyber/UIW-PMD, supplied by the team. Original MIT license and documentation are retained in `docs/uiw-pmd/`. The timeline, board, activity and analytics views remain available. No credentials are included in the repository.
