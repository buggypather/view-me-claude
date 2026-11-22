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

- **VS Code:** Extensions panel → search **View Me Claude** → Install. Or from the
  [Marketplace page](https://marketplace.visualstudio.com/items?itemName=buggypather.view-me-claude).
- **VSCodium, Cursor and other editors using Open VSX:** search **View Me Claude** in their
  Extensions panel, or see [Open VSX](https://open-vsx.org/extension/buggypather/view-me-claude).
- **From a file:** download the `.vsix` from the
  [latest release](https://github.com/buggypather/view-me-claude/releases/latest), then
  Extensions → **…** → **Install from VSIX**.

## Using it

- Click **📱 View** in the status bar (bottom right), or the phone icon at the top right of an editor, to open or close the panel.
- To put it beside Claude's chat, drag the panel's icon from the left bar into the right-hand (secondary) side bar. VS Code remembers where you put it.
- Settings:
  - `viewMeClaude.intervalSeconds` sets how often it checks. Raise it to 20 or 30 on a slow PC.
  - `viewMeClaude.adbPath` sets where adb is, if it isn't found on its own. By default it looks in `%LOCALAPPDATA%\Android\Sdk\platform-tools`, then `ANDROID_HOME`, then PATH.

## Usage percentages

Claude Code passes your plan usage to its status line. View Me Claude has a small helper that saves
it for the panel and shows `5h 42% · week 18%` under Claude's chat box.

To turn it on, click **Turn on usage percentages** in the panel's Usage section (or run
**View Me Claude: Turn on usage percentages** from the Command Palette). It asks first, then adds
the status line to `~/.claude/settings.json` (keeping a backup beside it). If you already have a
status line, it keeps yours: it puts your command in `VIEW_ME_CLAUDE_NEXT`, saves usage, and then
shows your own line.

The helper is kept in `~/.view-me-claude/statusline.js`, so it keeps working when the extension
updates. Usage updates whenever a Claude Code session redraws. If your Claude Code version doesn't
send usage yet, the panel says "not known yet"; updating Claude Code fixes that.

To set it up by hand instead, add this to `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "node \"C:/Users/you/.view-me-claude/statusline.js\"" }
```

## Why not a button next to "Learn Claude Code"?

That button belongs to the Claude Code extension, and VS Code doesn't let one extension add buttons to another's panel. The status-bar and editor-title buttons are the nearest places. In the Claude Desktop app, Claude Code supports mods that can add a panel and button inside Claude itself, and a mod version of this would be welcome as a contribution.

## Contributing

Ideas for more build tools, other bridges, or iOS devices (`xcrun devicectl`) are welcome. Run `npm test` (plain Node, no install needed) and `npm run package` to make a `.vsix`. Releases: see RELEASING.md. MIT licensed.
