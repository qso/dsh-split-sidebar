# Contributing to DSH Split Sidebar

Use Node.js 22.19 or later. Install with `npm ci --ignore-scripts` and run `npm test`. Check distributable files with `npm pack --dry-run`.

Keep changes scoped and include a minimal reproduction for a bug. For UI changes, check the interaction in DSH Desktop and include the tested DSH version. Use synthetic files in fixtures. Remove access tokens, local account names, absolute workspace paths, private media and conversation content from reports.

The four Powerline separator outlines are generated from the geometry in `scripts/build-separators.py`. To rebuild the bundled WOFF2, run `python3 scripts/build-separators.py` in an environment with fonttools and brotli. The plugin uses the checked-in asset at runtime.
