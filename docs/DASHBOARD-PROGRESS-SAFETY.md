# Dashboard progress-panel safety

The standalone project dashboard accepts saved/imported JSON as well as provider
responses. The progress panel must not treat those values as HTML or executable
URLs.

- Labels (including issue IDs, titles, and assignees) use DOM `textContent`.
- A clickable issue link requires an absolute HTTPS project URL without embedded
  credentials and a positive safe-integer issue ID. Query strings/fragments are
  removed before adding `/issues/<id>`; GitHub, GitLab subgroup paths, and
  enterprise HTTPS hosts/ports retain their project path.
- Invalid URLs/IDs and HTTP-only destinations remain visible as non-clickable
  text. New tabs use `noopener noreferrer`.
- Counts, the team roadmap exclusion, empty/demo messages, and repeated renders
  retain their previous behavior.

Run `node --test tests/dashboard-progress.test.mjs`. Tests execute the actual
panel functions with an instrumented DOM that rejects HTML parsing, cover hostile
labels and URL schemes, and verify valid URL construction and panel states.
These are focused automated tests, not a complete browser/importer security audit.
Other dashboard renderers, imported-schema validation, and the intentionally
vulnerable classroom exercises are outside this change. No hosting configuration,
live data, tokens, account settings, or lab behavior is changed.
