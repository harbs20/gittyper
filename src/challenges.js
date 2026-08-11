export const modes = {
  learn: {
    label: 'Learn',
    short: 'Guided basics',
    description: 'Build muscle memory one command at a time with optional hints and a character guide.',
  },
  execute: {
    label: 'Execute',
    short: 'Recall drills',
    description: 'Translate a plain-English objective into an exact sequence of commands. No autocomplete.',
  },
  workflow: {
    label: 'Workflow',
    short: 'Real scenarios',
    description: 'Read the fake worktree, choose the right operations, and leave the repository in a clean state.',
  },
  projects: {
    label: 'Projects',
    short: 'Real-world repositories',
    description: 'Practice everyday Git work across varied disposable codebases and languages.',
  },
  random: {
    label: 'Random',
    short: 'Mixed command bank',
    description: 'Draw a fresh challenge from the full Gittyper bank after every completion.',
  },
}

export const learnChallenges = [
  {
    id: 'init', title: 'Initialize a repository', prompt: 'Start tracking the current project with Git.',
    commands: ['git init'], explanation: 'Creates a new Git repository in the current folder.',
    tip: 'Git stores its internal data in a hidden .git directory.', effect: 'Initialized empty Git repository in ~/project/.git/',
  },
  {
    id: 'status', title: 'Check repository status', prompt: 'See which files are changed, staged, or untracked.',
    commands: ['git status'], explanation: 'Shows the current state of your working tree and staging area.',
    tip: 'Run this often. It is read-only and safe.', effect: 'On branch main\nChanges not staged for commit: README.md',
  },
  {
    id: 'add', title: 'Stage a file', prompt: 'Prepare README.md for the next commit.',
    commands: ['git add README.md'], explanation: 'Copies the current version of README.md into the staging area.',
    tip: 'Staging lets you choose exactly what belongs in a commit.', effect: 'Staged README.md',
  },
  {
    id: 'commit', title: 'Commit changes', prompt: 'Save the staged snapshot with a concise message.',
    commands: ['git commit -m "Update README"'], explanation: 'Records the staged snapshot in the repository history.',
    tip: 'A commit message explains the intent of the saved change.', effect: '[main 8f14c2a] Update README\n 1 file changed, 4 insertions(+)',
  },
  {
    id: 'log', title: 'View history', prompt: 'Show the compact commit history.',
    commands: ['git log --oneline'], explanation: 'Lists commits with short hashes and one-line messages.',
    tip: '--oneline makes long histories easier to scan.', effect: '8f14c2a Update README\n10d91ac Initial commit',
  },
  {
    id: 'branch', title: 'Create a branch', prompt: 'Create a new branch named feature/nav.',
    commands: ['git branch feature/nav'], explanation: 'Creates a branch pointer without switching to it.',
    tip: 'Branches let work develop independently.', effect: 'Created branch feature/nav',
  },
  {
    id: 'switch', title: 'Switch branches', prompt: 'Move your working copy to feature/nav.',
    commands: ['git switch feature/nav'], explanation: 'Checks out the branch and updates your working tree.',
    tip: 'git switch is the focused modern command for changing branches.', effect: "Switched to branch 'feature/nav'",
  },
  {
    id: 'merge', title: 'Merge a branch', prompt: 'Bring feature/nav into your current branch.',
    commands: ['git merge feature/nav'], explanation: 'Combines the named branch history into the current branch.',
    tip: 'Always check which branch you are on before merging.', effect: 'Updating 8f14c2a..d0e5aa1\nFast-forward',
  },
  {
    id: 'pull', title: 'Pull remote changes', prompt: 'Fetch and integrate updates from origin.',
    commands: ['git pull origin main'], explanation: 'Fetches main from origin and integrates it into your current branch.',
    tip: 'Pull is effectively fetch followed by integration.', effect: 'From github.com:team/project\nAlready up to date.',
  },
  {
    id: 'push', title: 'Push a branch', prompt: 'Publish the current branch and set its upstream.',
    commands: ['git push -u origin feature/nav'], explanation: 'Uploads commits and links your local branch to its remote counterpart.',
    tip: '-u lets future pushes use the shorter git push command.', effect: 'branch feature/nav set up to track origin/feature/nav',
  },
  {
    id: 'diff-staged', title: 'Inspect staged changes', prompt: 'Show only the changes currently prepared for the next commit.',
    commands: ['git diff --staged'], explanation: 'The --staged view compares the index with the current HEAD.',
    tip: 'Review the staged diff before committing.', effect: 'diff --git a/README.md b/README.md',
  },
  {
    id: 'restore-file', title: 'Discard a file edit', prompt: 'Restore notes.txt to its last committed version.',
    commands: ['git restore notes.txt'], explanation: 'Restore replaces the working copy with the version from the index.',
    tip: 'Only use restore when you truly want to discard the local edit.', effect: 'Restored notes.txt',
  },
  {
    id: 'branch-list', title: 'List local branches', prompt: 'Display the repository’s local branches.',
    commands: ['git branch'], explanation: 'The branch command without arguments lists local branch names.',
    tip: 'The current branch is marked with an asterisk.', effect: '* main\n  feature/nav',
  },
]

export const executeChallenges = [
  {
    id: 'new-repo', title: 'Create a fresh project', prompt: 'From the parent directory, create a folder named atlas, enter it, and initialize Git.',
    commands: ['mkdir atlas', 'cd atlas', 'git init'], explanation: 'Directories first, repository second.',
    tip: 'Each command runs only inside this simulated terminal.', initial: ['~/projects  $ ls', 'field-notes  orbit-ui'],
  },
  {
    id: 'first-commit', title: 'Save the first snapshot', prompt: 'Stage every current change, then commit with the message “Initial snapshot”.',
    commands: ['git add .', 'git commit -m "Initial snapshot"'], explanation: 'A commit only includes changes already in the staging area.',
    tip: 'The period means everything under the current directory.', initial: ['modified: src/app.js', 'untracked: README.md'],
  },
  {
    id: 'feature-branch', title: 'Start isolated work', prompt: 'Create and immediately switch to a branch named feature/search.',
    commands: ['git switch -c feature/search'], explanation: 'The -c flag creates the branch before switching to it.',
    tip: 'One command can replace git branch followed by git switch.', initial: ['On branch main', 'working tree clean'],
  },
  {
    id: 'inspect-change', title: 'Inspect before staging', prompt: 'Display the unstaged line changes, then stage only src/search.js.',
    commands: ['git diff', 'git add src/search.js'], explanation: 'Reviewing the diff before staging prevents accidental commits.',
    tip: 'Be precise: the task asks for one file, not all changes.', initial: ['modified: src/search.js', 'modified: notes.txt'],
  },
  {
    id: 'undo-stage', title: 'Unstage a file safely', prompt: 'Remove config.json from the staging area without discarding its edits.',
    commands: ['git restore --staged config.json'], explanation: 'This changes the index while preserving the working-tree file.',
    tip: 'Omitting --staged would affect the working copy instead.', initial: ['Changes to be committed:', '  modified: config.json'],
  },
  {
    id: 'remote', title: 'Connect a remote', prompt: 'Add https://github.com/acme/atlas.git as origin, then list all remotes with their URLs.',
    commands: ['git remote add origin https://github.com/acme/atlas.git', 'git remote -v'], explanation: 'A remote is a named reference to another repository.',
    tip: 'origin is conventional, but it is just a name.', initial: ['No remotes configured'],
  },
  {
    id: 'clone', title: 'Clone a repository', prompt: 'Clone acme/atlas with GitHub CLI, then enter the new atlas directory.',
    commands: ['gh repo clone acme/atlas', 'cd atlas'], explanation: 'GitHub CLI resolves the repository and configures the origin remote.',
    tip: 'gh is useful when you already authenticate with GitHub CLI.', initial: ['~/projects  $'],
  },
  {
    id: 'stash', title: 'Pause unfinished work', prompt: 'Stash tracked and untracked changes with the message “wip nav”.',
    commands: ['git stash push -u -m "wip nav"'], explanation: 'The stash temporarily shelves changes; -u includes untracked files.',
    tip: 'A descriptive stash message is easier to find later.', initial: ['modified: src/nav.js', 'untracked: nav-notes.md'],
  },
  {
    id: 'rename-branch', title: 'Rename the current branch', prompt: 'Rename the current branch to feature/search.',
    commands: ['git branch -m feature/search'], explanation: 'The -m option moves the current branch name.',
    tip: 'Renaming locally does not automatically rename a published remote branch.', initial: ['On branch scratch', 'working tree clean'],
  },
  {
    id: 'delete-branch', title: 'Remove a merged branch', prompt: 'Delete the already-merged local branch feature/old.',
    commands: ['git branch -d feature/old'], explanation: 'Lowercase -d protects branches with unmerged commits.',
    tip: 'Prefer -d over force deletion when cleanup is routine.', initial: ['On branch main', 'feature/old is fully merged'],
  },
  {
    id: 'show-readme', title: 'Read a file from HEAD', prompt: 'Print the committed README.md directly from HEAD.',
    commands: ['git show HEAD:README.md'], explanation: 'git show can read a path exactly as it existed in a commit.',
    tip: 'The colon separates a revision from a repository path.', initial: ['On branch main', 'working tree clean'],
  },
]

export const workflowChallenges = [
  {
    id: 'docs-commit', title: 'Ship only the documentation',
    prompt: 'Stage only the documentation change and commit it with the message “Update documentation”. Leave the unfinished app change alone.',
    commands: ['git add docs/getting-started.md', 'git commit -m "Update documentation"'],
    explanation: 'Path-specific staging keeps unrelated work out of the commit.', tip: 'A clean commit tells one story.',
    initial: ['On branch feature/onboarding', 'modified: docs/getting-started.md', 'modified: src/app.js', 'nothing staged'],
    states: [['staged: docs/getting-started.md', 'modified: src/app.js'], ['2a41bc7 Update documentation', 'modified: src/app.js', 'staging area clean']],
  },
  {
    id: 'hotfix', title: 'Prepare an urgent hotfix',
    prompt: 'Stash the current tracked work, switch to main, then create and switch to hotfix/login.',
    commands: ['git stash push -m "wip"', 'git switch main', 'git switch -c hotfix/login'],
    explanation: 'Shelving unfinished work makes it safe to change context.', tip: 'Stash before switching when changes should not follow you.',
    initial: ['On branch feature/profile', 'modified: src/profile.js', 'Your branch is ahead by 1 commit'],
    states: [['Saved working directory: wip', 'working tree clean'], ['On branch main', 'working tree clean'], ['On branch hotfix/login', 'working tree clean']],
  },
  {
    id: 'sync-feature', title: 'Update a feature branch',
    prompt: 'Fetch the remote, then rebase the current feature branch onto origin/main.',
    commands: ['git fetch origin', 'git rebase origin/main'],
    explanation: 'Fetching updates remote-tracking refs; rebasing replays your work on the new base.', tip: 'Fetch first so origin/main is current.',
    initial: ['On branch feature/filters', 'Your branch is 3 commits ahead of origin/feature/filters', 'origin/main may be stale'],
    states: [['Fetched origin/main at b7c22da'], ['Successfully rebased feature/filters onto origin/main', 'working tree clean']],
  },
  {
    id: 'resolve', title: 'Finish a resolved merge',
    prompt: 'The conflict markers in src/theme.css have already been fixed. Stage that resolution and continue the merge commit.',
    commands: ['git add src/theme.css', 'git commit'],
    explanation: 'Staging a resolved file tells Git its conflict is settled.', tip: 'A merge commit is prepared automatically after all conflicts are staged.',
    initial: ['On branch main', 'You have unmerged paths', 'both modified: src/theme.css'],
    states: [['All conflicts fixed but you are still merging'], ['Merge made by the ort strategy', 'working tree clean']],
  },
  {
    id: 'publish-pr', title: 'Publish and open a pull request',
    prompt: 'Push the current branch while setting its upstream, then open a pull request with GitHub CLI.',
    commands: ['git push -u origin feature/a11y', 'gh pr create --fill'],
    explanation: 'Publishing the branch gives the pull request a remote source.', tip: '--fill uses commit text for the PR title and body.',
    initial: ['On branch feature/a11y', 'Your branch has no upstream branch', 'working tree clean'],
    states: [['branch feature/a11y set up to track origin/feature/a11y'], ['Created pull request #42', 'https://github.com/acme/atlas/pull/42']],
  },
  {
    id: 'clean-artifacts', title: 'Clean generated artifacts',
    prompt: 'Remove only ignored build files and directories, using a dry run first so you can inspect the target list.',
    commands: ['git clean -ndX', 'git clean -fdX'],
    explanation: '-X limits clean to ignored files; the dry run protects against surprises.', tip: 'Use -n before any destructive clean command.',
    initial: ['Ignored: dist/', 'Ignored: coverage/', 'Tracked files are clean'],
    states: [['Would remove dist/', 'Would remove coverage/'], ['Removed dist/', 'Removed coverage/', 'working tree clean']],
  },
  {
    id: 'selective-cleanup', title: 'Keep only the intended edit',
    prompt: 'Discard the accidental notes.txt edit, then stage only src/search.js.',
    commands: ['git restore notes.txt', 'git add src/search.js'],
    explanation: 'Restore unwanted work first, then stage the change that belongs.', tip: 'A focused index makes the next commit easier to review.',
    initial: ['modified: notes.txt', 'modified: src/search.js', 'nothing staged'],
    states: [['modified: src/search.js', 'notes.txt restored'], ['staged: src/search.js', 'working tree otherwise clean']],
  },
  {
    id: 'review-commit', title: 'Review and commit staged work',
    prompt: 'Review the staged patch, then commit it with the message “Document local setup”.',
    commands: ['git diff --staged', 'git commit -m "Document local setup"'],
    explanation: 'A final staged review catches mistakes before the snapshot becomes history.', tip: 'Reviewing the index is a strong pre-commit habit.',
    initial: ['modified and staged: README.md', 'working tree otherwise clean'],
    states: [['staged patch reviewed'], ['Document local setup', 'working tree clean']],
  },
]

export const projectProfiles = [
  { slug: 'telescope-cli', label: 'Telescope CLI', file: 'src/parser.js', area: 'argument parser', content: "export function parseArgs(argv) {\n  return { command: argv[0] ?? 'help', flags: argv.slice(1) }\n}\n" },
  { slug: 'trailmap-web', label: 'TrailMap Web', file: 'src/routes.ts', area: 'route table', content: "export const routes = [\n  { path: '/', view: 'Map' },\n  { path: '/trails', view: 'Trails' },\n]\n" },
  { slug: 'lantern-api', label: 'Lantern API', file: 'cmd/server.go', area: 'HTTP server', content: "package main\n\nfunc healthStatus() string {\n\treturn \"ok\"\n}\n" },
  { slug: 'pocket-notes', label: 'Pocket Notes', file: 'lib/storage.py', area: 'storage adapter', content: "def save_note(notes, note):\n    return [*notes, note]\n" },
  { slug: 'weatherboard', label: 'Weatherboard', file: 'src/forecast.ts', area: 'forecast model', content: "export type Forecast = {\n  high: number\n  low: number\n  summary: string\n}\n" },
  { slug: 'taskforge', label: 'TaskForge', file: 'src/runner.rs', area: 'task runner', content: "pub fn run_task(name: &str) -> String {\n    format!(\"running {name}\")\n}\n" },
  { slug: 'northstar-docs', label: 'Northstar Docs', file: 'docs/deployment.md', area: 'deployment guide', content: "# Deployment\n\nBuild the static site, validate links, and publish the generated directory.\n" },
  { slug: 'pixelpress', label: 'PixelPress', file: 'Sources/ImagePipeline.swift', area: 'image pipeline', content: "struct ImagePipeline {\n    func process(_ name: String) -> String {\n        return \"processed: \\(name)\"\n    }\n}\n" },
]

const projectChallengeFamilies = [
  {
    kind: 'status', title: 'Triage a teammate’s edit',
    prompt: ({ label, file }) => `${label} has an unexpected edit in ${file}. Show the concise working-tree status before touching it.`,
    commands: () => ['git status --short'], explanation: 'A concise status is the safest first step when entering an unfamiliar repository.',
  },
  {
    kind: 'diff', title: 'Review a focused patch',
    prompt: ({ label, file }) => `Review the unstaged patch to ${file} in ${label} without including unrelated paths.`,
    commands: ({ file }) => [`git diff -- ${file}`], explanation: 'A path-limited diff keeps review focused on the file in question.',
  },
  {
    kind: 'stage', title: 'Stage the intended fix',
    prompt: ({ label, file }) => `The ${label} fix in ${file} is ready. Stage only that file.`,
    commands: ({ file }) => [`git add ${file}`], explanation: 'Path-specific staging prevents unrelated edits from entering the next commit.',
  },
  {
    kind: 'restore', title: 'Discard an accidental edit',
    prompt: ({ label, file }) => `An accidental local edit landed in ${label}’s ${file}. Restore its committed contents.`,
    commands: ({ file }) => [`git restore ${file}`], explanation: 'Restore discards the selected working-tree change while leaving other files alone.',
  },
  {
    kind: 'branch', title: 'Start isolated feature work',
    prompt: ({ label, branch }) => `Create and switch to ${branch} before beginning the next ${label} change.`,
    commands: ({ branch }) => [`git switch -c ${branch}`], explanation: 'Starting on a focused branch keeps unfinished work away from main.',
  },
  {
    kind: 'commit', title: 'Record a reviewed change',
    prompt: ({ label, file, message }) => `${file} is already staged in ${label}. Commit it with the message “${message}”.`,
    commands: ({ message }) => [`git commit -m "${message}"`], explanation: 'A specific commit message records why this focused snapshot exists.',
  },
  {
    kind: 'log', title: 'Inspect recent project history',
    prompt: ({ label }) => `Show the five most recent ${label} commits in compact one-line form.`,
    commands: () => ['git log --oneline -5'], explanation: 'A short one-line log gives fast context without flooding the terminal.',
  },
  {
    kind: 'stash', title: 'Shelve interrupted work',
    prompt: ({ label, stashMessage }) => `Pause the current ${label} edit and stash it with the message “${stashMessage}”.`,
    commands: ({ stashMessage }) => [`git stash push -m "${stashMessage}"`], explanation: 'A named stash preserves interrupted work and makes it recognizable later.',
  },
]

export const projectChallenges = projectProfiles.flatMap((profile) => {
  const context = {
    ...profile,
    branch: `feature/${profile.slug.replace(/-(cli|web|api|docs)$/, '')}-improvements`,
    message: `Update ${profile.area}`,
    stashMessage: `wip ${profile.area}`,
  }
  return projectChallengeFamilies.map((family) => ({
    id: `project-${profile.slug}-${family.kind}`,
    title: `${family.title} / ${profile.label}`,
    prompt: family.prompt(context),
    commands: family.commands(context),
    explanation: family.explanation,
    tip: `This exercise runs inside a real temporary ${profile.label} Git repository.`,
    scenario: { kind: family.kind, profile, ...context },
  }))
})

const releaseProjectChallenges = projectProfiles.slice(0, 4).map((profile) => ({
  id: `project-${profile.slug}-tag`,
  title: `Tag a release / ${profile.label}`,
  prompt: `Create the annotated tag v1.1.0 for ${profile.label} with the message “Release v1.1.0”.`,
  commands: ['git tag -a v1.1.0 -m "Release v1.1.0"'],
  explanation: 'An annotated tag records a named release with durable metadata and a message.',
  tip: `This release tag exists only inside the disposable ${profile.label} repository.`,
  scenario: { kind: 'tag', profile, tag: 'v1.1.0' },
}))

projectChallenges.push(...releaseProjectChallenges)

export const randomChallenges = [
  ...learnChallenges.map((challenge) => ({ ...challenge, sourceMode: 'learn' })),
  ...executeChallenges.map((challenge) => ({ ...challenge, sourceMode: 'execute' })),
  ...workflowChallenges.map((challenge) => ({ ...challenge, sourceMode: 'workflow' })),
  ...projectChallenges.map((challenge) => ({ ...challenge, sourceMode: 'projects' })),
]

export const challengeSets = {
  learn: learnChallenges,
  execute: executeChallenges,
  workflow: workflowChallenges,
  projects: projectChallenges,
  random: randomChallenges,
}

const challengeIndex = new Map(randomChallenges.map((challenge) => [challenge.id, challenge]))

export function challengeById(id) {
  return challengeIndex.get(id)
}

export function sampleChallenge(mode, previousId) {
  const options = challengeSets[mode].filter((item) => item.id !== previousId)
  return options[Math.floor(Math.random() * options.length)] ?? challengeSets[mode][0]
}
