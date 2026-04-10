/**
 * BioForge runner — launches the simulation with a tick loop.
 *
 * Usage: npx tsx src/run.ts
 *
 * (*BF:Humboldt*)
 */

import { startApp } from './main.js'
import { defaultConfig } from './core/config.js'

const cfg = defaultConfig()
const app = startApp()
const { sim, clock } = app

// Tick loop: advance the sim at baseHz, respecting pause and speed
const baseInterval = 1000 / cfg.baseHz

const loop = setInterval(() => {
  if (clock.paused) return
  sim.tick()
}, baseInterval)

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(loop)
  app.quit()
  process.exit(0)
})
