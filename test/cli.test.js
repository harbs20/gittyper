import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const cli = fileURLToPath(new URL('../bin/gittyper.js', import.meta.url))
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('CLI reports its package version without starting the TUI', async () => {
  const { stdout, stderr } = await run(process.execPath, [cli, '--version'])
  assert.equal(stdout.trim(), packageJson.version)
  assert.equal(stderr, '')
})

test('CLI provides non-interactive help for package managers', async () => {
  const { stdout, stderr } = await run(process.execPath, [cli, '--help'])
  assert.match(stdout, /terminal typing game/i)
  assert.match(stdout, /Usage: gittyper/)
  assert.match(stdout, /--version/)
  assert.equal(stderr, '')
})

test('CLI rejects unknown options without creating a sandbox', async () => {
  await assert.rejects(
    run(process.execPath, [cli, '--unknown']),
    (error) => error.code === 1 && /Unknown option: --unknown/.test(error.stderr),
  )
})
