import test from 'node:test'
import assert from 'node:assert/strict'
import { compareCommand, createSession, sessionStats } from '../src/engine.js'
import { challengeSets, executeChallenges, learnChallenges, sampleChallenge } from '../src/challenges.js'
import { GittyperTui, stripAnsi, tokenizeKeys } from '../src/tui.js'

test('character comparison supports Learn mode guidance', () => {
  assert.deepEqual(compareCommand('git init', 'git init'), {
    correct: true, errors: 0, firstError: -1, accuracy: 100,
  })
  const mismatch = compareCommand('git status', 'git stats')
  assert.equal(mismatch.correct, false)
  assert.equal(mismatch.firstError, 8)
})

test('session stats measure entered commands', () => {
  const challenge = learnChallenges.find((item) => item.id === 'status')
  const session = { ...createSession('learn', challenge), typed: 25, errors: 2, startedAt: 1_000 }
  const stats = sessionStats(session, 61_000)
  assert.equal(stats.wpm, 5)
  assert.equal(stats.accuracy, 92)
})

test('session stats freeze at objective completion', () => {
  const challenge = learnChallenges.find((item) => item.id === 'status')
  const session = {
    ...createSession('learn', challenge),
    typed: 25,
    startedAt: 1_000,
    completedAt: 61_000,
  }
  assert.deepEqual(sessionStats(session, 61_000), sessionStats(session, 601_000))
  assert.equal(sessionStats(session, 601_000).wpm, 5)
})

test('the TUI snapshots final stats when the sandbox reports completion', async () => {
  const challenge = learnChallenges.find((item) => item.id === 'status')
  const sandbox = {
    url: 'http://127.0.0.1:7331',
    async command() {
      return {
        ok: true,
        complete: true,
        step: 0,
        output: 'On branch main',
        state: { cwd: '~/sandbox/atlas', branch: 'main', porcelain: [] },
      }
    },
  }
  const tui = new GittyperTui({}, { write() {} }, { sandbox })
  tui.session = createSession('learn', challenge)
  tui.session.startedAt = Date.now() - 60_000
  tui.session.input = 'git status'
  await tui.executeInput()

  assert.equal(tui.session.complete, true)
  assert.ok(tui.session.completedAt)
  assert.deepEqual(tui.session.finalStats, sessionStats(tui.session, tui.session.completedAt + 600_000))
})

test('terminal input chunks preserve arrows, pages, and regular keys', () => {
  assert.deepEqual(tokenizeKeys('\t\r'), ['\t', '\r'])
  assert.deepEqual(tokenizeKeys('\u001b[Cgit'), ['\u001b[C', 'g', 'i', 't'])
  assert.deepEqual(tokenizeKeys('\u001b[5~'), ['\u001b[5~'])
  assert.deepEqual(tokenizeKeys('\u001b[1;2A'), ['\u001b[1;2A'])
  assert.deepEqual(tokenizeKeys('\u001b[1;5B'), ['\u001b[1;5B'])
})

test('instructions and game layouts stay within live terminal dimensions', () => {
  const sizes = [
    [36, 10], [48, 16], [80, 24], [108, 28], [140, 40], [200, 50],
  ]

  for (const [columns, rows] of sizes) {
    const output = {
      columns, rows, last: '',
      write(value) { this.last = value },
    }
    const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
    tui.running = true

    for (const view of ['instructions', 'settings', 'hotkeys', 'game']) {
      tui.view = view
      tui.terminalLines = Array.from({ length: 60 }, (_, index) => `output line ${index + 1}`)
      tui.render()
      const lines = stripAnsi(output.last).split('\n')
      assert.ok(lines.length <= rows, `${view} used ${lines.length}/${rows} rows at ${columns} columns`)
      for (const line of lines) assert.ok(line.length <= columns, `${view} exceeded ${columns} columns: ${line}`)
    }
  }
})

test('Projects keeps the complete top mode bar visible at 80 columns', () => {
  const output = {
    columns: 80, rows: 24, last: '',
    write(value) { this.last = value },
  }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
  tui.running = true
  tui.view = 'game'
  tui.session = createSession('projects', challengeSets.projects[0])
  tui.selectedIndex = 0
  tui.render()

  const header = stripAnsi(output.last).split('\n')[0]
  for (const label of ['Learn', 'Execute', 'Workflow', 'Projects', 'Random']) assert.match(header, new RegExp(label))
  assert.ok(header.length <= 80)
})

test('Projects does not wrap away the top mode bar at 202 by 53', () => {
  const output = {
    columns: 202, rows: 53, last: '',
    write(value) { this.last = value },
  }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:55695' } })
  tui.running = true
  tui.view = 'game'
  tui.session = createSession('projects', challengeSets.projects[33])
  tui.selectedIndex = 33
  tui.render()

  const lines = stripAnsi(output.last).split('\n')
  assert.equal(lines.length, 53)
  for (const line of lines) assert.ok(line.length <= 202, `line exceeded 202 columns: ${line}`)
  for (const label of ['Learn', 'Execute', 'Workflow', 'Projects', 'Random']) assert.match(lines[0], new RegExp(label))
})

test('Random mode draws from the full bank without immediately repeating', () => {
  const expectedSize = challengeSets.learn.length + challengeSets.execute.length + challengeSets.workflow.length + challengeSets.projects.length
  assert.equal(challengeSets.random.length, expectedSize)
  assert.equal(challengeSets.projects.length, 68)
  assert.equal(challengeSets.random.length, 100)
  const randomIds = new Set(challengeSets.random.map((challenge) => challenge.id))
  for (const project of challengeSets.projects) assert.ok(randomIds.has(project.id), `${project.id} is missing from Random`)
  const previous = challengeSets.random[0]
  const next = sampleChallenge('random', previous.id)
  assert.notEqual(next.id, previous.id)
  assert.notDeepEqual(next.commands, previous.commands)
})

test('Projects presents a diverse bank of real Git solutions', () => {
  const signatures = challengeSets.projects.map((challenge) => challenge.commands.join('\n'))
  const frequencies = new Map()
  for (const signature of signatures) frequencies.set(signature, (frequencies.get(signature) ?? 0) + 1)
  const scenarioFrequencies = new Map()
  for (const challenge of challengeSets.projects) {
    const kind = challenge.scenario.kind
    scenarioFrequencies.set(kind, (scenarioFrequencies.get(kind) ?? 0) + 1)
  }

  assert.ok(frequencies.size >= 55, `expected at least 55 solution shapes, received ${frequencies.size}`)
  assert.ok(Math.max(...frequencies.values()) <= 4, 'one project solution is repeated too often')
  assert.ok(scenarioFrequencies.size >= 36, `expected at least 36 repository problems, received ${scenarioFrequencies.size}`)
  assert.ok(Math.max(...scenarioFrequencies.values()) <= 3, 'one repository problem is repeated too often')
  assert.ok(challengeSets.projects.filter((challenge) => challenge.commands.length > 1).length >= 18)
})

test('Tab followed by Space skips to a different Random challenge', async () => {
  const sandbox = {
    url: 'http://127.0.0.1:7331',
    sessions: [],
    async session(challengeId) {
      this.sessions.push(challengeId)
      return {
        complete: false,
        step: 0,
        output: 'ready',
        state: { cwd: '~/sandbox/atlas', branch: 'main', porcelain: [] },
      }
    },
  }
  const tui = new GittyperTui({}, { columns: 100, rows: 30, write() {} }, { sandbox })
  tui.view = 'game'
  tui.session = createSession('random', challengeSets.random[0])
  tui.selectedIndex = 0
  const previousId = tui.session.challenge.id

  await tui.handleKey('\t')
  assert.equal(tui.skipArmed, true)
  assert.equal(sandbox.sessions.length, 0)
  await tui.handleKey(' ')

  assert.equal(tui.skipArmed, false)
  assert.notEqual(tui.session.challenge.id, previousId)
  assert.deepEqual(sandbox.sessions, [tui.session.challenge.id])
})

test('Tab does not autocomplete or start the timer in Learn mode', async () => {
  const output = { columns: 100, rows: 30, write() {} }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
  tui.view = 'game'
  tui.session = createSession('learn', learnChallenges[0])

  await tui.handleKey('\t')

  assert.equal(tui.session.input, '')
  assert.equal(tui.cursorPosition, 0)
  assert.equal(tui.session.startedAt, null)
})

test('Shift arrows scroll the transcript and Ctrl arrows change drills', async () => {
  const output = { columns: 100, rows: 30, write() {} }
  const sandbox = {
    url: 'http://127.0.0.1:7331',
    async session() {
      return {
        complete: false,
        step: 0,
        output: 'ready',
        state: { cwd: '~/sandbox/atlas', branch: 'main', porcelain: [] },
      }
    },
  }
  const tui = new GittyperTui({}, output, { sandbox })
  tui.view = 'game'
  tui.terminalLines = Array.from({ length: 60 }, (_, index) => `line ${index}`)
  await tui.handleKey('\u001b[1;2A')
  assert.equal(tui.outputScroll, 5)
  await tui.handleKey('\u001b[1;2B')
  assert.equal(tui.outputScroll, 0)

  const previousIndex = tui.selectedIndex
  await tui.handleKey('\u001b[1;5B')
  assert.notEqual(tui.selectedIndex, previousIndex)
})

test('transcript scrolling does not move into blank space when all output fits', async () => {
  const output = { columns: 80, rows: 24, write() {} }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
  tui.view = 'game'
  tui.session.complete = true
  tui.terminalLines = ['$ git status', 'On branch main']
  await tui.handleKey('\u001b[1;2A')
  assert.equal(tui.outputScroll, 0)
})

test('multi-command success assistance can be shown or hidden', async () => {
  const challenge = executeChallenges.find((item) => item.id === 'new-repo')
  const makeTui = (stepSuccess) => {
    const sandbox = {
      url: 'http://127.0.0.1:7331',
      async command() {
        return {
          ok: true,
          complete: false,
          step: 1,
          output: '',
          state: { cwd: '~/sandbox/atlas', branch: null, porcelain: [] },
        }
      },
    }
    const tui = new GittyperTui({}, { write() {} }, { sandbox, settings: { stepSuccess } })
    tui.session = createSession('execute', challenge)
    tui.session.input = 'mkdir atlas'
    return tui
  }

  const assisted = makeTui('show')
  await assisted.executeInput()
  assert.match(assisted.terminalLines.join('\n'), /\[ok\] Command successful\. Next objective: 2\/3\./)

  const minimal = makeTui('hide')
  await minimal.executeInput()
  assert.doesNotMatch(minimal.terminalLines.join('\n'), /Command successful/)
})

test('the active prompt follows command output instead of being pinned to the bottom', () => {
  const output = {
    columns: 200, rows: 50, last: '',
    write(value) { this.last = value },
  }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
  tui.running = true
  tui.view = 'game'
  tui.terminalLines = ['$ git status', 'On branch main', 'nothing to commit, working tree clean']
  tui.session.input = 'git log'
  tui.render()

  const lines = stripAnsi(output.last).split('\n')
  const statusLine = lines.findIndex((line) => line.includes('nothing to commit'))
  const promptLine = lines.findIndex((line) => /[|│] \$ git log/.test(line))
  const bottomBorder = lines.findIndex((line, index) => index > promptLine && /[+┘]\s*$/.test(line))
  assert.ok(statusLine >= 0)
  assert.equal(promptLine, statusLine + 1)
  assert.ok(bottomBorder - promptLine > 10, 'the prompt should flow after output with terminal space below it')
})

test('completed drills retain a scrollable command transcript', () => {
  const output = {
    columns: 80, rows: 24, last: '',
    write(value) { this.last = value },
  }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
  tui.running = true
  tui.view = 'game'
  tui.session.complete = true
  tui.terminalLines = Array.from({ length: 30 }, (_, index) => `history line ${index + 1}`)
  tui.outputScroll = 20
  tui.render()

  const screen = stripAnsi(output.last)
  assert.match(screen, /OBJECTIVE ACHIEVED/)
  assert.match(screen, /VIEWING 20 LINES BACK/)
  assert.match(screen, /history line 10/)
  assert.doesNotMatch(screen, /history line 30/)
})

test('Up and Down recall entered commands without changing drills', async () => {
  const output = { columns: 100, rows: 30, write() {} }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
  tui.view = 'game'
  tui.commandHistory = ['git status', 'git diff']

  await tui.handleKey('\u001b[A')
  assert.equal(tui.session.input, 'git diff')
  await tui.handleKey('\u001b[A')
  assert.equal(tui.session.input, 'git status')
  await tui.handleKey('\u001b[B')
  assert.equal(tui.session.input, 'git diff')
  await tui.handleKey('\u001b[B')
  assert.equal(tui.session.input, '')
})

test('Left and Right support insertion and Backspace within a command line', async () => {
  const output = { columns: 100, rows: 30, write() {} }
  const tui = new GittyperTui({}, output, { sandbox: { url: 'http://127.0.0.1:7331' } })
  tui.view = 'game'

  for (const key of 'git stats') await tui.handleKey(key)
  assert.equal(tui.cursorPosition, 9)
  await tui.handleKey('\u001b[D')
  await tui.handleKey('u')
  assert.equal(tui.session.input, 'git status')

  await tui.handleKey('\u001b[D')
  await tui.handleKey('X')
  assert.equal(tui.session.input, 'git statXus')
  await tui.handleKey('\u007f')
  assert.equal(tui.session.input, 'git status')
  assert.equal(tui.cursorPosition, 8)
})
