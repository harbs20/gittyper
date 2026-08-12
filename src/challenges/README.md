# Challenge bank

- `catalog.js` contains Gittyper's built-in Learn, Execute, Workflow, Projects, and Random banks.
- `custom.js` is the small, merge-friendly extension point for community-authored project challenges.
- `../challenges.js` remains the stable import path used by the rest of the app.

Read [`../../docs/creating-challenges.md`](../../docs/creating-challenges.md) before adding a challenge. A project challenge needs both a definition here and a safe disposable-repository scenario in `../sandbox/repository.js` unless it reuses an existing scenario kind.
