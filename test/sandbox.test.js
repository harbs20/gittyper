import test from 'node:test'
import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import { SessionSandbox, parseCommandLine } from '../src/sandbox/repository.js'
import { createSandboxServer, SandboxClient } from '../src/sandbox/server.js'
import { challengeSets } from '../src/challenges.js'

test('parses quoted command arguments without invoking a shell', () => {
  assert.deepEqual(parseCommandLine('git commit -m "Update documentation"'), ['git', 'commit', '-m', 'Update documentation'])
  assert.throws(() => parseCommandLine('git commit -m "unfinished'), /Unclosed quote/)
})

test('real git diff runs against a seeded disposable codebase', async (context) => {
  const sandbox = new SessionSandbox()
  context.after(() => sandbox.close())
  await sandbox.reset('inspect-change')
  const result = await sandbox.run('git diff')
  assert.equal(result.ok, true)
  assert.match(result.output, /diff --git a\/src\/search\.js b\/src\/search\.js/)
  assert.match(result.output, /normalize/)
  assert.equal(result.complete, false)
})

test('workflow completion is semantic and accepts an equivalent staging command', async (context) => {
  const sandbox = new SessionSandbox()
  context.after(() => sandbox.close())
  await sandbox.reset('docs-commit')

  const staged = await sandbox.run('git add docs')
  assert.equal(staged.ok, true)
  assert.equal(staged.complete, false)

  const committed = await sandbox.run('git commit -m "Update documentation"')
  assert.equal(committed.ok, true)
  assert.equal(committed.complete, true)
  assert.ok(committed.state.porcelain.some((line) => line.endsWith('src/app.js')))
})

test('sandbox blocks filesystem escapes, shell syntax, and unsafe git modes', async (context) => {
  const sandbox = new SessionSandbox()
  context.after(() => sandbox.close())
  await sandbox.reset('status')

  assert.equal((await sandbox.run('cat /etc/passwd')).ok, false)
  assert.equal((await sandbox.run('git diff --no-index /etc/passwd README.md')).ok, false)
  assert.equal((await sandbox.run('git -c alias.steal=!cat status')).ok, false)
  assert.equal((await sandbox.run('git status | cat /etc/passwd')).ok, false)
  assert.equal((await sandbox.run('git remote add origin file:///etc')).ok, false)
})

test('every suggested challenge path reaches its semantic objective', async (context) => {
  const sandbox = new SessionSandbox()
  context.after(() => sandbox.close())
  const tested = new Set()

  for (const challenges of Object.values(challengeSets)) {
    for (const challenge of challenges) {
      if (tested.has(challenge.id)) continue
      tested.add(challenge.id)
      await sandbox.reset(challenge.id)
      let result
      for (const command of challenge.commands) result = await sandbox.run(command)
      assert.equal(result?.complete, true, `${challenge.id} did not complete: ${result?.output}`)
    }
  }
})

test('localhost API is authenticated and deletes its workspace on close', async (context) => {
  let host
  try {
    host = await createSandboxServer()
  } catch (error) {
    if (error.code === 'EPERM') {
      context.skip('This environment blocks loopback listeners.')
      return
    }
    throw error
  }
  const client = new SandboxClient(host.url, host.token)
  const session = await client.session('status')
  assert.match(session.state.cwd, /~\/sandbox\/atlas/)
  const statusResult = await client.command('git status --short')
  assert.equal(statusResult.ok, true)
  const root = host.sandbox.root

  const unauthorized = await fetch(`${host.url}/command`, { method: 'POST', body: '{}' })
  assert.equal(unauthorized.status, 401)
  await host.close()
  await assert.rejects(stat(root), /ENOENT/)
})
