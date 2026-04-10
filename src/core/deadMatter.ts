/**
 * Dead matter types: corpse, poop, compost.
 *
 * Each kind has a position, energy, and a branded ID.
 * The registry tracks all instances and provides add/remove/iterate.
 *
 * RED-phase stub — implementation in GREEN.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §4.
 */

import type { Vec2 } from './world.js'

declare const CorpseIdBrand: unique symbol
export type CorpseId = number & { readonly [CorpseIdBrand]: 'CorpseId' }

declare const PoopIdBrand: unique symbol
export type PoopId = number & { readonly [PoopIdBrand]: 'PoopId' }

declare const CompostIdBrand: unique symbol
export type CompostId = number & { readonly [CompostIdBrand]: 'CompostId' }

export interface Corpse {
  readonly id: CorpseId
  readonly position: Vec2
  energy: number
}

export interface Poop {
  readonly id: PoopId
  readonly position: Vec2
  energy: number
}

export interface Compost {
  readonly id: CompostId
  readonly position: Vec2
  energy: number
}

export interface DeadMatterRegistry {
  addCorpse(position: Vec2, energy: number): Corpse | null
  addPoop(position: Vec2, energy: number): Poop
  addCompost(position: Vec2, energy: number): Compost
  removeCorpse(id: CorpseId): void
  removePoop(id: PoopId): void
  removeCompost(id: CompostId): void
  getCorpse(id: CorpseId): Corpse | undefined
  getPoop(id: PoopId): Poop | undefined
  getCompost(id: CompostId): Compost | undefined
  corpses(): Iterable<Corpse>
  poop(): Iterable<Poop>
  compost(): Iterable<Compost>
}

export function makeDeadMatterRegistry(): DeadMatterRegistry {
  throw new Error('deadMatter.makeDeadMatterRegistry: not implemented')
}
