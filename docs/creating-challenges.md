# Creating Gittyper challenges

Gittyper challenges are data-backed exercises evaluated against a real repository created in the operating system's temporary directory. The displayed commands are a reference path, while completion is determined from repository state and observed safe commands. This lets a learner solve an objective with an equivalent valid Git command when the objective allows it.

## Where challenges live

| File | Purpose |
| --- | --- |
| `src/challenges/catalog.js` | Built-in challenge banks, project profiles, and reusable project scenario families |
| `src/challenges/custom.js` | Merge-friendly list for new project challenges |
| `src/challenges.js` | Stable public re-export; application code should import this path |
| `src/sandbox/repository.js` | Disposable repository setup, safe command execution, and semantic completion rules |

## Challenge shape

Every challenge has these fields:

```js
{
  id: 'project-telescope-cli-review-stage-commit',
  title: 'Review, stage, and commit a fix / Telescope CLI',
  prompt: 'Review the unstaged src/commands/search.ts fix, stage it, then commit it.',
  commands: [
    'git diff -- src/commands/search.ts',
    'git add src/commands/search.ts',
    'git commit -m "Update command discovery"',
  ],
  explanation: 'Reviewing before staging creates a deliberate snapshot.',
  tip: 'This exercise runs inside a real temporary Git repository.',
  scenario: {
    kind: 'review-stage-commit',
    profile: {
      slug: 'telescope-cli',
      label: 'Telescope CLI',
      area: 'command discovery',
      file: 'src/commands/search.ts',
      content: 'export const searchCommands = () => []\n',
    },
    branch: 'feature/telescope-improvements',
    message: 'Update command discovery',
    stashMessage: 'wip command discovery',
    tag: 'v1.9.0',
  },
}
```

- `id` must be unique and stable because progress and sandbox selection refer to it.
- `commands` must be a safe reference solution in the intended order. Random mode also uses this sequence to avoid immediately repeating an equivalent answer.
- `scenario.kind` selects the repository seed and completion rule.
- `profile.slug` becomes the disposable folder name. `profile.file` must stay inside that folder and `profile.content` supplies its initial contents.
- Prompts should describe an outcome and its constraints, not merely repeat the commands.

## Add a challenge with an existing scenario

The easiest contribution reuses a scenario kind that the sandbox already understands. Add an object to `customChallenges`:

```js
export const customChallenges = [
  {
    id: 'project-river-api-review-stage-commit',
    title: 'Review and ship a parser fix / River API',
    prompt: 'Review the parser edit, stage only it, and commit it as “Fix event parsing”.',
    commands: [
      'git diff -- src/parser.js',
      'git add src/parser.js',
      'git commit -m "Fix event parsing"',
    ],
    explanation: 'A review-first commit keeps the snapshot focused.',
    tip: 'The River API repository is disposable.',
    scenario: {
      kind: 'review-stage-commit',
      profile: {
        slug: 'river-api',
        label: 'River API',
        area: 'event parsing',
        file: 'src/parser.js',
        content: 'export const parseEvent = (value) => value\n',
      },
      branch: 'feature/parser-fix',
      message: 'Fix event parsing',
      stashMessage: 'wip event parsing',
      tag: 'v1.1.0',
    },
  },
]
```

Useful multi-step kinds include `review-stage-commit`, `discard-stage-commit`, `branch-stage-commit`, `fetch-review-rebase`, `merge-cleanup`, `tag-publish`, `resume-stash`, and `review-publish`. The built-in catalog shows the expected prompt and command shape for each one.

## Add a new scenario kind

A genuinely different repository problem needs three coordinated pieces:

1. Add the challenge or reusable family in `src/challenges/catalog.js`.
2. In `SessionSandbox.prepare()` in `src/sandbox/repository.js`, create the starting Git state: edits, staging, branches, stashes, tags, or a local bare `origin`.
3. In `SessionSandbox.goal()`, verify the result semantically. Check the final branch, index, worktree, history, or simulated remote as appropriate; use action history only when the learner must explicitly inspect or run a command.

Do not run a shell, contact the network, reference the contributor's real repository, or allow paths outside the generated temporary workspace. If a scenario needs a Git subcommand that is not in `SAFE_GIT_COMMANDS`, consider its security implications and add focused validation before enabling it.

## Writing good workflows

- Present a concrete problem with a reason for each step.
- Vary the Git state and desired outcome, not just project names or commit messages.
- Prefer two to four meaningful commands for a multi-step workflow.
- Keep unrelated dirty files when the lesson is selective staging or cleanup.
- Treat hints as one valid route; accept equivalent safe solutions when practical.
- Keep all remotes local and disposable.

## Verify a contribution

From the repository directory, run:

```bash
npm test
npm run check
npm run build:web
```

The exhaustive sandbox test executes every challenge's reference commands and requires the semantic objective to complete. The diversity test also guards against shrinking Projects into repeated solutions. Try the exercise interactively with `npm start` before opening a pull request.
