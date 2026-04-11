/**
 * Config file loader.
 *
 * `loadConfigFile(path)` reads a JSON file and returns `Partial<Config>`.
 * Throws on bad JSON. Returns `{}` if the file does not exist.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §15.2.
 */

import * as fs from 'node:fs'
import type { Config } from './core/config.js'

export function loadConfigFile(path: string): Partial<Config> {
  try {
    const raw = fs.readFileSync(path, 'utf8')
    return JSON.parse(raw) as Partial<Config>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw err
  }
}
