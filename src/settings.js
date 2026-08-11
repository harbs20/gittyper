import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const defaultUiSettings = Object.freeze({
  contrast: 'high',
  color: 'terminal',
  borders: 'ascii',
  hints: 'auto',
  stepSuccess: 'show',
  learnGuide: 'show',
})

const choices = {
  contrast: ['high', 'soft'],
  color: ['terminal', 'green', 'cyan', 'mono'],
  borders: ['ascii', 'unicode'],
  hints: ['auto', 'manual', 'off'],
  stepSuccess: ['show', 'hide'],
  learnGuide: ['show', 'hide'],
}

export function normalizeUiSettings(value = {}) {
  return Object.fromEntries(Object.entries(defaultUiSettings).map(([key, fallback]) => [
    key,
    choices[key].includes(value[key]) ? value[key] : fallback,
  ]))
}

export function settingsPath() {
  return process.env.GITTYPER_CONFIG_PATH || join(homedir(), '.config', 'gittyper', 'settings.json')
}

export async function loadUiSettings(path = settingsPath()) {
  try {
    return normalizeUiSettings(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return { ...defaultUiSettings }
  }
}

export async function saveUiSettings(settings, path = settingsPath()) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(normalizeUiSettings(settings), null, 2)}\n`, { mode: 0o600 })
}
