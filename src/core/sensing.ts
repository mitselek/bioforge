/**
 * Sensing: SENSE_FOOD / SENSE_PREDATOR / SENSE_MATE world queries.
 *
 * Finds the nearest matching target within a cone (spread x range)
 * of the querying entity's heading. Returns a SenseResult.
 *
 * RED-phase stub — implementation in GREEN.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §7.5.
 */

import type { SenseResult } from './entity.js'
import type { SpatialIndex } from './physics.js'
import type { Species } from './config.js'

export interface SenseArgs {
  readonly kind: 'food' | 'predator' | 'mate'
  readonly querierPosition: { readonly x: number; readonly y: number }
  readonly querierOrientation: number
  readonly querierSpecies: Species
  readonly spread: number
  readonly range: number
  readonly index: SpatialIndex
  readonly getEntity: (
    id: number,
  ) => { species: Species; position: { readonly x: number; readonly y: number } } | undefined
  readonly worldW: number
  readonly worldH: number
}

export function sense(args: SenseArgs): SenseResult {
  throw new Error(
    `sensing.sense: not implemented (kind=${args.kind} species=${args.querierSpecies})`,
  )
}
