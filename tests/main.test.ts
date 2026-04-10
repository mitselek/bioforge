import { describe, it, expect } from 'vitest'
import { startApp } from '../src/main.js'
import { makeConfig } from '../src/core/config.js'

/**
 * Story 7.1 — Main Entry Point wiring tests.
 *
 * These tests verify that startApp wires sim + clock + callbacks correctly.
 * They do NOT test blessed screen rendering (visual, PO-verified).
 *
 * Spec §10 (tick loop), §14 (UI layout), §15 (key bindings).
 *
 * AC7.1.1: startApp returns an AppHandle with sim, clock, and control methods
 * AC7.1.2: sim ticks forward when unpaused
 * AC7.1.3: space (togglePause) toggles pause state
 * AC7.1.4: speedDown/speedUp adjust clock.speed
 * AC7.1.5: quit callback triggers cleanup without throwing
 * AC7.1.6: selectEntity populates selectedEntity
 */

// Use a small config to keep tests fast — minimal entity count, same seed
const cfg = makeConfig({
  seed: 1,
  initialCounts: { plant: 5, herbivore: 3, carnivore: 1, decomposer: 1 },
  totalEnergy: 5000,
})

// ─── AC7.1.1 — startApp returns a well-formed AppHandle ──────────────────────

describe('AC7.1.1 — startApp returns an AppHandle with required members', () => {
  it('returns an object (not null or undefined)', () => {
    const app = startApp(cfg)
    expect(app).toBeDefined()
    expect(typeof app).toBe('object')
    app.quit()
  })

  it('handle.sim is a Sim with a tick() method', () => {
    const app = startApp(cfg)
    expect(typeof app.sim.tick).toBe('function')
    app.quit()
  })

  it('handle.clock is a Clock with speed and paused properties', () => {
    const app = startApp(cfg)
    expect(typeof app.clock.speed).toBe('number')
    expect(typeof app.clock.paused).toBe('boolean')
    app.quit()
  })

  it('handle exposes pause, resume, togglePause, speedDown, speedUp, selectEntity, quit, resetSim', () => {
    const app = startApp(cfg)
    expect(typeof app.pause).toBe('function')
    expect(typeof app.resume).toBe('function')
    expect(typeof app.togglePause).toBe('function')
    expect(typeof app.speedDown).toBe('function')
    expect(typeof app.speedUp).toBe('function')
    expect(typeof app.selectEntity).toBe('function')
    expect(typeof app.quit).toBe('function')
    expect(typeof app.resetSim).toBe('function')
    app.quit()
  })

  it('startApp works with default config (no argument)', () => {
    const app = startApp()
    expect(app).toBeDefined()
    app.quit()
  })
})

// ─── AC7.1.2 — sim ticks forward when unpaused ───────────────────────────────

describe('AC7.1.2 — sim ticks forward when unpaused', () => {
  it('calling sim.tick() N times advances sim.state.tick', () => {
    const app = startApp(cfg)
    app.resume() // ensure unpaused
    const before = app.sim.state.tick
    app.sim.tick()
    app.sim.tick()
    app.sim.tick()
    expect(app.sim.state.tick).toBe(before + 3)
    app.quit()
  })

  it('clock.advance() does not advance tick when paused', () => {
    const app = startApp(cfg)
    app.pause()
    expect(app.clock.paused).toBe(true)
    const before = app.clock.tick
    app.clock.advance()
    app.clock.advance()
    expect(app.clock.tick).toBe(before) // paused: no advance
    app.quit()
  })

  it('clock.advance() increments tick when resumed', () => {
    const app = startApp(cfg)
    app.resume()
    expect(app.clock.paused).toBe(false)
    const before = app.clock.tick
    app.clock.advance()
    expect(app.clock.tick).toBe(before + 1)
    app.quit()
  })
})

// ─── AC7.1.3 — togglePause toggles pause state ───────────────────────────────

describe('AC7.1.3 — togglePause toggles clock.paused', () => {
  it('togglePause flips paused from false to true', () => {
    const app = startApp(cfg)
    app.resume()
    expect(app.clock.paused).toBe(false)
    app.togglePause()
    expect(app.clock.paused).toBe(true)
    app.quit()
  })

  it('togglePause flips paused from true to false', () => {
    const app = startApp(cfg)
    app.pause()
    expect(app.clock.paused).toBe(true)
    app.togglePause()
    expect(app.clock.paused).toBe(false)
    app.quit()
  })

  it('two togglePause calls restore original state', () => {
    const app = startApp(cfg)
    const initial = app.clock.paused
    app.togglePause()
    app.togglePause()
    expect(app.clock.paused).toBe(initial)
    app.quit()
  })
})

// ─── AC7.1.4 — speedDown/speedUp adjust clock.speed ─────────────────────────

describe('AC7.1.4 — speedDown and speedUp adjust clock.speed', () => {
  it('speedUp increases clock.speed', () => {
    const app = startApp(cfg)
    const before = app.clock.speed
    app.speedUp()
    expect(app.clock.speed).toBeGreaterThan(before)
    app.quit()
  })

  it('speedDown decreases clock.speed', () => {
    const app = startApp(cfg)
    // Ensure speed is above minimum first
    app.speedUp()
    app.speedUp()
    const after2Up = app.clock.speed
    app.speedDown()
    expect(app.clock.speed).toBeLessThan(after2Up)
    app.quit()
  })

  it('speedDown does not go below minimum', () => {
    const app = startApp(cfg)
    // Hammer speedDown many times
    for (let i = 0; i < 20; i++) {
      app.speedDown()
    }
    expect(app.clock.speed).toBeGreaterThan(0)
    app.quit()
  })

  it('speedUp does not exceed maximum', () => {
    const app = startApp(cfg)
    for (let i = 0; i < 20; i++) {
      app.speedUp()
    }
    expect(app.clock.speed).toBeLessThanOrEqual(10)
    app.quit()
  })
})

// ─── AC7.1.5 — quit callback triggers cleanup without throwing ────────────────

describe('AC7.1.5 — quit() completes without throwing', () => {
  it('quit() does not throw', () => {
    const app = startApp(cfg)
    expect(() => {
      app.quit()
    }).not.toThrow()
  })

  it('quit() can be called multiple times without throwing', () => {
    const app = startApp(cfg)
    expect(() => {
      app.quit()
      app.quit()
    }).not.toThrow()
  })
})

// ─── AC7.1.6 — selectEntity populates selectedEntity ─────────────────────────

describe('AC7.1.6 — selectEntity populates selectedEntity for inspector', () => {
  it('selectedEntity is undefined before any selection', () => {
    const app = startApp(cfg)
    expect(app.selectedEntity).toBeUndefined()
    app.quit()
  })

  it('selectEntity with a valid entity ID sets selectedEntity', () => {
    const app = startApp(cfg)
    const ids = [...app.sim.state.entities.keys()]
    expect(ids.length).toBeGreaterThan(0)
    const firstId = ids[0]
    if (firstId !== undefined) {
      app.selectEntity(firstId)
      expect(app.selectedEntity).toBeDefined()
      expect(app.selectedEntity?.id).toBe(firstId)
    }
    app.quit()
  })

  it('selectEntity with an unknown ID sets selectedEntity to undefined', () => {
    const app = startApp(cfg)
    app.selectEntity(999999) // no entity has this ID at startup
    expect(app.selectedEntity).toBeUndefined()
    app.quit()
  })

  it('selectEntity changes selection when called again with a different ID', () => {
    const app = startApp(cfg)
    const ids = [...app.sim.state.entities.keys()]
    if (ids.length >= 2) {
      const id0 = ids[0]
      const id1 = ids[1]
      if (id0 !== undefined && id1 !== undefined) {
        app.selectEntity(id0)
        expect(app.selectedEntity?.id).toBe(id0)
        app.selectEntity(id1)
        expect(app.selectedEntity?.id).toBe(id1)
      }
    }
    app.quit()
  })
})
