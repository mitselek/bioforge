/**
 * Config file loader tests.
 *
 * Story: Issue #9 — Wire bioforge.config.json to run.ts
 * Test case: 1 of 1 — loadConfigFile behaviour
 *
 * AC1: loadConfigFile(path) reads JSON and returns Partial<Config> (throws on bad JSON)
 * AC2: makeConfig(loadConfigFile(path)) produces a valid Config
 * AC3: If the file doesn't exist, returns {} so defaultConfig() is used (no crash)
 * AC4: Overrides in JSON actually change the resulting Config (e.g. seed)
 *
 * Spec §15.2. Plan: Issue #9.
 *
 * (*BF:Merian*)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { loadConfigFile } from '../src/configLoader.js'
import { makeConfig, defaultConfig } from '../src/core/config.js'

// ── Temp file helpers ─────────────────────────────────────────────────────────

const tmpDir = os.tmpdir()

function tmpPath(name: string): string {
  return path.join(tmpDir, `bioforge-test-${name}.json`)
}

// Paths used across tests — created/removed in beforeAll/afterAll
const VALID_JSON_PATH = tmpPath('valid')
const BAD_JSON_PATH = tmpPath('badjson')
const SEED_OVERRIDE_PATH = tmpPath('seed-override')
const NONEXISTENT_PATH = tmpPath('nonexistent-xyzzy')

beforeAll(() => {
  // Valid empty object — no overrides
  fs.writeFileSync(VALID_JSON_PATH, '{}', 'utf8')
  // Malformed JSON
  fs.writeFileSync(BAD_JSON_PATH, '{ seed: not-valid }', 'utf8')
  // Valid JSON with seed override
  fs.writeFileSync(SEED_OVERRIDE_PATH, JSON.stringify({ seed: 99999 }), 'utf8')
  // Ensure the nonexistent path really doesn't exist
  if (fs.existsSync(NONEXISTENT_PATH)) fs.unlinkSync(NONEXISTENT_PATH)
})

afterAll(() => {
  for (const p of [VALID_JSON_PATH, BAD_JSON_PATH, SEED_OVERRIDE_PATH]) {
    try {
      fs.unlinkSync(p)
    } catch {
      // ignore cleanup errors
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// AC1 — loadConfigFile reads valid JSON and returns Partial<Config>
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #9 AC1 — loadConfigFile reads JSON file', () => {
  it('loadConfigFile is exported from configLoader.ts', () => {
    expect(typeof loadConfigFile).toBe('function')
  })

  it('loadConfigFile({}) returns an object', () => {
    // RED: stub throws instead of reading
    const result = loadConfigFile(VALID_JSON_PATH)
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })

  it('loadConfigFile({}) returns an empty object when JSON is {}', () => {
    const result = loadConfigFile(VALID_JSON_PATH)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('throws on malformed JSON', () => {
    // RED: stub always throws (wrong reason — should throw on bad JSON only)
    expect(() => loadConfigFile(BAD_JSON_PATH)).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — makeConfig(loadConfigFile(path)) produces a valid Config
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #9 AC2 — makeConfig(loadConfigFile(path)) is valid', () => {
  it('produces a Config with a finite seed', () => {
    // RED: loadConfigFile not yet implemented
    const overrides = loadConfigFile(VALID_JSON_PATH)
    const cfg = makeConfig(overrides)
    expect(Number.isFinite(cfg.seed)).toBe(true)
  })

  it('produces a Config with a positive worldW', () => {
    const overrides = loadConfigFile(VALID_JSON_PATH)
    const cfg = makeConfig(overrides)
    expect(cfg.worldW).toBeGreaterThan(0)
  })

  it('produces a Config with a positive baseHz', () => {
    const overrides = loadConfigFile(VALID_JSON_PATH)
    const cfg = makeConfig(overrides)
    expect(cfg.baseHz).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — missing file falls back to defaultConfig() without crashing
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #9 AC3 — missing file returns {} (no crash)', () => {
  it('loadConfigFile on a nonexistent path does not throw', () => {
    // RED: stub throws unconditionally
    expect(() => loadConfigFile(NONEXISTENT_PATH)).not.toThrow()
  })

  it('loadConfigFile on nonexistent path returns an object', () => {
    const result = loadConfigFile(NONEXISTENT_PATH)
    expect(typeof result).toBe('object')
  })

  it('makeConfig(loadConfigFile(nonexistent)) equals defaultConfig()', () => {
    const result = loadConfigFile(NONEXISTENT_PATH)
    const cfg = makeConfig(result)
    const def = defaultConfig()
    // All scalar fields should match
    expect(cfg.worldW).toBe(def.worldW)
    expect(cfg.worldH).toBe(def.worldH)
    expect(cfg.baseHz).toBe(def.baseHz)
    expect(cfg.totalEnergy).toBe(def.totalEnergy)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — JSON overrides actually change the resulting Config
// ─────────────────────────────────────────────────────────────────────────────

describe('Issue #9 AC4 — JSON overrides change resulting Config', () => {
  it('seed override in JSON produces config with that seed', () => {
    // RED: loadConfigFile not yet implemented
    const overrides = loadConfigFile(SEED_OVERRIDE_PATH)
    const cfg = makeConfig(overrides)
    expect(cfg.seed).toBe(99999)
  })

  it('seed from file differs from defaultConfig seed', () => {
    const overrides = loadConfigFile(SEED_OVERRIDE_PATH)
    const cfg = makeConfig(overrides)
    const def = defaultConfig()
    // 99999 is almost certainly not the default seed
    expect(cfg.seed).not.toBe(def.seed)
  })

  it('non-overridden fields retain default values', () => {
    // seed override file only sets seed — worldW should still be default
    const overrides = loadConfigFile(SEED_OVERRIDE_PATH)
    const cfg = makeConfig(overrides)
    const def = defaultConfig()
    expect(cfg.worldW).toBe(def.worldW)
    expect(cfg.baseHz).toBe(def.baseHz)
  })
})
