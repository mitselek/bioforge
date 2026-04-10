/**
 * Sensing: SENSE_FOOD / SENSE_PREDATOR / SENSE_MATE world queries.
 *
 * Finds the nearest matching target within a cone (spread x range)
 * of the querying entity's heading. Returns a SenseResult.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §7.5.
 */

import { NO_SENSE } from './entity.js'
import type { SenseResult } from './entity.js'
import type { SpatialIndex } from './physics.js'
import type { Species } from './config.js'
import { torusDistance, torusBearing, normalizeAngle } from './world.js'

/** Which species counts as food for each querier species. */
const FOOD_TARGET: Readonly<Record<Species, Species | null>> = {
  plant: null,
  herbivore: 'plant',
  carnivore: 'herbivore',
  decomposer: null,
}

/** Which species counts as a predator for each querier species. */
const PREDATOR_TARGET: Readonly<Record<Species, Species | null>> = {
  plant: 'herbivore',
  herbivore: 'carnivore',
  carnivore: null,
  decomposer: null,
}

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
  const {
    kind,
    querierPosition,
    querierOrientation,
    querierSpecies,
    spread,
    range,
    index,
    getEntity,
    worldW,
    worldH,
  } = args

  const notDetected: SenseResult = { ...NO_SENSE, kind, spread, range }

  // Determine the target species for this query kind.
  let targetSpecies: Species | null
  if (kind === 'food') {
    targetSpecies = FOOD_TARGET[querierSpecies]
  } else if (kind === 'predator') {
    targetSpecies = PREDATOR_TARGET[querierSpecies]
  } else {
    // 'mate' — same species
    targetSpecies = querierSpecies
  }

  // If no valid target exists for this species+kind, return not-detected.
  if (targetSpecies === null) {
    return notDetected
  }

  const halfSpread = spread / 2

  let bestDist = Infinity
  let bestAngle = 0

  for (const candidateId of index.queryRadius(querierPosition, range)) {
    const entity = getEntity(candidateId)
    if (entity === undefined) continue
    if (entity.species !== targetSpecies) continue

    const dist = torusDistance(querierPosition, entity.position, worldW, worldH)

    // Skip self (distance === 0) and out-of-range.
    if (dist === 0) continue
    if (dist > range) continue

    const bearing = torusBearing(querierPosition, entity.position, worldW, worldH)
    const relative = normalizeAngle(bearing - querierOrientation)

    // Cone check: relative angle must be within ±halfSpread.
    if (Math.abs(relative) > halfSpread) continue

    if (dist < bestDist) {
      bestDist = dist
      bestAngle = relative
    }
  }

  if (bestDist === Infinity) {
    return notDetected
  }

  // Avoid exactly-zero angle for directly-ahead targets.
  if (bestAngle === 0) bestAngle = 1e-9

  return {
    kind,
    angle: bestAngle,
    distance: bestDist,
    detected: true,
    spread,
    range,
  }
}
