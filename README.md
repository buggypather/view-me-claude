# view-me-claude

A small panel for VS Code that sits beside Claude Code. It shows, live:

- **Phones**: everything `adb devices` sees, with the model name and whether it's ready or unauthorized
- **Claude agents**: running Claude Code sessions (terminal, VS Code extension, background agents)
- **Builds**: running Gradle, Vite, npm build, `npx cap`, tsc and Cargo builds, and how long each has been going
- **Usage**: how much of your 5-hour session and weekly limit you've used, and when each resets (needs the status-line helper below)
- **Servers from agents**: anything listening on a port that a Claude session started (dev servers, emulators' helpers, etc.), with its port
- **Retired agents** (collapsed): sessions from the last 3 days that have gone quiet for 15+ minutes, with a `claude --resume <id>` line to bring one back

It's written for slow computers. It's plain JavaScript with no dependencies and no build step, and it checks only while the panel is visible (every 10 seconds by default). When the panel is closed, it does nothing.

## Install

1. Download the source (Code → Download ZIP) or `git clone https://github.com/buggypather/view-me-claude`.
2. Copy the folder into your extensions folder:
   - Windows: `%USERPROFILE%\.vscode\extensions\view-me-claude`
   - macOS / Linux: `~/.vscode/extensions/view-me-claude`
3. Restart VS Code.

You can also package it with `npx @vscode/vsce package` and install the `.vsix` with **Extensions → … → Install from VSIX**.

## Using it

- Click **📱 View** in the status bar (bottom right), or the phone icon at the top right of an editor, to open or close the panel.
- To put it beside Claude's chat, drag the panel's icon from the left bar into the right-hand (secondary) side bar. VS Code remembers where you put it.
- Settings:
  - `viewMeClaude.intervalSeconds` sets how often it checks. Raise it to 20 or 30 on a slow PC.
  - `viewMeClaude.adbPath` sets where adb is, if it isn't found on its own. By default it looks in `%LOCALAPPDATA%\Android\Sdk\platform-tools`, then `ANDROID_HOME`, then PATH.

## Usage percentages (status-line helper)

Claude Code passes your plan usage to its status line. This helper saves it for the panel, and shows `5h 42% · week 18%` under the chat box too. Add this to `%USERPROFILE%\.claude\settings.json` (macOS/Linux: `~/.claude/settings.json`), with the folder you installed to:

```json
"statusLine": { "type": "command", "command": "node \"C:/Users/you/.vscode/extensions/view-me-claude/statusline.js\"" }
```

If you already have a status line, set the environment variable `VIEW_ME_CLAUDE_NEXT` to its command. The helper will still save usage, then show your own line. Usage updates whenever a Claude Code session redraws. If your Claude Code version doesn't send usage yet, the panel says "not known yet"; update Claude Code to fix that.

## Why not a button next to "Learn Claude Code"?

That button belongs to the Claude Code extension, and VS Code doesn't let one extension add buttons to another's panel. The status-bar and editor-title buttons are the nearest places. In the Claude Desktop app, Claude Code supports mods that can add a panel and button inside Claude itself, and a mod version of this would be welcome as a contribution.

## Contributing

Ideas for more build tools, other bridges, or iOS devices (`xcrun devicectl`) are welcome. Run `npm test` (plain Node, no install needed). MIT licensed.
