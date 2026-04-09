import { existsSync, readFileSync } from 'node:fs'
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

describe('scaffold: vitest coverage config', () => {
  it('has v8 coverage provider with 95% line threshold on src/core/', () => {
    const content = readFileSync('vitest.config.ts', 'utf8')
    expect(content).toContain("provider: 'v8'")
    expect(content).toContain('lines: 95')
    expect(content).toContain("include: ['src/core/**/*.ts']")
  })

  it('excludes src/ui/ from coverage', () => {
    const content = readFileSync('vitest.config.ts', 'utf8')
    expect(content).toMatch(/exclude:\s*\[[^\]]*'src\/ui\/\*\*'/)
  })
})

describe('scaffold: eslint config', () => {
  it('eslint.config.js exists', () => {
    expect(existsSync('eslint.config.js')).toBe(true)
  })

  it('forbids any type', () => {
    const content = readFileSync('eslint.config.js', 'utf8')
    expect(content).toMatch(/@typescript-eslint\/no-explicit-any['"]\s*:\s*['"]error/)
  })

  it('enforces switch exhaustiveness', () => {
    const content = readFileSync('eslint.config.js', 'utf8')
    expect(content).toMatch(/@typescript-eslint\/switch-exhaustiveness-check['"]\s*:\s*['"]error/)
  })

  it('forbids core -> ui imports (architecture boundary)', () => {
    const content = readFileSync('eslint.config.js', 'utf8')
    expect(content).toMatch(/no-restricted-imports/)
    expect(content).toMatch(/ui/)
  })

  it('forbids Math.random in src/core/ (purity)', () => {
    const content = readFileSync('eslint.config.js', 'utf8')
    expect(content).toMatch(/no-restricted-syntax/)
    expect(content).toMatch(/Math['"]?\s*\]?\s*[,.].*random/i)
  })
})

describe('scaffold: prettier config', () => {
  it('.prettierrc exists', () => {
    expect(existsSync('.prettierrc')).toBe(true)
  })

  it('has the expected style settings', () => {
    const cfg = JSON.parse(readFileSync('.prettierrc', 'utf8'))
    expect(cfg.semi).toBe(false)
    expect(cfg.singleQuote).toBe(true)
    expect(cfg.trailingComma).toBe('all')
    expect(cfg.printWidth).toBe(100)
    expect(cfg.tabWidth).toBe(2)
    expect(cfg.arrowParens).toBe('always')
  })

  it('.prettierignore exists', () => {
    expect(existsSync('.prettierignore')).toBe(true)
  })

  it('package.json has format and format:check scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.scripts.format).toMatch(/prettier.*--write/)
    expect(pkg.scripts['format:check']).toMatch(/prettier.*--check/)
  })
})
