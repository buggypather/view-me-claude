# Contributing to view-me-claude

Updates are welcome: bug fixes, new features, support for more systems, better wording. Here's how to send one.

1. Fork the repo and make a branch.
2. `npm install`, then make your change in `src/` (TypeScript).
3. `npm test` runs the tests; `npm run build` compiles to `dist/`.
4. Commit `dist/` too, because the Claude Code plugin runs straight from it with no build step on install.
5. Open a pull request saying what it changes and why. Say which system you tested on (Windows, macOS, Linux).

Ground rules:

- **Windows comes first.** Every change has to keep working there (PowerShell and Git Bash). The tests run on Windows, macOS and Linux for every pull request.
- **No extra dependencies** unless there's no reasonable way around them; the plugin should stay small and quick to start.
- A hook must never stop Claude Code from working: catch errors and exit quietly.

Found a bug but can't fix it? Open an issue with your system, Claude Code version and what happened.
