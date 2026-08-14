import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { challengeSets } from '../src/challenges.js'
import {
  emptyProgress,
  loadProgress,
  progressionState,
  progressStats,
  recordAttempt,
  recordCompletion,
  saveProgress,
} from '../src/progress.js'

function completion(id, overrides = {}) {
  return {
    id,
    title: `Challenge ${id}`,
    mode: 'learn',
    wpm: 41,
    accuracy: 100,
    durationMs: 10_000,
    typed: 40,
    errors: 0,
    completedAt: '2026-08-13T12:00:00.000Z',
    ...overrides,
  }
}

test('progress saves atomically outside the sandbox and restores per-challenge performance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gittyper-progress-'))
  const path = join(directory, 'progress.json')
  try {
    let progress = recordAttempt(emptyProgress(), {
      id: 'status', title: 'Check status', mode: 'learn', attemptedAt: '2026-08-13T11:59:00.000Z',
    })
    ;({ progress } = recordCompletion(progress, completion('status', { wpm: 52, accuracy: 96 })))
    ;({ progress } = recordCompletion(progress, completion('status', { wpm: 44, accuracy: 100, durationMs: 8_000 })))

    await saveProgress(progress, path)
    const restored = await loadProgress(path)
    assert.equal(restored.challenges.status.attempts, 2)
    assert.equal(restored.challenges.status.completions, 2)
    assert.equal(restored.challenges.status.bestWpm, 52)
    assert.equal(restored.challenges.status.bestAccuracy, 100)
    assert.equal(restored.challenges.status.fastestDurationMs, 8_000)
    assert.equal(restored.challenges.status.last.wpm, 44)
    assert.equal((await readFile(path, 'utf8')).endsWith('\n'), true)
  } finally {
    await rm(directory, { recursive: true })
  }
})

test('missing or malformed progress safely starts fresh', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gittyper-progress-invalid-'))
  const path = join(directory, 'progress.json')
  try {
    assert.deepEqual(await loadProgress(path), emptyProgress())
    await writeFile(path, '{not json')
    assert.deepEqual(await loadProgress(path), emptyProgress())
  } finally {
    await rm(directory, { recursive: true })
  }
})

test('lifetime stats distinguish completions, unique mastery, and fast objectives', () => {
  let progress = emptyProgress()
  ;({ progress } = recordCompletion(progress, completion('status', { wpm: 40 })))
  ;({ progress } = recordCompletion(progress, completion('status', { wpm: 41 })))
  ;({ progress } = recordCompletion(progress, completion('init', { wpm: 60, accuracy: 90, errors: 4 })))

  const stats = progressStats(progress)
  assert.equal(stats.completions, 3)
  assert.equal(stats.uniqueCompleted, 2)
  assert.equal(stats.fastCompletions, 2, 'faster than 40 WPM is a strict threshold')
  assert.equal(stats.bestWpm, 60)
})

test('Centurion and Fiery Typist unlock after 100 qualifying completions', () => {
  let progress = emptyProgress()
  let latestUnlocked = []
  for (let index = 0; index < 100; index += 1) {
    const recorded = recordCompletion(progress, completion('status', { wpm: 41 }))
    progress = recorded.progress
    latestUnlocked = recorded.unlocked
  }

  assert.ok(progress.unlockedAchievements.centurion)
  assert.ok(progress.unlockedAchievements['fiery-typist'])
  assert.deepEqual(latestUnlocked.map((item) => item.title), ['Centurion', 'Fiery Typist'])
})

test('progression recommends milestones without marking later modes ready too early', () => {
  let progress = emptyProgress()
  assert.deepEqual(progressionState(progress, challengeSets).ready, {
    learn: true, execute: false, workflow: false,
  })

  for (const challenge of challengeSets.learn.slice(0, 8)) {
    ;({ progress } = recordCompletion(progress, completion(challenge.id, { mode: 'learn' })))
  }
  let state = progressionState(progress, challengeSets)
  assert.equal(state.recommendedMode, 'execute')
  assert.equal(state.ready.execute, true)
  assert.equal(state.ready.workflow, false)

  for (const challenge of challengeSets.execute.slice(0, 7)) {
    ;({ progress } = recordCompletion(progress, completion(challenge.id, { mode: 'execute' })))
  }
  state = progressionState(progress, challengeSets)
  assert.equal(state.recommendedMode, 'workflow')
  assert.equal(state.ready.workflow, true)
})
