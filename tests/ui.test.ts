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

import { describe, it, expect } from 'vitest'

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
