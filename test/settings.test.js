import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { defaultUiSettings, loadUiSettings, normalizeUiSettings, saveUiSettings } from '../src/settings.js'

test('UI settings normalize unknown values to readable defaults', () => {
  assert.deepEqual(normalizeUiSettings({ contrast: 'unknown', color: 'cyan', borders: 'broken' }), {
    ...defaultUiSettings,
    color: 'cyan',
  })
})

test('UI settings persist between game sessions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gittyper-settings-'))
  const path = join(directory, 'settings.json')
  try {
    const expected = {
      ...defaultUiSettings,
      contrast: 'soft',
      color: 'green',
      borders: 'unicode',
      hints: 'manual',
      stepSuccess: 'hide',
      learnGuide: 'hide',
    }
    await saveUiSettings(expected, path)
    assert.deepEqual(await loadUiSettings(path), expected)
  } finally {
    await rm(directory, { recursive: true })
  }
})
