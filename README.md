# Gittyper

A keyboard-driven terminal game for learning Git inside a disposable local repository.

## Play

From this repository directory during development:

```bash
npm start
```

After global installation, start it from any Terminal directory with:

```bash
gittyper
```

The product and installation website is a static Vercel app. Build it with `npm run build:web` or preview it locally with `npm run dev:web`.

No browser is required. Gittyper starts a private localhost sandbox, generates a small Atlas codebase under your operating system's temporary directory, and opens the TUI. The workspace is removed when you quit.

## Modes

- **Learn** — guided command lessons with optional hints and character feedback; commands must be typed.
- **Execute** — recall-based, multi-command objectives without autocomplete.
- **Workflow** — realistic dirty-worktree scenarios judged from repository state.
- **Projects** — 68 real-world exercises across eight varied disposable codebases, including JavaScript, TypeScript, Go, Python, Rust, Markdown, and Swift projects.
- **Random** — continuously draws from the complete 100-scenario bank without immediately repeating.

In Random mode, press `Tab` and then `Space` to skip the current draw and immediately load a different challenge.

Use Left/Right to move through and edit the current command line. When the prompt is empty, Left/Right browses modes instead. Ctrl+Up/Down browses drills, and Up/Down recalls commands you entered. `Enter` runs a command, `Ctrl+H` toggles a hint, and `Ctrl+N` chooses another random drill. Shift+Up/Down scrolls the full terminal transcript—even after an objective is complete—with Page Up/Page Down retained as alternate keys.

Press `Ctrl+K` for the complete in-game hotkey reference.

Gittyper opens with a minimal controls page. Press `?` from an empty command line to view it again. Commands, output, and the next prompt flow through one continuous terminal transcript. The game automatically switches between a full-width workspace, a drill-list layout, and a reduced-height layout as the terminal is resized.

Press `Ctrl+U` to customize contrast, color, border characters, and how much help Gittyper provides. Assistance settings control automatic hints, the Learn-mode typing guide, and whether a successful command is confirmed between steps of a multi-command objective. The readable default uses the terminal's own foreground and background colors, so it works with light and dark Terminal profiles. Preferences are saved to `~/.config/gittyper/settings.json`. Your terminal app controls the actual font family and font size.

WPM stops at the moment an objective is achieved, so the result remains fixed while you review or scroll through the transcript.

You can explore with `ls`, `cat`, `pwd`, `git status`, `git diff`, `git log`, and other scenario-safe Git commands. Hints are examples, not exact-answer requirements: Gittyper checks the resulting repository state. Commands are parsed without a shell, paths cannot leave the disposable workspace, network Git operations are blocked, and only an explicit command allowlist is available.

Every exercise runs against an actual temporary Git repository with real commits, branches, indexes, diffs, stashes, and tags. The Projects bank generates realistic local codebases such as Telescope CLI, TrailMap Web, Lantern API, Pocket Notes, Weatherboard, TaskForge, Northstar Docs, and PixelPress. Nothing touches the repository from which Gittyper was launched.

## Create challenges

Challenge definitions live together in [`src/challenges/`](src/challenges/). Add personal or community exercises to [`src/challenges/custom.js`](src/challenges/custom.js), or add a reusable scenario family to the catalog and sandbox. The object schema, safety rules, examples, and test workflow are in [`docs/creating-challenges.md`](docs/creating-challenges.md).

## Verify

```bash
npm test
npm run check
```

## License and forks

Gittyper's source code is licensed under the [GNU General Public License v3.0 only](LICENSE). You may use, study, fork, modify, and redistribute it under that license. Distributed modified versions must remain under GPLv3 and make their corresponding source available.

The source-code license does not grant permission to present a modified version as the official Gittyper app. Forks must clearly identify their changes and follow the [Gittyper brand policy](TRADEMARKS.md).
