#!/usr/bin/env node

import { GittyperTui } from '../src/tui.js'
import { createSandboxServer, SandboxClient } from '../src/sandbox/server.js'
import { loadUiSettings, saveUiSettings } from '../src/settings.js'

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
