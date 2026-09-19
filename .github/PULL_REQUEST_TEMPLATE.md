Closes #

## Summary
<!-- what changed and why, three lines at most -->

## Design (SOLID)
<!-- new or changed components/services/classes with their single responsibility; abstractions added and why; how the next variant plugs in without editing existing code -->

## Coder self-check
<!-- Tick only what you verified on this head. Scale to the diff: a two-file fix needs the rows it touches, a feature needs them all. Anything ticked here that the tester finds broken is a bug plus a failed round. -->
- [ ] Every acceptance criterion in the issue, one by one
- [ ] 360×800 and 1280×800 (web)
- [ ] `en` and `ar`; RTL layout correct
- [ ] Keyboard-only operation, visible focus, labelled controls
- [ ] Data persists after reload; export/import round-trips (when data changed)
- [ ] Offline load and edit (when storage or routing changed)
- [ ] No console errors
- [ ] Lint, targeted unit tests and the feature's e2e spec green locally; CI green (`scripts/gh/wait-ci.sh`)

## How to test
<!-- steps a tester follows; screenshots at 360 px in en and ar for UI changes -->
