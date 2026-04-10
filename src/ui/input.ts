/**
 * Input handling: keyboard bindings for the blessed terminal UI.
 *
 * `bindKeys(screen, callbacks)` registers all key handlers listed in
 * spec §15.1 onto the given blessed Screen.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §15.1.
 */

import type { Widgets } from 'blessed'

/** Callback interface for all supported key actions. */
export interface KeyCallbacks {
  /** Toggle pause/resume. */
  togglePause(): void
  /** Decrease simulation speed one step. */
  speedDown(): void
  /** Increase simulation speed one step. */
  speedUp(): void
  /** Quit the application. */
  quit(): void
  /** Move selection cursor up. */
  cursorUp(): void
  /** Move selection cursor down. */
  cursorDown(): void
  /** Move selection cursor left. */
  cursorLeft(): void
  /** Move selection cursor right. */
  cursorRight(): void
  /** Cycle selection to the next entity. */
  cycleSelection(): void
  /** Reset the simulation. */
  resetSim(): void
}

/**
 * Bind all key handlers from `callbacks` to the blessed `screen`.
 *
 * Key map (spec §15.1):
 *   space        → togglePause
 *   [            → speedDown
 *   ]            → speedUp
 *   q            → quit
 *   up / k       → cursorUp
 *   down / j     → cursorDown
 *   left / h     → cursorLeft
 *   right / l    → cursorRight
 *   tab          → cycleSelection
 *   r            → resetSim
 */
export function bindKeys(screen: Widgets.Screen, callbacks: KeyCallbacks): void {
  screen.key('space', () => {
    callbacks.togglePause()
  })
  screen.key('[', () => {
    callbacks.speedDown()
  })
  screen.key(']', () => {
    callbacks.speedUp()
  })
  screen.key(['q', 'C-c'], () => {
    callbacks.quit()
  })
  screen.key(['up', 'k'], () => {
    callbacks.cursorUp()
  })
  screen.key(['down', 'j'], () => {
    callbacks.cursorDown()
  })
  screen.key(['left', 'h'], () => {
    callbacks.cursorLeft()
  })
  screen.key(['right', 'l'], () => {
    callbacks.cursorRight()
  })
  screen.key('tab', () => {
    callbacks.cycleSelection()
  })
  screen.key('r', () => {
    callbacks.resetSim()
  })
}
