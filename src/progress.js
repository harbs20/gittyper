import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const progressVersion = 1

export const achievements = Object.freeze([
  { id: 'first-objective', title: 'First Steps', description: 'Complete your first objective.', target: 1, counter: 'completions' },
  { id: 'branching-out', title: 'Branching Out', description: 'Master 10 different objectives.', target: 10, counter: 'uniqueCompleted' },
  { id: 'precision-craft', title: 'Precision Craft', description: 'Complete 25 objectives with 100% accuracy.', target: 25, counter: 'perfectCompletions' },
  { id: 'repository-ranger', title: 'Repository Ranger', description: 'Master 50 different objectives.', target: 50, counter: 'uniqueCompleted' },
  { id: 'centurion', title: 'Centurion', description: 'Complete 100 objectives.', target: 100, counter: 'completions' },
  { id: 'fiery-typist', title: 'Fiery Typist', description: 'Complete 100 objectives faster than 40 WPM.', target: 100, counter: 'fastCompletions' },
  { id: 'complete-mastery', title: 'Complete Mastery', description: 'Master all 100 built-in objectives.', target: 100, counter: 'uniqueCompleted' },
])

const emptyTotals = Object.freeze({
  attempts: 0,
  completions: 0,
  fastCompletions: 0,
  perfectCompletions: 0,
  typed: 0,
  errors: 0,
  durationMs: 0,
  wpmTotal: 0,
  bestWpm: 0,
})

function number(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function integer(value, fallback = 0) {
  return Math.floor(number(value, fallback))
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function normalizePerformance(value) {
  if (!value || typeof value !== 'object') return null
  return {
    wpm: integer(value.wpm),
    accuracy: Math.min(100, integer(value.accuracy, 100)),
    durationMs: integer(value.durationMs),
    typed: integer(value.typed),
    errors: integer(value.errors),
    completedAt: text(value.completedAt),
  }
}

function normalizeChallenge(value = {}) {
  const completions = integer(value.completions)
  return {
    mode: text(value.mode),
    title: text(value.title),
    attempts: Math.max(completions, integer(value.attempts)),
    completions,
    firstAttemptedAt: text(value.firstAttemptedAt),
    lastAttemptedAt: text(value.lastAttemptedAt),
    firstCompletedAt: text(value.firstCompletedAt),
    lastCompletedAt: text(value.lastCompletedAt),
    bestWpm: integer(value.bestWpm),
    bestAccuracy: Math.min(100, integer(value.bestAccuracy)),
    fastestDurationMs: integer(value.fastestDurationMs),
    last: normalizePerformance(value.last),
  }
}

export function emptyProgress() {
  return {
    version: progressVersion,
    totals: { ...emptyTotals },
    challenges: {},
    unlockedAchievements: {},
  }
}

export function normalizeProgress(value = {}) {
  const progress = emptyProgress()
  if (!value || typeof value !== 'object') return progress

  const rawChallenges = value.challenges && typeof value.challenges === 'object' ? value.challenges : {}
  for (const [id, challenge] of Object.entries(rawChallenges)) {
    if (!id || !challenge || typeof challenge !== 'object') continue
    progress.challenges[id] = normalizeChallenge(challenge)
  }

  const totals = value.totals && typeof value.totals === 'object' ? value.totals : {}
  for (const key of Object.keys(emptyTotals)) progress.totals[key] = integer(totals[key])

  const minimumCompletions = Object.values(progress.challenges)
    .reduce((sum, challenge) => sum + challenge.completions, 0)
  const minimumAttempts = Object.values(progress.challenges)
    .reduce((sum, challenge) => sum + challenge.attempts, 0)
  progress.totals.completions = Math.max(progress.totals.completions, minimumCompletions)
  progress.totals.attempts = Math.max(progress.totals.attempts, minimumAttempts)

  const unlocked = value.unlockedAchievements && typeof value.unlockedAchievements === 'object'
    ? value.unlockedAchievements
    : {}
  for (const [id, unlockedAt] of Object.entries(unlocked)) {
    if (typeof unlockedAt === 'string') progress.unlockedAchievements[id] = unlockedAt
  }
  return progress
}

export function progressPath() {
  if (process.env.GITTYPER_PROGRESS_PATH) return process.env.GITTYPER_PROGRESS_PATH
  const dataRoot = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  return join(dataRoot, 'gittyper', 'progress.json')
}

export async function loadProgress(path = progressPath()) {
  try {
    return normalizeProgress(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return emptyProgress()
  }
}

export async function saveProgress(progress, path = progressPath()) {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(normalizeProgress(progress), null, 2)}\n`, { mode: 0o600 })
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => {})
    throw error
  }
}

function challengeRecord(progress, result) {
  const existing = progress.challenges[result.id] ?? {}
  return normalizeChallenge({
    ...existing,
    mode: result.mode || existing.mode,
    title: result.title || existing.title,
  })
}

export function recordAttempt(value, result) {
  const progress = normalizeProgress(value)
  const attemptedAt = result.attemptedAt || new Date().toISOString()
  const challenge = challengeRecord(progress, result)
  challenge.attempts += 1
  challenge.firstAttemptedAt ||= attemptedAt
  challenge.lastAttemptedAt = attemptedAt
  progress.challenges[result.id] = challenge
  progress.totals.attempts += 1
  return progress
}

export function achievementProgress(progress, achievement) {
  if (achievement.counter === 'uniqueCompleted') {
    return Object.values(progress.challenges).filter((challenge) => challenge.completions > 0).length
  }
  return progress.totals[achievement.counter] ?? 0
}

function unlockAchievements(progress, unlockedAt) {
  const unlocked = []
  for (const achievement of achievements) {
    if (progress.unlockedAchievements[achievement.id]) continue
    if (achievementProgress(progress, achievement) < achievement.target) continue
    progress.unlockedAchievements[achievement.id] = unlockedAt
    unlocked.push(achievement)
  }
  return unlocked
}

export function recordCompletion(value, result) {
  const progress = normalizeProgress(value)
  const completedAt = result.completedAt || new Date().toISOString()
  const performance = normalizePerformance({ ...result, completedAt })
  const challenge = challengeRecord(progress, result)
  if (challenge.attempts <= challenge.completions) {
    challenge.attempts += 1
    progress.totals.attempts += 1
  }
  challenge.completions += 1
  challenge.firstCompletedAt ||= completedAt
  challenge.lastCompletedAt = completedAt
  challenge.bestWpm = Math.max(challenge.bestWpm, performance.wpm)
  challenge.bestAccuracy = Math.max(challenge.bestAccuracy, performance.accuracy)
  challenge.fastestDurationMs = challenge.fastestDurationMs
    ? Math.min(challenge.fastestDurationMs, performance.durationMs)
    : performance.durationMs
  challenge.last = performance
  progress.challenges[result.id] = challenge

  progress.totals.completions += 1
  progress.totals.fastCompletions += performance.wpm > 40 ? 1 : 0
  progress.totals.perfectCompletions += performance.accuracy === 100 ? 1 : 0
  progress.totals.typed += performance.typed
  progress.totals.errors += performance.errors
  progress.totals.durationMs += performance.durationMs
  progress.totals.wpmTotal += performance.wpm
  progress.totals.bestWpm = Math.max(progress.totals.bestWpm, performance.wpm)

  return { progress, unlocked: unlockAchievements(progress, completedAt) }
}

export function progressStats(value) {
  const progress = normalizeProgress(value)
  const { totals } = progress
  return {
    ...totals,
    uniqueCompleted: Object.values(progress.challenges).filter((challenge) => challenge.completions > 0).length,
    averageWpm: totals.completions ? Math.round(totals.wpmTotal / totals.completions) : 0,
    accuracy: totals.typed ? Math.max(0, Math.round(((totals.typed - totals.errors) / totals.typed) * 100)) : 100,
  }
}

export function progressionState(value, challengeSets) {
  const progress = normalizeProgress(value)
  const completedIds = new Set(Object.entries(progress.challenges)
    .filter(([, challenge]) => challenge.completions > 0)
    .map(([id]) => id))
  const count = (mode) => challengeSets[mode].filter((challenge) => completedIds.has(challenge.id)).length
  const mastered = { learn: count('learn'), execute: count('execute'), workflow: count('workflow') }
  const targets = {
    learn: Math.min(8, challengeSets.learn.length),
    execute: Math.min(7, challengeSets.execute.length),
    workflow: challengeSets.workflow.length,
  }
  const ready = {
    learn: true,
    execute: mastered.learn >= targets.learn,
    workflow: mastered.learn >= targets.learn && mastered.execute >= targets.execute,
  }
  const recommendedMode = !ready.execute ? 'learn' : !ready.workflow ? 'execute' : 'workflow'
  return { mastered, targets, ready, recommendedMode }
}
