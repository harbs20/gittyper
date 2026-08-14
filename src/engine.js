import { challengeSets, sampleChallenge } from './challenges.js'

export const modeOrder = ['learn', 'execute', 'workflow', 'projects', 'random']

export function compareCommand(expected, entered) {
  const maxLength = Math.max(expected.length, entered.length)
  let errors = 0
  let firstError = -1

  for (let index = 0; index < maxLength; index += 1) {
    if (expected[index] !== entered[index]) {
      errors += 1
      if (firstError === -1) firstError = index
    }
  }

  return {
    correct: entered === expected,
    errors,
    firstError,
    accuracy: maxLength === 0 ? 100 : Math.max(0, Math.round(((maxLength - errors) / maxLength) * 100)),
  }
}

export function createSession(mode = 'learn', challenge) {
  const selected = challenge ?? sampleChallenge(mode)
  return {
    mode,
    challenge: selected,
    step: 0,
    input: '',
    repoState: selected.initial ?? ['working tree ready'],
    feedback: null,
    complete: false,
    showHint: mode === 'learn',
    startedAt: null,
    completedAt: null,
    finalStats: null,
    typed: 0,
    errors: 0,
    attemptRecorded: false,
    completionRecorded: false,
    newAchievements: [],
  }
}

export function sessionStats(session, now = Date.now()) {
  if (!session.startedAt) return { wpm: 0, accuracy: 100 }
  const stoppedAt = session.completedAt ?? now
  const elapsedMinutes = Math.max((stoppedAt - session.startedAt) / 60_000, 1 / 60)
  return {
    wpm: Math.max(1, Math.round((session.typed / 5) / elapsedMinutes)),
    accuracy: session.typed
      ? Math.max(0, Math.round(((session.typed - session.errors) / session.typed) * 100))
      : 100,
  }
}

export function challengeAt(mode, index) {
  const items = challengeSets[mode]
  const wrapped = (index + items.length) % items.length
  return items[wrapped]
}
