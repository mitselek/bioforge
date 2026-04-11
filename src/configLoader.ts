/**
 * Config file loader stub.
 *
 * `loadConfigFile(path)` reads a JSON file and returns `Partial<Config>`.
 * Throws on bad JSON. Returns `{}` if the file does not exist.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §15.2.
 */

import type { Config } from './core/config.js'

export function loadConfigFile(_path: string): Partial<Config> {
  void _path
  throw new Error('loadConfigFile not yet implemented')
}
