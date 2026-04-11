/**
 * Config file loader.
 *
 * `loadConfigFile(path)` reads a JSON file and returns `Partial<Config>`.
 * Throws on bad JSON. Returns `{}` if the file does not exist.
 * Clamps ageDeathVariability to [0.05, 0.7] for any species overrides.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §15.2.
 */

import * as fs from 'node:fs'
import type { Config } from './core/config.js'

function clampSpeciesVariability(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw
  const obj = raw as Record<string, unknown>
  if (typeof obj['ageDeathVariability'] !== 'number') return raw
  return {
    ...obj,
    ageDeathVariability: Math.max(0.05, Math.min(0.7, obj['ageDeathVariability'])),
  }
}

export function loadConfigFile(path: string): Partial<Config> {
  try {
    const raw = fs.readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed['species'] === undefined || typeof parsed['species'] !== 'object') {
      return parsed as Partial<Config>
    }
    const sp = parsed['species'] as Record<string, unknown>
    return {
      ...parsed,
      species: Object.fromEntries(
        Object.entries(sp).map(([k, v]) => [k, clampSpeciesVariability(v)]),
      ),
    } as Partial<Config>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw err
  }
}
