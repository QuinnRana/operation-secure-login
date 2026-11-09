# Browser response protections

Related roadmap work: #1 and #11. `next.config.ts` applies these headers to application routes:

- `Content-Security-Policy: base-uri 'self'; form-action 'self'; object-src 'none'` limits form submissions and document base URLs to the page's own origin and disallows embedded plugin objects. This adds browser-side defense against markup that attempts to redirect credentials through an external form or base URL.
- `X-Content-Type-Options: nosniff` tells browsers to honor the declared content type rather than guessing a different executable type.
- `Referrer-Policy: no-referrer` prevents sending the current page URL in the Referer header when following links or loading resources.

The same headers apply to the secure login, vulnerable Attack Lab and defended lab. They do not change SQL, password handling, database bindings or the fictional classroom payload. The normal form actions post to the same origin. No live hosting settings or databases are changed by this feature branch.

## Scope and limits

This is a small CSP, not a complete XSS defense. It does not set `script-src`, `style-src`, `connect-src` or `default-src`; it therefore does not claim to stop arbitrary script execution or all data exfiltration. It leaves frame embedding unchanged, including existing site previews. It is not a CSRF control, a request-body limit, a session system or a substitute for SQL parameters and server-side validation. HTTPS/HSTS and upstream hosting policies remain separate operator concerns.

A future feature that legitimately submits a form to a different origin would need an explicit policy review. A host can add a separate CSP; browsers enforce all policies together. Verify the deployed response separately before claiming live coverage. Static JS/CSS assets are served separately by the hosting asset handler and are not claimed to receive these route headers. The automated checks verify headers, asset MIME types and server behavior, not browser CSP enforcement, hydrated form submissions or embedded preview behavior. Framework redirects and early error paths are not comprehensively covered.

## Reproduce locally

With Node 22.13+ and locked dependencies:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:headers
```

The final command loads the actual production-built Worker into Miniflare. It uses fresh disposable local D1 fixtures, never the hosting database or an existing local lab. The test checks:

- GET and HEAD responses on all three pages, plus a missing-route 404;
- referenced JavaScript and CSS are served successfully with the correct MIME types through the production-style static asset handler;
- actual rendered server-action references and same-origin POSTs, including successful and failed secure logins;
- successful defended login and rejection of the original injection payload;
- the intentionally vulnerable payload still bypassing the Attack Lab with three seed records;
- unavailable lab submissions with production-style missing `LAB_DB`, without initializing secure database tables.

Both new tests fail on the unchanged development build because the CSP is absent. The pinned vinext wildcard header route does not match `/`, so the configuration explicitly includes the root path; the HTTP test catches that gap. GitHub Actions runs `pnpm test:headers` after its production build so merely editing the configuration without effective HTTP coverage cannot pass.

## Pending feature compatibility

The separate `codex/bound-login-request-bodies` feature also edits `next.config.ts`, package scripts and the CI workflow. When reviewing those features together, keep both `headers()` and `experimental.serverActions.bodySizeLimit`, retain both HTTP test scripts and run both checks after building. This branch starts from development and does not claim the unmerged body-size control is already present.
