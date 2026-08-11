import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { challengeById } from '../challenges.js'

const SAFE_GIT_COMMANDS = new Set([
  'add', 'branch', 'checkout', 'clean', 'commit', 'diff', 'fetch', 'init', 'log',
  'merge', 'pull', 'push', 'rebase', 'remote', 'restore', 'rev-parse', 'show',
  'stash', 'status', 'switch', 'tag',
])

const READ_COMMANDS = new Set(['ls', 'cat', 'pwd'])
const MAX_OUTPUT = 16_000

export function parseCommandLine(input) {
  const tokens = []
  let token = ''
  let quote = null
  let escaping = false

  for (const character of input.trim()) {
    if (escaping) {
      token += character
      escaping = false
    } else if (character === '\\' && quote !== "'") {
      escaping = true
    } else if (quote) {
      if (character === quote) quote = null
      else token += character
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (/\s/.test(character)) {
      if (token) { tokens.push(token); token = '' }
    } else {
      token += character
    }
  }

  if (escaping || quote) throw new Error('Unclosed quote or escape sequence.')
  if (token) tokens.push(token)
  return tokens
}

function execute(program, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const output = []
    let size = 0
    const collect = (chunk) => {
      if (size >= MAX_OUTPUT) return
      const slice = chunk.subarray(0, MAX_OUTPUT - size)
      output.push(slice)
      size += slice.length
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('error', reject)
    const timeout = setTimeout(() => child.kill('SIGKILL'), options.timeout ?? 5_000)
    child.once('close', (code) => {
      clearTimeout(timeout)
      const text = Buffer.concat(output).toString('utf8').trimEnd()
      resolvePromise({ code: code ?? 1, output: size >= MAX_OUTPUT ? `${text}\n… output truncated …` : text })
    })
  })
}

function isInside(root, target) {
  return target === root || target.startsWith(`${root}${sep}`)
}

function containsTraversal(value) {
  return value.split(/[\\/]/).includes('..') || value.includes('\0')
}

function validateGitArgs(args) {
  const [subcommand, ...rest] = args
  if (!SAFE_GIT_COMMANDS.has(subcommand)) {
    throw new Error(`git ${subcommand ?? ''} is not available in the training sandbox.`)
  }
  if (rest.some((arg) => isAbsolute(arg) || arg.startsWith('~') || arg.includes('=/') || containsTraversal(arg))) {
    throw new Error('Paths must stay inside the training workspace.')
  }

  const joined = rest.join(' ')
  if (subcommand === 'diff' && rest.some((arg) => arg === '--no-index' || arg === '--ext-diff' || arg.startsWith('--output'))) {
    throw new Error('That diff option is disabled in the training sandbox.')
  }
  if (subcommand === 'commit' && rest.some((arg) => /^(-F|--file|--template|--author|--date|--amend|--fixup|--squash|--reuse-message|--edit)/.test(arg))) {
    throw new Error('That commit option is disabled in the training sandbox.')
  }
  if (subcommand === 'init' && rest.length) {
    throw new Error('Change into the target folder before running git init.')
  }
  if (subcommand === 'clean' && rest.some((arg) => !/^-[dfnXx]+$/.test(arg))) {
    throw new Error('Only standard clean dry-run, force, directory, and ignored-file flags are allowed.')
  }
  if (subcommand === 'remote' && rest.length && !['add', '-v', 'get-url'].includes(rest[0])) {
    throw new Error('Only remote add, remote -v, and remote get-url are available here.')
  }
  if (subcommand === 'remote' && rest[0] === 'add' && (rest.length !== 3 || rest[1] !== 'origin' || rest[2] !== 'https://github.com/acme/atlas.git')) {
    throw new Error('This scenario only provides the simulated acme/atlas origin remote.')
  }
  if (['push', 'pull', 'fetch'].includes(subcommand) && /:\/\/|@|file:/.test(joined)) {
    throw new Error('Network URLs are disabled. Use the scenario’s local origin remote.')
  }
}

const defaultProfile = {
  slug: 'atlas',
  label: 'Atlas',
  file: 'src/app.js',
  content: "export function boot() {\n  return 'atlas ready'\n}\n",
}

async function writeCodebase(root, profile = defaultProfile) {
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'docs'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: profile.slug, version: '1.0.0', private: true, scripts: { test: 'node --test' } }, null, 2) + '\n')
  await writeFile(join(root, 'README.md'), `# ${profile.label}\n\nA production-style practice repository generated locally by Gittyper.\n`)
  await writeFile(join(root, '.gitignore'), 'node_modules/\ndist/\ncoverage/\n')
  await writeFile(join(root, 'src/app.js'), "export function boot() {\n  return 'atlas ready'\n}\n")
  await writeFile(join(root, 'src/search.js'), "export function search(notes, query) {\n  return notes.filter((note) => note.includes(query))\n}\n")
  await writeFile(join(root, 'src/nav.js'), "export const links = ['Home', 'Notes']\n")
  await writeFile(join(root, 'src/theme.css'), ':root {\n  color: #20231f;\n  background: #f4f1e8;\n}\n')
  await writeFile(join(root, 'docs/getting-started.md'), '# Getting started\n\nRun `npm start` to launch Atlas.\n')
  await writeFile(join(root, 'config.json'), '{\n  "autosave": true,\n  "theme": "system"\n}\n')
  await writeFile(join(root, 'notes.txt'), 'Search ranking ideas\n')
  if (profile.file && profile.file !== 'src/app.js') {
    await mkdir(dirname(join(root, profile.file)), { recursive: true })
    await writeFile(join(root, profile.file), profile.content)
  }
}

export class SessionSandbox {
  constructor() {
    this.root = null
    this.cwd = null
    this.repo = null
    this.remote = null
    this.challengeId = null
    this.actions = []
    this.prCreated = false
  }

  get gitEnvironment() {
    return {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_ALLOW_PROTOCOL: 'file',
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: '/usr/bin/false',
      GIT_EDITOR: 'true',
      GIT_PAGER: 'cat',
      PAGER: 'cat',
      NO_COLOR: '1',
    }
  }

  async git(args, cwd = this.cwd, allowFailure = false) {
    const result = await execute('git', args, { cwd, env: this.gitEnvironment })
    if (!allowFailure && result.code !== 0) throw new Error(result.output || `git ${args[0]} failed`)
    return result
  }

  async reset(challengeId) {
    await this.close()
    this.root = await mkdtemp(join(tmpdir(), 'gittyper-'))
    this.challengeId = challengeId
    this.actions = []
    this.prCreated = false
    await this.prepare(challengeId)
    return this.snapshot(`Loaded disposable codebase at ${this.displayPath()}`)
  }

  async initBase({ commit = true, profile = defaultProfile } = {}) {
    this.repo = join(this.root, profile.slug)
    this.cwd = this.repo
    await writeCodebase(this.repo, profile)
    await this.git(['init', '-b', 'main'])
    await this.git(['config', 'user.name', 'Gittyper Student'])
    await this.git(['config', 'user.email', 'student@gittyper.local'])
    if (commit) {
      await this.git(['add', '.'])
      await this.git(['commit', '-m', 'Initial codebase'])
    }
  }

  async createRemote() {
    this.remote = join(this.root, 'origin.git')
    await mkdir(this.remote, { recursive: true })
    await this.git(['init', '--bare', '--initial-branch=main'], this.remote)
    await this.git(['remote', 'add', 'origin', this.remote])
    await this.git(['push', '-u', 'origin', 'main'])
  }

  async addRemoteMainCommit(message = 'Remote update') {
    const clone = join(this.root, 'remote-work')
    await this.git(['clone', this.remote, clone], this.root)
    await this.git(['config', 'user.name', 'Atlas Teammate'], clone)
    await this.git(['config', 'user.email', 'teammate@gittyper.local'], clone)
    await writeFile(join(clone, 'README.md'), '# Atlas\n\nA collaborative local-first notes application.\n')
    await this.git(['add', 'README.md'], clone)
    await this.git(['commit', '-m', message], clone)
    await this.git(['push', 'origin', 'main'], clone)
  }

  async prepare(id) {
    const projectScenario = challengeById(id)?.scenario
    if (projectScenario) {
      await this.initBase({ profile: projectScenario.profile })
      const target = join(this.repo, projectScenario.profile.file)
      const extension = projectScenario.profile.file.split('.').pop()
      const change = extension === 'md'
        ? '\n## Operational follow-up\n\nDocument the reviewed production behavior.\n'
        : extension === 'py'
          ? '\n# Follow up on the reviewed production behavior.\n'
          : '\n// Follow up on the reviewed production behavior.\n'
      if (['status', 'diff', 'stage', 'restore', 'commit', 'stash'].includes(projectScenario.kind)) {
        await writeFile(target, `${await readFile(target, 'utf8')}${change}`)
      }
      if (projectScenario.kind === 'commit') await this.git(['add', projectScenario.profile.file])
      return
    }

    if (id === 'new-repo') {
      this.cwd = this.root
      await mkdir(join(this.root, 'field-notes'))
      await mkdir(join(this.root, 'orbit-ui'))
      return
    }

    if (id === 'clone') {
      const seed = join(this.root, 'seed')
      await writeCodebase(seed)
      await this.git(['init', '-b', 'main'], seed)
      await this.git(['config', 'user.name', 'Gittyper'], seed)
      await this.git(['config', 'user.email', 'sandbox@gittyper.local'], seed)
      await this.git(['add', '.'], seed)
      await this.git(['commit', '-m', 'Initial codebase'], seed)
      this.remote = join(this.root, 'acme-atlas.git')
      await this.git(['clone', '--bare', seed, this.remote], this.root)
      await rm(seed, { recursive: true, force: true })
      this.cwd = this.root
      return
    }

    if (id === 'init') {
      this.repo = join(this.root, 'atlas')
      this.cwd = this.repo
      await writeCodebase(this.repo)
      return
    }

    await this.initBase({ commit: id !== 'first-commit' })

    const append = async (file, text) => writeFile(join(this.repo, file), `${await readFile(join(this.repo, file), 'utf8')}${text}`)
    if (['status', 'add', 'commit'].includes(id)) await append('README.md', '\n## Local development\n\nChanges reload automatically.\n')
    if (id === 'commit') await this.git(['add', 'README.md'])
    if (id === 'branch') return
    if (id === 'switch') await this.git(['branch', 'feature/nav'])
    if (id === 'merge') {
      await this.git(['switch', '-c', 'feature/nav'])
      await append('src/nav.js', "export const compact = true\n")
      await this.git(['add', 'src/nav.js'])
      await this.git(['commit', '-m', 'Add compact navigation'])
      await this.git(['switch', 'main'])
    }
    if (['pull', 'push', 'sync-feature', 'publish-pr'].includes(id)) await this.createRemote()
    if (id === 'pull') await this.addRemoteMainCommit('Improve project overview')
    if (id === 'push') {
      await this.git(['switch', '-c', 'feature/nav'])
      await append('src/nav.js', "export const compact = true\n")
      await this.git(['add', 'src/nav.js'])
      await this.git(['commit', '-m', 'Add compact navigation'])
    }
    if (id === 'inspect-change') {
      await append('src/search.js', "\nexport const normalize = (query) => query.trim().toLowerCase()\n")
      await append('notes.txt', 'Try fuzzy matching\n')
    }
    if (id === 'diff-staged') {
      await append('README.md', '\n## Development\n\nRun the test suite before opening a pull request.\n')
      await this.git(['add', 'README.md'])
    }
    if (id === 'restore-file') await append('notes.txt', 'Accidental scratch note\n')
    if (id === 'branch-list') await this.git(['branch', 'feature/nav'])
    if (id === 'undo-stage') {
      await writeFile(join(this.repo, 'config.json'), '{\n  "autosave": true,\n  "theme": "dark"\n}\n')
      await this.git(['add', 'config.json'])
    }
    if (id === 'remote') await this.git(['remote', 'remove', 'origin'], this.cwd, true)
    if (id === 'stash') {
      await append('src/nav.js', "export const settingsLink = 'Settings'\n")
      await writeFile(join(this.repo, 'nav-notes.md'), '# Navigation follow-ups\n')
    }
    if (id === 'rename-branch') await this.git(['switch', '-c', 'scratch'])
    if (id === 'delete-branch') await this.git(['branch', 'feature/old'])
    if (id === 'docs-commit') {
      await this.git(['switch', '-c', 'feature/onboarding'])
      await append('docs/getting-started.md', '\nOpen http://localhost:3000 after starting the app.\n')
      await append('src/app.js', "\nexport const experimentalSidebar = true\n")
    }
    if (id === 'hotfix') {
      await this.git(['switch', '-c', 'feature/profile'])
      await append('src/app.js', "\nexport const profilePreview = true\n")
    }
    if (id === 'sync-feature') {
      await this.addRemoteMainCommit('Refresh README from main')
      await this.git(['switch', '-c', 'feature/filters'])
      await append('src/search.js', "\nexport const filters = ['all', 'pinned']\n")
      await this.git(['add', 'src/search.js'])
      await this.git(['commit', '-m', 'Add note filters'])
    }
    if (id === 'resolve') {
      await this.git(['switch', '-c', 'feature/theme'])
      await writeFile(join(this.repo, 'src/theme.css'), ':root {\n  color: #111;\n  background: #fff;\n}\n')
      await this.git(['add', 'src/theme.css'])
      await this.git(['commit', '-m', 'Use high contrast theme'])
      await this.git(['switch', 'main'])
      await writeFile(join(this.repo, 'src/theme.css'), ':root {\n  color: #20231f;\n  background: #ede9db;\n}\n')
      await this.git(['add', 'src/theme.css'])
      await this.git(['commit', '-m', 'Warm the default theme'])
      await this.git(['merge', 'feature/theme'], this.cwd, true)
      await writeFile(join(this.repo, 'src/theme.css'), ':root {\n  color: #111;\n  background: #ede9db;\n}\n')
    }
    if (id === 'publish-pr') {
      await this.git(['switch', '-c', 'feature/a11y'])
      await append('src/app.js', "\nexport const skipLink = '#main'\n")
      await this.git(['add', 'src/app.js'])
      await this.git(['commit', '-m', 'Add skip navigation link'])
    }
    if (id === 'clean-artifacts') {
      await mkdir(join(this.repo, 'dist'), { recursive: true })
      await mkdir(join(this.repo, 'coverage'), { recursive: true })
      await writeFile(join(this.repo, 'dist/app.js'), 'generated bundle\n')
      await writeFile(join(this.repo, 'coverage/index.html'), 'generated coverage\n')
    }
    if (id === 'selective-cleanup') {
      await append('notes.txt', 'Accidental local note\n')
      await append('src/search.js', '\nexport const caseSensitive = false\n')
    }
    if (id === 'review-commit') {
      await append('README.md', '\n## Local setup\n\nInstall dependencies and run the tests.\n')
      await this.git(['add', 'README.md'])
    }
  }

  safePath(requested = '.') {
    if (isAbsolute(requested) || containsTraversal(requested)) throw new Error('Paths must stay inside the training workspace.')
    const target = resolve(this.cwd, requested)
    if (!isInside(this.root, target)) throw new Error('Paths must stay inside the training workspace.')
    return target
  }

  async run(input) {
    if (input.length > 500) return this.snapshot('Command is too long.', false)
    let tokens
    try { tokens = parseCommandLine(input) } catch (error) { return this.snapshot(error.message, false) }
    if (!tokens.length) return this.snapshot('', true)
    const [program, ...args] = tokens

    try {
      let result
      if (program === 'git') {
        validateGitArgs(args)
        result = await this.git(args, this.cwd, true)
        if (result.code === 0) {
          this.actions.push(`git:${args[0]}`)
          this.actions.push(`git:${args.join(':')}`)
        }
      } else if (program === 'cd') {
        if (args.length !== 1) throw new Error('Usage: cd <directory>')
        const target = this.safePath(args[0])
        if (!(await stat(target)).isDirectory()) throw new Error('Not a directory.')
        this.cwd = target
        result = { code: 0, output: this.displayPath() }
        this.actions.push('cd')
      } else if (program === 'mkdir') {
        if (args.length !== 1) throw new Error('Usage: mkdir <directory>')
        await mkdir(this.safePath(args[0]))
        result = { code: 0, output: '' }
        this.actions.push('mkdir')
      } else if (READ_COMMANDS.has(program)) {
        result = await this.runReadCommand(program, args)
        if (result.code === 0) this.actions.push(program)
      } else if (program === 'gh') {
        result = await this.runGh(args)
      } else {
        throw new Error(`Command not available: ${program}. Try git, gh, ls, cat, pwd, cd, or mkdir.`)
      }

      return this.snapshot(result.output || (result.code === 0 ? 'Command completed successfully.' : 'Command failed.'), result.code === 0)
    } catch (error) {
      return this.snapshot(error.message, false)
    }
  }

  async runReadCommand(program, args) {
    if (program === 'pwd') return { code: args.length ? 1 : 0, output: args.length ? 'pwd takes no arguments.' : this.displayPath() }
    if (program === 'ls') {
      if (args.length > 1) return { code: 1, output: 'Usage: ls [directory]' }
      const entries = await readdir(this.safePath(args[0] ?? '.'), { withFileTypes: true })
      return { code: 0, output: entries.filter((entry) => entry.name !== '.git').map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`).sort().join('  ') }
    }
    if (args.length !== 1) return { code: 1, output: 'Usage: cat <file>' }
    const target = this.safePath(args[0])
    const info = await stat(target)
    if (!info.isFile() || info.size > 64_000) return { code: 1, output: 'Only small workspace files can be displayed.' }
    return { code: 0, output: await readFile(target, 'utf8') }
  }

  async runGh(args) {
    if (args.join(' ') === 'repo clone acme/atlas') {
      if (this.challengeId !== 'clone') return { code: 1, output: 'That training repository is unavailable in this scenario.' }
      const target = join(this.root, 'atlas')
      const result = await this.git(['clone', this.remote, target], this.root, true)
      if (result.code === 0) this.actions.push('gh:clone')
      return result
    }
    if (args[0] === 'pr' && args[1] === 'create' && args.slice(2).every((arg) => ['--fill'].includes(arg))) {
      if (this.challengeId !== 'publish-pr') return { code: 1, output: 'Pull requests are unavailable in this scenario.' }
      this.prCreated = true
      this.actions.push('gh:pr-create')
      return { code: 0, output: 'Created pull request #42\nhttp://localhost/pull/42 (simulated)' }
    }
    return { code: 1, output: 'Supported gh commands: gh repo clone acme/atlas, gh pr create --fill' }
  }

  displayPath() {
    const path = relative(this.root, this.cwd)
    return path ? `~/sandbox/${path}` : '~/sandbox'
  }

  async status() {
    const insideRepo = (await this.git(['rev-parse', '--is-inside-work-tree'], this.cwd, true)).code === 0
    if (!insideRepo) return { branch: null, porcelain: [], cwd: this.displayPath() }
    const branch = (await this.git(['branch', '--show-current'], this.cwd, true)).output || '(detached)'
    const porcelain = (await this.git(['status', '--porcelain'], this.cwd, true)).output.split('\n').filter(Boolean)
    return { branch, porcelain, cwd: this.displayPath() }
  }

  async goal() {
    const id = this.challengeId
    const projectScenario = challengeById(id)?.scenario
    const state = await this.status()
    const action = (name) => this.actions.includes(name)
    const gitOutput = async (args) => (await this.git(args, this.cwd, true)).output
    let complete = false
    let step = 0

    if (projectScenario) {
      const { kind, profile, branch, message, stashMessage, tag } = projectScenario
      const changedFiles = async (args) => (await gitOutput(args)).split('\n').filter(Boolean)
      if (kind === 'status') complete = action('git:status:--short')
      else if (kind === 'diff') complete = action(`git:diff:--:${profile.file}`)
      else if (kind === 'stage') complete = (await changedFiles(['diff', '--cached', '--name-only'])).includes(profile.file)
      else if (kind === 'restore') complete = action(`git:restore:${profile.file}`) && !(await changedFiles(['diff', '--name-only'])).includes(profile.file)
      else if (kind === 'branch') complete = state.branch === branch
      else if (kind === 'commit') complete = (await gitOutput(['log', '-1', '--pretty=%s'])) === message
      else if (kind === 'log') complete = action('git:log:--oneline:-5')
      else if (kind === 'stash') complete = (await gitOutput(['stash', 'list'])).includes(stashMessage) && state.porcelain.length === 0
      else if (kind === 'tag') complete = (await gitOutput(['tag', '--list', tag])) === tag
    } else if (id === 'init') complete = Boolean(state.branch)
    else if (id === 'status') complete = action('git:status')
    else if (id === 'add') complete = state.porcelain.some((line) => /^M\s+README\.md$/.test(line))
    else if (id === 'commit') complete = (await gitOutput(['log', '-1', '--pretty=%s'])) === 'Update README'
    else if (id === 'log') complete = action('git:log')
    else if (id === 'branch') complete = (await gitOutput(['branch', '--list', 'feature/nav'])).includes('feature/nav')
    else if (id === 'switch' || id === 'push') complete = state.branch === 'feature/nav' && (id !== 'push' || action('git:push'))
    else if (id === 'merge') complete = action('git:merge') && (await this.git(['merge-base', '--is-ancestor', 'feature/nav', 'HEAD'], this.cwd, true)).code === 0
    else if (id === 'pull') complete = action('git:pull')
    else if (id === 'diff-staged') complete = action('git:diff:--staged')
    else if (id === 'restore-file') complete = action('git:restore:notes.txt') && !state.porcelain.some((line) => line.endsWith('notes.txt'))
    else if (id === 'branch-list') complete = action('git:branch')
    else if (id === 'new-repo') complete = basename(this.cwd) === 'atlas' && Boolean(state.branch)
    else if (id === 'first-commit') complete = (await gitOutput(['log', '-1', '--pretty=%s'])) === 'Initial snapshot'
    else if (id === 'feature-branch') complete = state.branch === 'feature/search'
    else if (id === 'inspect-change') {
      const searchStaged = state.porcelain.some((line) => /^M\s+src\/search\.js$/.test(line))
      const notesStaged = state.porcelain.some((line) => /^[MADRCU?]\s+notes\.txt$/.test(line))
      complete = action('git:diff') && searchStaged && !notesStaged
      step = action('git:diff') ? 1 : 0
    } else if (id === 'undo-stage') complete = state.porcelain.some((line) => /^\sM config\.json$/.test(line))
    else if (id === 'remote') complete = action('git:remote:-v') && (await gitOutput(['remote', 'get-url', 'origin'])) === 'https://github.com/acme/atlas.git'
    else if (id === 'clone') complete = basename(this.cwd) === 'atlas' && Boolean(state.branch)
    else if (id === 'stash') complete = (await gitOutput(['stash', 'list'])).includes('wip nav') && state.porcelain.length === 0
    else if (id === 'rename-branch') complete = state.branch === 'feature/search'
    else if (id === 'delete-branch') complete = action('git:branch:-d:feature/old') && !(await gitOutput(['branch', '--list', 'feature/old']))
    else if (id === 'show-readme') complete = action('git:show:HEAD:README.md')
    else if (id === 'docs-commit') {
      const message = await gitOutput(['log', '-1', '--pretty=%s'])
      const changed = await gitOutput(['show', '--pretty=', '--name-only', 'HEAD'])
      complete = message === 'Update documentation' && changed.trim() === 'docs/getting-started.md' && state.porcelain.some((line) => line.endsWith('src/app.js'))
      step = state.porcelain.some((line) => /^M\s+docs\/getting-started\.md$/.test(line)) ? 1 : 0
    } else if (id === 'hotfix') {
      complete = state.branch === 'hotfix/login' && Boolean(await gitOutput(['stash', 'list']))
      step = action('git:stash') ? (state.branch === 'main' ? 2 : 1) : 0
    } else if (id === 'sync-feature') {
      complete = action('git:fetch') && action('git:rebase') && state.branch === 'feature/filters'
      step = action('git:fetch') ? 1 : 0
    } else if (id === 'resolve') {
      complete = action('git:commit') && state.porcelain.length === 0 && !(await gitOutput(['rev-parse', '-q', '--verify', 'MERGE_HEAD']))
      step = action('git:add') ? 1 : 0
    } else if (id === 'publish-pr') {
      complete = action('git:push') && this.prCreated
      step = action('git:push') ? 1 : 0
    } else if (id === 'clean-artifacts') {
      const distExists = await stat(join(this.repo, 'dist')).then(() => true, () => false)
      const coverageExists = await stat(join(this.repo, 'coverage')).then(() => true, () => false)
      const dryRun = this.actions.some((entry) => entry.startsWith('git:clean:') && /n/.test(entry))
      complete = dryRun && action('git:clean') && !distExists && !coverageExists
      step = dryRun ? 1 : 0
    } else if (id === 'selective-cleanup') {
      const searchStaged = state.porcelain.some((line) => /^M\s+src\/search\.js$/.test(line))
      const notesChanged = state.porcelain.some((line) => line.endsWith('notes.txt'))
      complete = searchStaged && !notesChanged
      step = action('git:restore:notes.txt') && !notesChanged ? 1 : 0
    } else if (id === 'review-commit') {
      complete = action('git:diff:--staged') && (await gitOutput(['log', '-1', '--pretty=%s'])) === 'Document local setup'
      step = action('git:diff:--staged') ? 1 : 0
    }
    return { complete, step }
  }

  async snapshot(output, ok = true) {
    const state = await this.status()
    const goal = await this.goal()
    return { ok, output, state, ...goal }
  }

  async close() {
    if (!this.root) return
    const target = this.root
    this.root = null
    this.cwd = null
    this.repo = null
    await rm(target, { recursive: true, force: true })
  }
}
