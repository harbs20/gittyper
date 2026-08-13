#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { GittyperTui } from '../src/tui.js'
import { createSandboxServer, SandboxClient } from '../src/sandbox/server.js'
import { loadUiSettings, saveUiSettings } from '../src/settings.js'

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const [option, ...extraOptions] = process.argv.slice(2)

if (option === '--version' || option === '-v') {
  process.stdout.write(`${version}\n`)
  process.exit(0)
}

if (option === '--help' || option === '-h') {
  process.stdout.write(`Gittyper ${version}\n\n`)
  process.stdout.write('A terminal typing game for learning real Git workflows safely.\n\n')
  process.stdout.write('Usage: gittyper [--help] [--version]\n\n')
  process.stdout.write('Options:\n')
  process.stdout.write('  -h, --help     Show this help text\n')
  process.stdout.write('  -v, --version  Show the installed version\n')
  process.exit(0)
}

if (option || extraOptions.length) {
  process.stderr.write(`Unknown option: ${[option, ...extraOptions].join(' ')}\n`)
  process.stderr.write('Run gittyper --help for usage.\n')
  process.exit(1)
}

const host = await createSandboxServer()
const sandbox = new SandboxClient(host.url, host.token)
const settings = await loadUiSettings()
const app = new GittyperTui(process.stdin, process.stdout, {
  sandbox,
  settings,
  saveSettings: saveUiSettings,
  onExit: () => host.close(),
})
await app.start()
