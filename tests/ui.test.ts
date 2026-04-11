/**
 * UI module tests — layout config registry and applyLayout.
 *
 * Story: Layout System Rework
 * AC1: LayoutConfig type + LAYOUTS registry + applyLayout function
 *
 * AC1.1: LayoutConfig type has fields for 6 panels (world, hud, miniHud, pop,
 *        inspector, genome), each with top/left/width/height
 * AC1.2: LAYOUTS object has keys LAYOUT_1, LAYOUT_2, LAYOUT_ZEN, LAYOUT_FS
 * AC1.3: applyLayout(boxes, name, screenW, screenH) is a callable function
 * AC1.4: Hidden panels in a config have width=0 or height=0
 *
 * Spec §14: UI layout.
 * Plan: ~/.claude/plans/jolly-zooming-twilight.md §AC1
 *
 * (*BF:Merian*)
 */

import { describe, it, expect, assert, beforeEach } from 'vitest'
import { renderInspector } from '../src/ui/inspector.js'
import { entityId, makeEntity } from '../src/core/entity.js'
import type { Entity } from '../src/core/entity.js'
import { ASCII_THEME } from '../src/ui/theme.js'
import { defaultConfig } from '../src/core/config.js'

// ── Type stub ────────────────────────────────────────────────────────────────
// src/ui/layouts.ts does not exist yet (RED). We import speculatively and cast
// through unknown so tsc does not error on the missing module. At runtime the
// dynamic import will resolve to an empty object, causing the assertions to
// fail with clear "expected X to be Y" messages.

interface PanelConfig {
  top: number | string
  left: number | string
  width: number | string
  height: number | string
}

interface LayoutConfig {
  world: PanelConfig
  hud: PanelConfig
  miniHud: PanelConfig
  pop: PanelConfig
  inspector: PanelConfig
  genome: PanelConfig
}

type LayoutName = 'LAYOUT_1' | 'LAYOUT_2' | 'LAYOUT_ZEN' | 'LAYOUT_FS'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let layoutsModule: Record<string, any> = {}
try {
  layoutsModule = (await import('../src/ui/layouts.js')) as Record<string, unknown>
} catch {
  layoutsModule = {}
}

const LAYOUTS: Partial<Record<LayoutName, LayoutConfig>> = layoutsModule['LAYOUTS'] ?? {}

const applyLayout: unknown = layoutsModule['applyLayout'] ?? undefined

// ─────────────────────────────────────────────────────────────────────────────
// AC1.2 — LAYOUTS registry keys
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1.2 — LAYOUTS registry has required layout names', () => {
  const expectedNames: LayoutName[] = ['LAYOUT_1', 'LAYOUT_2', 'LAYOUT_ZEN', 'LAYOUT_FS']

  it('LAYOUTS is exported from layouts.ts', () => {
    expect(layoutsModule['LAYOUTS']).toBeDefined()
  })

  for (const name of expectedNames) {
    it(`LAYOUTS has key '${name}'`, () => {
      expect(LAYOUTS).toHaveProperty(name)
    })
  }

  it('LAYOUTS has exactly 4 keys', () => {
    const keys = Object.keys(LAYOUTS).sort()
    expect(keys).toEqual(['LAYOUT_1', 'LAYOUT_2', 'LAYOUT_FS', 'LAYOUT_ZEN'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC1.1 — LayoutConfig shape: 6 panels each with top/left/width/height
// ─────────────────────────────────────────────────────────────────────────────

const PANEL_FIELDS = ['top', 'left', 'width', 'height'] as const
const PANEL_NAMES = ['world', 'hud', 'miniHud', 'pop', 'inspector', 'genome'] as const

describe('AC1.1 — each LAYOUTS entry has 6 panels with top/left/width/height', () => {
  const layoutNames: LayoutName[] = ['LAYOUT_1', 'LAYOUT_2', 'LAYOUT_ZEN', 'LAYOUT_FS']

  for (const layoutName of layoutNames) {
    for (const panel of PANEL_NAMES) {
      it(`${layoutName}.${panel} exists`, () => {
        const cfg = LAYOUTS[layoutName]
        expect(cfg).toBeDefined()
        expect(cfg).toHaveProperty(panel)
      })

      for (const field of PANEL_FIELDS) {
        it(`${layoutName}.${panel}.${field} is defined`, () => {
          const cfg = LAYOUTS[layoutName]
          expect(cfg).toBeDefined()
          const panelCfg = cfg?.[panel as keyof LayoutConfig]
          expect(panelCfg).toBeDefined()
          expect(panelCfg).toHaveProperty(field)
          // Must be a number or a non-empty string expression
          const val = panelCfg?.[field as keyof PanelConfig]
          expect(typeof val === 'number' || typeof val === 'string').toBe(true)
        })
      }
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// AC1.3 — applyLayout is a callable function
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1.3 — applyLayout is exported and callable', () => {
  it('applyLayout is exported from layouts.ts', () => {
    expect(layoutsModule['applyLayout']).toBeDefined()
  })

  it('applyLayout is a function', () => {
    expect(typeof applyLayout).toBe('function')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC1.4 — Hidden panels have width=0 or height=0
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1.4 — hidden panels in a config have width=0 or height=0', () => {
  // LAYOUT_ZEN: all panels except world are hidden per plan
  const hiddenInZen: (keyof LayoutConfig)[] = ['hud', 'miniHud', 'pop', 'inspector', 'genome']

  for (const panel of hiddenInZen) {
    it(`LAYOUT_ZEN.${panel} has width=0 or height=0 (hidden)`, () => {
      const cfg = LAYOUTS.LAYOUT_ZEN
      expect(cfg).toBeDefined()
      const panelCfg = cfg?.[panel]
      expect(panelCfg).toBeDefined()
      const isHidden = panelCfg?.width === 0 || panelCfg?.height === 0
      expect(isHidden).toBe(true)
    })
  }

  // LAYOUT_FS: hud, pop, inspector, genome are hidden; miniHud is visible
  const hiddenInFs: (keyof LayoutConfig)[] = ['hud', 'pop', 'inspector', 'genome']

  for (const panel of hiddenInFs) {
    it(`LAYOUT_FS.${panel} has width=0 or height=0 (hidden)`, () => {
      const cfg = LAYOUTS.LAYOUT_FS
      expect(cfg).toBeDefined()
      const panelCfg = cfg?.[panel]
      expect(panelCfg).toBeDefined()
      const isHidden = panelCfg?.width === 0 || panelCfg?.height === 0
      expect(isHidden).toBe(true)
    })
  }

  // LAYOUT_FS: miniHud IS visible (non-zero dimensions)
  it('LAYOUT_FS.miniHud has non-zero width and height (visible)', () => {
    const cfg = LAYOUTS.LAYOUT_FS
    expect(cfg).toBeDefined()
    const miniHud = cfg?.miniHud
    expect(miniHud).toBeDefined()
    expect(miniHud?.width).not.toBe(0)
    expect(miniHud?.height).not.toBe(0)
  })

  // LAYOUT_ZEN: world IS visible (non-zero dimensions)
  it('LAYOUT_ZEN.world has non-zero width and height (fullscreen)', () => {
    const cfg = LAYOUTS.LAYOUT_ZEN
    expect(cfg).toBeDefined()
    const world = cfg?.world
    expect(world).toBeDefined()
    expect(world?.width).not.toBe(0)
    expect(world?.height).not.toBe(0)
  })

  // LAYOUT_1 and LAYOUT_2: miniHud is hidden (not in those layouts)
  const noMiniHudLayouts: LayoutName[] = ['LAYOUT_1', 'LAYOUT_2']
  for (const layoutName of noMiniHudLayouts) {
    it(`${layoutName}.miniHud has width=0 or height=0 (not used in this layout)`, () => {
      const cfg = LAYOUTS[layoutName]
      expect(cfg).toBeDefined()
      const miniHud = cfg?.miniHud
      expect(miniHud).toBeDefined()
      const isHidden = miniHud?.width === 0 || miniHud?.height === 0
      expect(isHidden).toBe(true)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// AC1 — Spot-check specific config values from the plan
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1 — spot-check plan-specified panel dimensions', () => {
  // Plan: HUD is 24w in LAYOUT_1
  it('LAYOUT_1.hud.width is 24', () => {
    expect(LAYOUTS.LAYOUT_1?.hud.width).toBe(24)
  })

  // Plan: Genome is 32w × 18h in LAYOUT_1
  it('LAYOUT_1.genome.width is 32', () => {
    expect(LAYOUTS.LAYOUT_1?.genome.width).toBe(32)
  })

  it('LAYOUT_1.genome.height is 18', () => {
    expect(LAYOUTS.LAYOUT_1?.genome.height).toBe(18)
  })

  // Plan: HUD is 24w in LAYOUT_2
  it('LAYOUT_2.hud.width is 24', () => {
    expect(LAYOUTS.LAYOUT_2?.hud.width).toBe(24)
  })

  // Plan: Genome is 32w × 18h in LAYOUT_2
  it('LAYOUT_2.genome.width is 32', () => {
    expect(LAYOUTS.LAYOUT_2?.genome.width).toBe(32)
  })

  it('LAYOUT_2.genome.height is 18', () => {
    expect(LAYOUTS.LAYOUT_2?.genome.height).toBe(18)
  })

  // Plan: Mini HUD is 6w × 4h in LAYOUT_FS
  it('LAYOUT_FS.miniHud.width is 6', () => {
    expect(LAYOUTS.LAYOUT_FS?.miniHud.width).toBe(6)
  })

  it('LAYOUT_FS.miniHud.height is 4', () => {
    expect(LAYOUTS.LAYOUT_FS?.miniHud.height).toBe(4)
  })
})

// =============================================================================
// AC2 — Genome panel breakout
// =============================================================================
//
// AC2.1: renderGenome(entity) returns string lines with tape + IP marker
// AC2.2: renderGenome(undefined) returns a placeholder
// AC2.3: renderInspector output does NOT contain opcode names
// AC2.4: renderInspector still shows ID, species, age/lifespan, energy, sense
//
// Spec §14. Plan: ~/.claude/plans/jolly-zooming-twilight.md §AC2
//
// (*BF:Merian*)
// =============================================================================

// ── Speculative import of renderGenome ───────────────────────────────────────
// renderGenome is not yet exported. It may end up in inspector.ts or a new
// genome.ts — Linnaeus's call. We probe inspector.ts first; GREEN must export
// it from there (or re-export from inspector.ts if placed in genome.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inspectorModule = (await import('../src/ui/inspector.js')) as Record<string, any>
type RenderGenomeFn = (entity: Entity | undefined) => string[]

function isRenderGenomeFn(v: unknown): v is RenderGenomeFn {
  return typeof v === 'function'
}

const renderGenomeRaw: unknown = inspectorModule['renderGenome'] ?? undefined
const renderGenome: RenderGenomeFn | undefined = isRenderGenomeFn(renderGenomeRaw)
  ? renderGenomeRaw
  : undefined

// ── Entity fixture for AC2 tests ─────────────────────────────────────────────

const _cfg = defaultConfig()

/** Herbivore with a 3-instruction genome. ip=1 points to TURN_LEFT. */
function makeAc2Entity(): Entity {
  return makeEntity({
    id: entityId(99),
    species: 'herbivore',
    position: { x: 5, y: 5 },
    orientation: 0,
    energy: 200.0,
    lifespan: 1000,
    maturityAge: 200,
    genome: {
      tape: [
        { op: 'MOVE_FORWARD' as const, arg1: 0.5 },
        { op: 'TURN_LEFT' as const, arg1: 0.25 },
        { op: 'REPRODUCE' as const, arg1: 0.8 },
      ],
      ip: 1,
    },
    stats: _cfg.species.herbivore,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// AC2.1 — renderGenome returns tape lines with IP marker
// ─────────────────────────────────────────────────────────────────────────────

describe('AC2.1 — renderGenome returns tape lines with IP marker', () => {
  let entity: Entity

  beforeEach(() => {
    entity = makeAc2Entity()
  })

  it('renderGenome is exported from inspector.ts', () => {
    // RED: fails until GREEN exports renderGenome
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
  })

  it('returns an array of strings', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const lines = renderGenome(entity)
    expect(Array.isArray(lines)).toBe(true)
    lines.forEach((l) => {
      expect(typeof l).toBe('string')
    })
  })

  it('output contains at least one line per tape instruction', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const lines = renderGenome(entity)
    expect(lines.length).toBeGreaterThanOrEqual(entity.genome.tape.length)
  })

  it('output contains the IP marker ">"', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const lines = renderGenome(entity)
    const hasMarker = lines.some((l) => l.includes('>'))
    expect(hasMarker).toBe(true)
  })

  it('exactly one line contains the IP marker ">"', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const lines = renderGenome(entity)
    const markerCount = lines.filter((l) => l.includes('>')).length
    expect(markerCount).toBe(1)
  })

  it('the IP-marked line contains the opcode at ip=1 (TURN_LEFT)', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const lines = renderGenome(entity)
    const markedLine = lines.find((l) => l.includes('>'))
    expect(markedLine).toBeDefined()
    expect(markedLine).toContain('TURN_LEFT')
  })

  it('output contains all three opcodes from the tape', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const joined = renderGenome(entity).join('\n')
    expect(joined).toContain('MOVE_FORWARD')
    expect(joined).toContain('TURN_LEFT')
    expect(joined).toContain('REPRODUCE')
  })

  it('non-IP lines do not contain ">"', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const lines = renderGenome(entity)
    // tape[0]=MOVE_FORWARD and tape[2]=REPRODUCE are not at ip=1
    const moveForwardLine = lines.find((l) => l.includes('MOVE_FORWARD'))
    const reproduceLine = lines.find((l) => l.includes('REPRODUCE'))
    expect(moveForwardLine).toBeDefined()
    expect(reproduceLine).toBeDefined()
    expect(moveForwardLine).not.toContain('>')
    expect(reproduceLine).not.toContain('>')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC2.2 — renderGenome(undefined) returns a placeholder
// ─────────────────────────────────────────────────────────────────────────────

describe('AC2.2 — renderGenome(undefined) returns a placeholder', () => {
  it('returns a non-empty array for undefined entity', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const lines = renderGenome(undefined)
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('placeholder contains no opcode names', () => {
    assert(renderGenome !== undefined, 'renderGenome not yet exported — GREEN must export it')
    const joined = renderGenome(undefined).join('\n')
    const opcodes = ['MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'REPRODUCE', 'SENSE_FOOD']
    opcodes.forEach((op) => {
      expect(joined).not.toContain(op)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC2.3 — renderInspector output does NOT contain opcodes
// ─────────────────────────────────────────────────────────────────────────────

describe('AC2.3 — renderInspector output does NOT contain instruction opcodes', () => {
  let entity: Entity

  beforeEach(() => {
    entity = makeAc2Entity()
  })

  const allOpcodes = [
    'MOVE_FORWARD',
    'TURN_LEFT',
    'TURN_RIGHT',
    'SENSE_FOOD',
    'SENSE_PREDATOR',
    'SENSE_MATE',
    'JUMP_IF_TRUE',
    'JUMP_IF_FALSE',
    'REPRODUCE',
  ] as const

  for (const opcode of allOpcodes) {
    it(`renderInspector output does not contain '${opcode}'`, () => {
      const lines = renderInspector(entity, ASCII_THEME)
      const joined = lines.join('\n')
      expect(joined).not.toContain(opcode)
    })
  }

  it('renderInspector output does not contain the IP marker ">"', () => {
    const lines = renderInspector(entity, ASCII_THEME)
    const hasIp = lines.some((l) => l.includes('>'))
    expect(hasIp).toBe(false)
  })

  it('renderInspector output does not contain "Genome"', () => {
    const lines = renderInspector(entity, ASCII_THEME)
    const joined = lines.join('\n')
    expect(joined).not.toContain('Genome')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC2.4 — renderInspector still shows entity summary fields
// ─────────────────────────────────────────────────────────────────────────────

describe('AC2.4 — renderInspector still shows ID, species, age, energy, sense', () => {
  let entity: Entity

  beforeEach(() => {
    entity = makeAc2Entity()
  })

  it('output contains "ID:"', () => {
    const joined = renderInspector(entity, ASCII_THEME).join('\n')
    expect(joined).toContain('ID:')
  })

  it('output contains "Species:"', () => {
    const joined = renderInspector(entity, ASCII_THEME).join('\n')
    expect(joined).toContain('Species:')
  })

  it('output contains "Age:"', () => {
    const joined = renderInspector(entity, ASCII_THEME).join('\n')
    expect(joined).toContain('Age:')
  })

  it('output contains "Energy:"', () => {
    const joined = renderInspector(entity, ASCII_THEME).join('\n')
    expect(joined).toContain('Energy:')
  })

  it('output contains "Sense:"', () => {
    const joined = renderInspector(entity, ASCII_THEME).join('\n')
    expect(joined).toContain('Sense:')
  })

  it('returns placeholder for undefined entity (no crash)', () => {
    const lines = renderInspector(undefined, ASCII_THEME)
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBeGreaterThan(0)
  })
})
