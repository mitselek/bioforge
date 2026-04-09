import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

// Bootstrap sanity: this file exists and vitest can run it.
// Phase 0 smoke tests will be added here by the RED phase agent
// during Tasks 0.1 onward.
describe('scaffold', () => {
  it('bootstrap: vitest runs this suite', () => {
    expect(true).toBe(true)
  })
})

describe('scaffold: tsconfig strictness', () => {
  it('has strict mode and key strict flags enabled', () => {
    const cfg = JSON.parse(readFileSync('tsconfig.json', 'utf8'))
    expect(cfg.compilerOptions.strict).toBe(true)
    expect(cfg.compilerOptions.noUncheckedIndexedAccess).toBe(true)
    expect(cfg.compilerOptions.exactOptionalPropertyTypes).toBe(true)
  })
})

describe('scaffold: tsconfig extra strict flags', () => {
  it('enforces remaining §12 strict and hygiene flags', () => {
    const cfg = JSON.parse(readFileSync('tsconfig.json', 'utf8'))
    expect(cfg.compilerOptions.noImplicitReturns).toBe(true)
    expect(cfg.compilerOptions.noFallthroughCasesInSwitch).toBe(true)
    expect(cfg.compilerOptions.noImplicitOverride).toBe(true)
    expect(cfg.compilerOptions.noPropertyAccessFromIndexSignature).toBe(true)
    expect(cfg.compilerOptions.noUnusedLocals).toBe(true)
    expect(cfg.compilerOptions.noUnusedParameters).toBe(true)
    expect(cfg.compilerOptions.allowUnreachableCode).toBe(false)
    expect(cfg.compilerOptions.allowUnusedLabels).toBe(false)
    expect(cfg.compilerOptions.isolatedModules).toBe(true)
    expect(cfg.compilerOptions.verbatimModuleSyntax).toBe(true)
    expect(cfg.compilerOptions.forceConsistentCasingInFileNames).toBe(true)
  })
})
