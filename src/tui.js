import { challengeSets, modes, sampleChallenge } from './challenges.js'
import { challengeAt, createSession, modeOrder, sessionStats } from './engine.js'
import { defaultUiSettings, normalizeUiSettings } from './settings.js'

const esc = '\u001b['
const ansi = {
  clear: `${esc}2J${esc}H`, hideCursor: `${esc}?25l`, showCursor: `${esc}?25h`, reset: `${esc}0m`,
  bold: `${esc}1m`, dim: '', lime: `${esc}1m`, coral: `${esc}31m`,
  paper: '', muted: '', bgLime: `${esc}7m`, ink: '',
}

const glyphs = {
  horizontal: '-', vertical: '|', topLeft: '+', topRight: '+', middleLeft: '+',
  middleRight: '+', bottomLeft: '+', bottomRight: '+', ellipsis: '...', done: 'x', dot: '*',
}

function applyAppearance(settings) {
  const high = settings.contrast === 'high'
  const colors = {
    terminal: { accent: `${esc}1m`, selected: `${esc}7m`, ink: '' },
    green: { accent: `${esc}32m`, selected: `${esc}42m`, ink: `${esc}30m` },
    cyan: { accent: `${esc}36m`, selected: `${esc}46m`, ink: `${esc}30m` },
    mono: { accent: '', selected: `${esc}7m`, ink: '' },
  }[settings.color]
  Object.assign(ansi, {
    dim: high ? '' : `${esc}2m`,
    lime: colors.accent,
    coral: high ? `${esc}1;31m` : `${esc}31m`,
    paper: '',
    muted: high ? '' : `${esc}2m`,
    bgLime: colors.selected,
    ink: colors.ink,
  })
  Object.assign(glyphs, settings.borders === 'unicode' ? {
    horizontal: '─', vertical: '│', topLeft: '┌', topRight: '┐', middleLeft: '├',
    middleRight: '┤', bottomLeft: '└', bottomRight: '┘', ellipsis: '…', done: '✓', dot: '●',
  } : {
    horizontal: '-', vertical: '|', topLeft: '+', topRight: '+', middleLeft: '+',
    middleRight: '+', bottomLeft: '+', bottomRight: '+', ellipsis: '...', done: 'x', dot: '*',
  })
}

function style(code, value) { return `${code}${value}${ansi.reset}` }
export function stripAnsi(value) { return value.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '') }
function visibleLength(value) { return stripAnsi(value).length }
function truncate(value, width) {
  if (visibleLength(value) <= width) return value
  const suffix = glyphs.ellipsis
  return `${stripAnsi(value).slice(0, Math.max(0, width - suffix.length))}${suffix}`
}
function pad(value, width) { return value + ' '.repeat(Math.max(0, width - visibleLength(value))) }
function center(value, width) {
  const size = visibleLength(value)
  const left = Math.max(0, Math.floor((width - size) / 2))
  return `${' '.repeat(left)}${value}${' '.repeat(Math.max(0, width - size - left))}`
}
function rule(width) { return glyphs.horizontal.repeat(Math.max(0, width)) }
function boxLine(content, width) { return `${glyphs.vertical} ${pad(content, width - 4)} ${glyphs.vertical}` }
function boxTop(width) { return `${glyphs.topLeft}${rule(width - 2)}${glyphs.topRight}` }
function boxMiddle(width) { return `${glyphs.middleLeft}${rule(width - 2)}${glyphs.middleRight}` }
function boxBottom(width) { return `${glyphs.bottomLeft}${rule(width - 2)}${glyphs.bottomRight}` }
function logoMark() { return glyphs.topLeft === '+' ? '>_' : '›_' }
function commandPrompt(input, cursorPosition, width) {
  const fieldWidth = Math.max(1, width - 2)
  const cursor = Math.max(0, Math.min(input.length, cursorPosition))
  const start = Math.max(0, cursor - fieldWidth + 1)
  const before = input.slice(start, cursor)
  const cursorCharacter = input[cursor] ?? ' '
  const afterStart = cursor < input.length ? cursor + 1 : cursor
  const after = input.slice(afterStart, afterStart + Math.max(0, fieldWidth - before.length - 1))
  return `${style(ansi.paper, '$')} ${before}${style(ansi.bgLime + ansi.ink, cursorCharacter)}${after}`
}

export function tokenizeKeys(chunk) {
  return chunk.match(/\u001b\[1;[25][AB]|\u001b\[[ABCD]|\u001b\[[56]~|[\s\S]/g) ?? []
}

function wrapText(text, width) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    if (!line) line = word
    else if (line.length + word.length + 1 <= width) line += ` ${word}`
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

export class GittyperTui {
  constructor(input, output, { sandbox, onExit, settings = defaultUiSettings, saveSettings } = {}) {
    this.input = input
    this.output = output
    this.sandbox = sandbox
    this.onExit = onExit
    this.settings = normalizeUiSettings(settings)
    this.saveSettings = saveSettings
    this.session = createSession()
    this.selectedIndex = challengeSets.learn.indexOf(this.session.challenge)
    this.completed = new Set()
    this.terminalLines = []
    this.outputScroll = 0
    this.commandHistory = []
    this.historyIndex = null
    this.historyDraft = ''
    this.skipArmed = false
    this.cursorPosition = 0
    this.view = 'instructions'
    this.running = false
    this.busy = false
    this.tick = null
    this.keyQueue = Promise.resolve()
    this.onData = this.onData.bind(this)
    this.onResize = this.onResize.bind(this)
  }

  async start() {
    if (!this.input.isTTY || !this.output.isTTY) {
      this.output.write('Gittyper needs an interactive terminal. Run `npm start` directly in Terminal.\n')
      await this.onExit?.()
      return
    }

    this.running = true
    this.input.setRawMode(true)
    this.input.setEncoding('utf8')
    this.input.resume()
    this.input.on('data', this.onData)
    this.output.on('resize', this.onResize)
    this.output.write(ansi.hideCursor)
    this.tick = setInterval(() => this.render(), 1000)
    await this.loadChallenge()
    this.render()
  }

  async stop() {
    if (!this.running) return
    this.running = false
    clearInterval(this.tick)
    this.input.off('data', this.onData)
    this.output.off('resize', this.onResize)
    if (this.input.isTTY) this.input.setRawMode(false)
    this.output.write(`${ansi.clear}${ansi.showCursor}${ansi.reset}Removing disposable workspace…\n`)
    await this.onExit?.()
    this.output.write('Thanks for practicing with Gittyper.\n')
    this.input.pause()
  }

  onResize() { this.render() }

  onData(chunk) {
    const keys = tokenizeKeys(chunk)
    this.keyQueue = this.keyQueue.then(async () => {
      for (const key of keys) {
        if (!this.running) break
        await this.handleKey(key)
      }
      this.render()
    }).catch((error) => {
      this.busy = false
      this.session.feedback = { type: 'error', text: error.message }
      this.render()
    })
  }

  async loadChallenge() {
    this.busy = true
    this.session.feedback = { type: 'info', text: 'Seeding a fresh disposable codebase…' }
    this.terminalLines = []
    this.outputScroll = 0
    this.historyIndex = null
    this.historyDraft = ''
    this.skipArmed = false
    this.cursorPosition = 0
    this.session.showHint = this.settings.hints === 'auto' && this.session.mode === 'learn'
    this.render()
    const result = await this.sandbox.session(this.session.challenge.id)
    this.session.repoState = this.describeState(result.state)
    this.session.complete = result.complete
    if (result.complete) {
      this.session.completedAt ??= Date.now()
      this.session.finalStats ??= sessionStats(this.session, this.session.completedAt)
    }
    this.session.step = Math.min(result.step, this.session.challenge.commands.length - 1)
    this.terminalLines = [result.output, 'Try `ls`, `cat README.md`, `git status`, or `git diff`.'].filter(Boolean)
    this.session.feedback = { type: 'success', text: 'Sandbox ready. Explore freely; the objective is state-based.' }
    this.busy = false
  }

  describeState(state) {
    const lines = [`${state.cwd}${state.branch ? `  ·  ${state.branch}` : '  ·  not a repository'}`]
    if (state.porcelain?.length) lines.push(...state.porcelain)
    else if (state.branch) lines.push('working tree clean')
    return lines
  }

  async switchMode(direction) {
    const current = modeOrder.indexOf(this.session.mode)
    const nextMode = modeOrder[(current + direction + modeOrder.length) % modeOrder.length]
    const next = sampleChallenge(nextMode)
    this.session = createSession(nextMode, next)
    this.selectedIndex = challengeSets[nextMode].indexOf(next)
    await this.loadChallenge()
  }

  async selectChallenge(direction) {
    const items = challengeSets[this.session.mode]
    this.selectedIndex = (this.selectedIndex + direction + items.length) % items.length
    this.session = createSession(this.session.mode, challengeAt(this.session.mode, this.selectedIndex))
    await this.loadChallenge()
  }

  async newRandom() {
    const next = sampleChallenge(this.session.mode, this.session.challenge.id)
    this.session = createSession(this.session.mode, next)
    this.selectedIndex = challengeSets[this.session.mode].indexOf(next)
    await this.loadChallenge()
  }

  async executeInput() {
    const command = this.session.input.trim()
    if (!command || this.busy) return
    this.busy = true
    this.session.startedAt ??= Date.now()
    this.session.input = ''
    this.cursorPosition = 0
    this.commandHistory.push(command)
    this.commandHistory = this.commandHistory.slice(-100)
    this.historyIndex = null
    this.historyDraft = ''
    this.outputScroll = 0
    this.terminalLines.push(`$ ${command}`)
    this.render()

    const previousStep = this.session.step
    const result = await this.sandbox.command(command)
    const commandLines = result.output ? result.output.split('\n') : []
    const multiStepSuccess = result.ok
      && !result.complete
      && this.session.challenge.commands.length > 1
      && result.step > previousStep
      && this.settings.stepSuccess === 'show'
    if (multiStepSuccess) {
      commandLines.push(`[ok] Command successful. Next objective: ${result.step + 1}/${this.session.challenge.commands.length}.`)
    } else if (!commandLines.length && !result.ok) {
      commandLines.push('Command failed without output.')
    }
    this.terminalLines.push(...commandLines)
    this.terminalLines = this.terminalLines.slice(-240)
    this.session.typed += command.length
    if (!result.ok) this.session.errors += command.length
    this.session.repoState = this.describeState(result.state)
    this.session.step = Math.min(result.step, this.session.challenge.commands.length - 1)
    this.session.complete = result.complete
    if (result.complete) {
      this.session.completedAt ??= Date.now()
      this.session.finalStats ??= sessionStats(this.session, this.session.completedAt)
    }
    this.session.feedback = result.complete
      ? { type: 'success', text: 'Repository objective achieved.' }
      : result.ok
        ? { type: 'success', text: 'Command ran. Inspect the output and continue.' }
        : { type: 'error', text: result.output || 'Command failed.' }
    if (result.complete) this.completed.add(`${this.session.mode}:${this.session.challenge.id}`)
    this.busy = false
  }

  recallHistory(direction) {
    if (!this.commandHistory.length) return false
    if (this.historyIndex === null) {
      if (direction > 0) return false
      this.historyDraft = this.session.input
      this.historyIndex = this.commandHistory.length - 1
    } else {
      this.historyIndex = Math.max(0, Math.min(this.commandHistory.length, this.historyIndex + direction))
    }
    if (this.historyIndex === this.commandHistory.length) {
      this.session.input = this.historyDraft
      this.historyIndex = null
    } else {
      this.session.input = this.commandHistory[this.historyIndex]
    }
    this.cursorPosition = this.session.input.length
    this.outputScroll = 0
    return true
  }

  terminalRowCapacity() {
    const width = Math.max(30, this.output.columns || 100)
    const height = Math.max(8, this.output.rows || 34)
    if (height < 20) {
      const promptRows = height >= 14 ? 1 : 0
      return Math.max(1, height - 9 - promptRows)
    }
    const compact = width < 110
    const rowBudget = height - (compact ? 5 : 4)
    const gameWidth = compact
      ? width
      : width - Math.min(33, Math.max(27, Math.floor(width * .26))) - 3
    const inner = Math.max(1, gameWidth - 4)
    const promptRows = compact ? 1 : wrapText(this.session.challenge.prompt, inner).length
    const frameRows = this.session.complete ? 7 : 7 + promptRows
    return Math.max(1, rowBudget - frameRows - 1)
  }

  scrollTranscript(delta) {
    const hiddenLines = Math.max(0, this.terminalLines.length - this.terminalRowCapacity())
    this.outputScroll = Math.max(0, Math.min(hiddenLines, this.outputScroll + delta))
  }

  async updateSetting(key, values) {
    const current = values.indexOf(this.settings[key])
    this.settings[key] = values[(current + 1) % values.length]
    if (key === 'hints') {
      this.session.showHint = this.settings.hints === 'auto' && this.session.mode === 'learn'
    }
    try {
      await this.saveSettings?.(this.settings)
      this.settingsMessage = 'Saved. Changes apply immediately.'
    } catch (error) {
      this.settingsMessage = `Could not save: ${error.message}`
    }
  }

  async handleKey(key) {
    if (key === '\u0003') return this.stop()
    if (this.busy) return

    if (this.view === 'instructions') {
      if (key === '\u001b') return this.stop()
      if (key === '\r' || key === '\n' || key === ' ') this.view = 'game'
      else if (key === '\u0015') this.view = 'settings'
      else if (key === '\u000b') this.view = 'hotkeys'
      return
    }

    if (this.view === 'settings') {
      if (key === '\u001b' || key === '\u0015' || key === '\r' || key === '\n') this.view = 'game'
      else if (key === '\u000b') this.view = 'hotkeys'
      else if (key === '1') await this.updateSetting('contrast', ['high', 'soft'])
      else if (key === '2') await this.updateSetting('color', ['terminal', 'green', 'cyan', 'mono'])
      else if (key === '3') await this.updateSetting('borders', ['ascii', 'unicode'])
      else if (key === '4') await this.updateSetting('hints', ['auto', 'manual', 'off'])
      else if (key === '5') await this.updateSetting('stepSuccess', ['show', 'hide'])
      else if (key === '6') await this.updateSetting('learnGuide', ['show', 'hide'])
      return
    }

    if (this.view === 'hotkeys') {
      if (key === '\u0015') this.view = 'settings'
      else if (key === '\u001b' || key === '\u000b' || key === '\r' || key === '\n') this.view = 'game'
      return
    }

    if (this.session.mode === 'random' && this.skipArmed) {
      if (key === ' ') {
        this.skipArmed = false
        await this.newRandom()
        return
      }
      if (key !== '\t') this.skipArmed = false
    }

    if (key === '\u001b') {
      if (this.session.input) {
        this.session.input = ''
        this.cursorPosition = 0
      }
      else return this.stop()
    } else if (key === '\u0015') {
      this.settingsMessage = ''
      this.view = 'settings'
    } else if (key === '\u000b') {
      this.view = 'hotkeys'
    } else if (key === '\u001b[D') {
      if (this.session.input) this.cursorPosition = Math.max(0, this.cursorPosition - 1)
      else await this.switchMode(-1)
    } else if (key === '\u001b[C') {
      if (this.session.input) this.cursorPosition = Math.min(this.session.input.length, this.cursorPosition + 1)
      else await this.switchMode(1)
    } else if (key === '\u001b[1;2A') {
      this.scrollTranscript(5)
    } else if (key === '\u001b[1;2B') {
      this.scrollTranscript(-5)
    } else if (key === '\u001b[1;5A') {
      await this.selectChallenge(-1)
    } else if (key === '\u001b[1;5B') {
      await this.selectChallenge(1)
    } else if (key === '\u001b[A') {
      if (!this.recallHistory(-1)) await this.selectChallenge(-1)
    } else if (key === '\u001b[B') {
      if (!this.recallHistory(1) && this.historyIndex === null && !this.session.input) await this.selectChallenge(1)
    } else if (key === '\u001b[5~') {
      this.scrollTranscript(5)
    } else if (key === '\u001b[6~') {
      this.scrollTranscript(-5)
    } else if (key === '\u000e') {
      await this.newRandom()
    } else if (key === '\u0012') {
      this.session = createSession(this.session.mode, this.session.challenge)
      await this.loadChallenge()
    } else if (key === '\u0008') {
      if (this.settings.hints !== 'off') this.session.showHint = !this.session.showHint
    } else if (key === '?' && !this.session.input) {
      this.view = 'instructions'
    } else if (key === '\t' && this.session.mode === 'random') {
      this.skipArmed = true
    } else if (key === '\t') {
      // Tab is intentionally not autocomplete: WPM must measure characters the player typed.
    } else if (key === '\r' || key === '\n') {
      if (this.session.complete) await this.newRandom()
      else await this.executeInput()
    } else if (key === '\u007f') {
      if (this.cursorPosition > 0) {
        this.session.input = `${this.session.input.slice(0, this.cursorPosition - 1)}${this.session.input.slice(this.cursorPosition)}`
        this.cursorPosition -= 1
      }
      this.historyIndex = null
      this.historyDraft = ''
    } else if (!this.session.complete && !key.startsWith('\u001b') && /^[\x20-\x7E]+$/.test(key)) {
      this.session.input = `${this.session.input.slice(0, this.cursorPosition)}${key}${this.session.input.slice(this.cursorPosition)}`
      this.cursorPosition += key.length
      this.historyIndex = null
      this.historyDraft = ''
      this.session.startedAt ??= Date.now()
      this.session.feedback = null
    }
  }

  render() {
    if (!this.running) return
    applyAppearance(this.settings)
    const width = Math.max(30, this.output.columns || 100)
    const height = Math.max(8, this.output.rows || 34)
    const stats = this.session.finalStats ?? sessionStats(this.session)

    if (this.view === 'instructions') {
      this.output.write(`${ansi.clear}${this.renderInstructions(width, height).slice(0, height).join('\n')}`)
      return
    }

    if (this.view === 'settings') {
      this.output.write(`${ansi.clear}${this.renderSettings(width, height).slice(0, height).join('\n')}`)
      return
    }

    if (this.view === 'hotkeys') {
      this.output.write(`${ansi.clear}${this.renderHotkeys(width, height).slice(0, height).join('\n')}`)
      return
    }

    if (height < 20) {
      this.output.write(`${ansi.clear}${this.renderShort(width, height, stats).slice(0, height).join('\n')}`)
      return
    }

    const compact = width < 110
    const lines = [this.renderHeader(width), style(ansi.dim, rule(width))]
    const gameBudget = height - (compact ? 5 : 4)
    if (compact) lines.push(...this.renderCompact(width, stats, gameBudget))
    else lines.push(...this.renderWide(width, stats, height < 28, gameBudget))
    lines.push(style(ansi.dim, rule(width)), this.renderFooter(width))
    this.output.write(`${ansi.clear}${lines.slice(0, Math.max(1, height)).join('\n')}`)
  }

  renderInstructions(width, height) {
    const host = this.sandbox.url.replace('http://', '')
    const title = `${style(ansi.lime, logoMark())} ${style(ansi.bold + ansi.lime, 'gittyper')}`
    const header = width >= 58
      ? `${title}${' '.repeat(Math.max(1, width - visibleLength(title) - host.length))}${style(ansi.muted, host)}`
      : title
    const body = [
      header,
      style(ansi.dim, rule(width)),
      '',
      style(ansi.bold + ansi.paper, 'Practice Git in a disposable localhost repository.'),
      '',
      style(ansi.muted, 'Left/Right edits a command; at an empty prompt it changes modes'),
      style(ansi.muted, 'Up/Down history   Ctrl+Up/Down drills   Shift+Up/Down transcript'),
      style(ansi.muted, 'Ctrl+K hotkeys   Ctrl+U settings   ? help   Esc quits'),
      '',
      style(ansi.bgLime + ansi.ink + ansi.bold, ' Press Enter to start '),
    ]
    return body.map((line) => visibleLength(line) > width ? style(ansi.muted, truncate(stripAnsi(line), width)) : line).slice(0, height)
  }

  renderSettings(width, height) {
    const title = `${style(ansi.lime, logoMark())} ${style(ansi.bold + ansi.lime, 'gittyper')}  UI SETTINGS`
    const choice = (number, label, value) => `${style(ansi.bold, `[${number}]`)} ${pad(label, 14)} ${style(ansi.bgLime + ansi.ink + ansi.bold, ` ${value.toUpperCase()} `)}`
    const body = [
      title,
      style(ansi.dim, rule(width)),
      '',
      style(ansi.bold, 'Readability and appearance'),
      '',
      choice('1', 'Contrast', this.settings.contrast),
      choice('2', 'Color', this.settings.color),
      choice('3', 'Borders', this.settings.borders),
      '',
      style(ansi.bold, 'Assistance'),
      '',
      choice('4', 'Hints', this.settings.hints),
      choice('5', 'Step success', this.settings.stepSuccess),
      choice('6', 'Learn guide', this.settings.learnGuide),
      '',
      style(ansi.muted, 'Hints: AUTO opens Learn hints; MANUAL keeps them behind Ctrl+H; OFF disables them.'),
      style(ansi.muted, 'Step success confirms progress between commands in multi-command objectives.'),
      '',
      'Terminal controls the actual font family and size.',
      'Gittyper controls contrast, color, and character style.',
      '',
      this.settingsMessage ? style(ansi.lime, this.settingsMessage) : '',
      '',
      style(ansi.muted, 'Press 1-6 to change a setting. Ctrl+K opens Hotkeys. Enter or Esc returns.'),
    ]
    return body.map((line) => visibleLength(line) > width ? truncate(line, width) : line).slice(0, height)
  }

  renderHotkeys(width, height) {
    const title = `${style(ansi.lime, logoMark())} ${style(ansi.bold + ansi.lime, 'gittyper')}  HOTKEYS`
    const key = (keys, action) => `${style(ansi.bgLime + ansi.ink + ansi.bold, ` ${keys} `)}  ${action}`
    const body = [
      title,
      style(ansi.dim, rule(width)),
      '',
      style(ansi.bold, 'Terminal'),
      key('Enter', 'run a command / start the next drill'),
      key('Left / Right', 'move within the current command line'),
      key('Up / Down', 'recall earlier or later commands'),
      key('Shift+Up / Shift+Down', 'scroll the command transcript'),
      key('Page Up / Page Down', 'alternate transcript scroll keys'),
      '',
      style(ansi.bold, 'Game'),
      key('Left / Right (empty)', 'change mode when the prompt is empty'),
      key('Ctrl+Up / Ctrl+Down', 'change drill'),
      key('Ctrl+N', 'draw another random drill'),
      key('Tab, then Space', 'skip the current challenge in Random mode'),
      key('Ctrl+R', 'replay the current drill'),
      key('Ctrl+H', 'show or hide a hint when enabled'),
      '',
      style(ansi.bold, 'Interface'),
      key('Ctrl+U', 'open settings'),
      key('Ctrl+K', 'open or close this hotkey reference'),
      key('?', 'open the quick-start page from an empty prompt'),
      key('Esc', 'clear the prompt, then quit'),
      '',
      style(ansi.muted, 'Press Enter, Ctrl+K, or Esc to return to the game.'),
    ]
    return body.map((line) => visibleLength(line) > width ? truncate(line, width) : line).slice(0, height)
  }

  renderShort(width, height, stats) {
    const inner = Math.max(1, width - 2)
    const promptRows = height >= 14 ? 1 : 0
    const outputRows = Math.max(1, height - 9 - promptRows)
    const end = Math.max(0, this.terminalLines.length - this.outputScroll)
    const output = this.terminalLines.slice(Math.max(0, end - outputRows), end)
    const lines = [
      this.renderHeader(width),
      style(ansi.dim, rule(width)),
      style(ansi.lime, `${modes[this.session.mode].label.toUpperCase()} ${this.selectedIndex + 1}/${challengeSets[this.session.mode].length}`),
      style(ansi.bold + ansi.paper, truncate(this.session.challenge.title, width)),
    ]
    if (promptRows) lines.push(style(ansi.muted, truncate(this.session.challenge.prompt, width)))
    lines.push(style(ansi.dim, 'TERMINAL'))
    for (let index = 0; index < outputRows; index += 1) lines.push(truncate(output[index] ?? '', width))
    lines.push(this.session.complete
      ? style(ansi.bold, truncate('[OBJECTIVE ACHIEVED] Enter: next drill  PgUp: transcript', width))
      : commandPrompt(this.session.input, this.cursorPosition, width))
    lines.push(style(this.session.feedback?.type === 'error' ? ansi.coral : ansi.muted, truncate(this.session.feedback?.text ?? '', width)))
    lines.push(style(ansi.muted, truncate(`? help · Enter run · ${stats.wpm} WPM · Esc quit`, width)))
    return lines
  }

  renderHeader(width) {
    const logo = `${style(ansi.lime, logoMark())} ${style(ansi.bold + ansi.lime, 'gittyper')}`
    const tabs = modeOrder.map((mode) => {
      const label = ` ${modes[mode].label} `
      return this.session.mode === mode ? style(ansi.bgLime + ansi.ink + ansi.bold, label) : style(ansi.muted, label)
    }).join('  ')
    if (visibleLength(logo) + visibleLength(tabs) + 1 > width) {
      const mode = style(ansi.bgLime + ansi.ink + ansi.bold, ` ${modes[this.session.mode].label} `)
      return `${logo}${' '.repeat(Math.max(1, width - visibleLength(logo) - visibleLength(mode)))}${mode}`
    }
    const host = style(ansi.muted, this.sandbox.url.replace('http://', ''))
    if (visibleLength(logo) + visibleLength(tabs) + visibleLength(host) + 2 > width) {
      return `${logo}${' '.repeat(Math.max(1, width - visibleLength(logo) - visibleLength(tabs)))}${tabs}`
    }
    const gaps = Math.max(2, width - visibleLength(logo) - visibleLength(tabs) - visibleLength(host))
    const leftGap = Math.floor(gaps * .45)
    return `${logo}${' '.repeat(leftGap)}${tabs}${' '.repeat(gaps - leftGap)}${host}`
  }

  renderWide(width, stats, dense = false, gameBudget = 24) {
    const sideWidth = Math.min(33, Math.max(27, Math.floor(width * .26)))
    const mainWidth = width - sideWidth - 3
    const left = this.renderRail(sideWidth, gameBudget)
    const right = this.renderGame(mainWidth, stats, dense, gameBudget)
    const rows = Math.max(left.length, right.length)
    return Array.from({ length: rows }, (_, index) => `${pad(left[index] ?? '', sideWidth)} ${style(ansi.dim, glyphs.vertical)} ${right[index] ?? ''}`)
  }

  renderCompact(width, stats, gameBudget) {
    return [
      style(ansi.lime, `${modes[this.session.mode].label.toUpperCase()}  ${this.selectedIndex + 1}/${challengeSets[this.session.mode].length}`),
      ...this.renderGame(width, stats, true, gameBudget),
    ]
  }

  renderRail(width, rowBudget = 24) {
    const items = challengeSets[this.session.mode]
    const capacity = Math.max(3, rowBudget - 7)
    const start = Math.max(0, Math.min(items.length - capacity, this.selectedIndex - Math.floor(capacity / 2)))
    const visibleItems = items.slice(start, start + capacity)
    const lines = [
      style(ansi.muted, `SESSION MAP  ${this.completed.size} CLEARED`),
      style(ansi.muted, `${start + 1}-${start + visibleItems.length} OF ${items.length}`),
      style(ansi.lime, `${modes[this.session.mode].label.toUpperCase()} / ${modes[this.session.mode].short}`),
      style(ansi.dim, rule(width - 1)),
    ]
    visibleItems.forEach((item, visibleIndex) => {
      const index = start + visibleIndex
      const done = this.completed.has(`${this.session.mode}:${item.id}`)
      const marker = done ? style(ansi.lime, glyphs.done) : String(index + 1).padStart(2, '0')
      const label = truncate(item.title, width - 6)
      lines.push(index === this.selectedIndex
        ? style(ansi.bgLime + ansi.ink, ` ${marker} ${pad(label, width - 5)} `)
        : ` ${style(ansi.muted, marker)} ${label}`)
    })
    lines.push('', style(ansi.dim, truncate('Ctrl+Up/Down drill / Left/Right on empty prompt changes mode', width - 1)))
    return lines
  }

  renderGame(width, stats, compact = false, rowBudget = 24) {
    const { challenge, step, input, complete, showHint } = this.session
    const inner = width - 4
    const expected = challenge.commands[step]
    const statsText = `${stats.wpm} WPM / ${stats.accuracy}%`
    const location = truncate(this.session.repoState[0] ?? '', Math.max(1, inner - statsText.length - 23))
    const terminalTitle = `${style(this.busy ? ansi.muted : ansi.lime, glyphs.dot)} LOCALHOST SANDBOX  ${location}`
    const titleGap = Math.max(1, inner - visibleLength(terminalTitle) - statsText.length)
    const lines = [
      boxTop(width),
      boxLine(`${terminalTitle}${' '.repeat(titleGap)}${style(ansi.muted, statsText)}`, width),
      boxMiddle(width),
    ]

    if (complete) {
      lines.push(boxLine(style(ansi.bgLime + ansi.ink + ansi.bold, ` ${glyphs.done} OBJECTIVE ACHIEVED `), width))
      lines.push(boxLine(style(ansi.bold, truncate(challenge.title, inner)), width))
      const completionHelp = this.outputScroll
        ? `VIEWING ${this.outputScroll} LINES BACK / Page Down returns to the latest output`
        : 'Enter: next drill / Ctrl+R: replay / Page Up: earlier transcript'
      lines.push(boxLine(style(ansi.muted, completionHelp), width))
    } else {
      lines.push(boxLine(style(ansi.muted, `OBJECTIVE ${step + 1}/${challenge.commands.length}`), width))
      lines.push(boxLine(style(ansi.bold + ansi.paper, truncate(challenge.title, inner)), width))
      const promptLines = compact ? [truncate(challenge.prompt, inner)] : wrapText(challenge.prompt, inner)
      for (const line of promptLines) lines.push(boxLine(style(ansi.muted, line), width))
      if (this.outputScroll) lines.push(boxLine(style(ansi.dim, `VIEWING ${this.outputScroll} LINES BACK / Page Down returns to the prompt`), width))
      else if (this.skipArmed && this.session.mode === 'random') lines.push(boxLine(style(ansi.lime, 'SKIP ARMED / press Space for another random challenge'), width))
      else if (showHint && this.settings.hints !== 'off') lines.push(boxLine(`${style(ansi.muted, 'hint')}  ${style(ansi.lime, truncate(expected, inner - 6))}`, width))
      else if (this.settings.hints === 'off') lines.push(boxLine(style(ansi.dim, 'Hints are disabled / Ctrl+U opens Assistance settings'), width))
      else if (this.session.mode === 'random') lines.push(boxLine(style(ansi.dim, 'Tab then Space skips this draw / Ctrl+H reveals a hint'), width))
      else lines.push(boxLine(style(ansi.dim, 'Ctrl+H reveals one possible command / alternatives are accepted'), width))
    }
    lines.push(boxMiddle(width))

    const guideRows = this.session.mode === 'learn'
      && this.settings.learnGuide === 'show'
      && input
      && this.outputScroll === 0 ? 1 : 0
    const terminalRows = Math.max(1, rowBudget - lines.length - 1)
    const transcript = [...this.terminalLines]
    if (this.outputScroll === 0) {
      if (complete) transcript.push({ complete: true })
      else {
        transcript.push({ current: true })
        if (guideRows) transcript.push({ guide: true })
      }
    }
    const end = this.outputScroll
      ? Math.max(0, transcript.length - this.outputScroll)
      : transcript.length
    const start = Math.max(0, end - terminalRows)
    const visibleTranscript = transcript.slice(start, end)

    for (let index = 0; index < terminalRows; index += 1) {
      const entry = visibleTranscript[index]
      let rendered = ''
      if (entry?.current) {
        rendered = commandPrompt(input, this.cursorPosition, inner)
      } else if (entry?.complete) {
        rendered = style(ansi.bold, `[done] ${stats.wpm} WPM / ${stats.accuracy}% accuracy / Enter starts the next drill`)
      } else if (entry?.guide) {
        const guide = [...expected].map((character, characterIndex) => {
          if (characterIndex >= input.length) return style(ansi.dim, character === ' ' ? '.' : character)
          return input[characterIndex] === character ? style(ansi.lime, character === ' ' ? '.' : character) : style(ansi.coral, character === ' ' ? '.' : character)
        }).join('')
        rendered = `  ${truncate(guide, inner - 2)}`
      } else if (typeof entry === 'string') {
        const plain = truncate(entry.replace(/\t/g, '  '), inner)
        rendered = entry.startsWith('$ ') ? style(ansi.paper, plain) : plain
      }
      lines.push(boxLine(rendered, width))
    }
    lines.push(boxBottom(width))
    return lines
  }

  renderFooter(width) {
    const left = style(ansi.lime, 'LOCAL SANDBOX')
    const help = '? help / Ctrl+K keys / Ctrl+U settings / Shift+Up/Down scroll / Esc quit'
    if (visibleLength(left) + help.length + 1 > width) {
      return style(ansi.muted, truncate('Ctrl+K hotkeys / Ctrl+U settings / Shift+Up/Down transcript', width))
    }
    return `${left}${' '.repeat(Math.max(1, width - visibleLength(left) - help.length))}${style(ansi.muted, help)}`
  }
}
