/**
 * Dead matter types: corpse, poop, compost.
 *
 * Each kind has a position, energy, and a branded ID.
 * The registry tracks all instances and provides add/remove/iterate.
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
  const corpseMap = new Map<CorpseId, Corpse>()
  const poopMap = new Map<PoopId, Poop>()
  const compostMap = new Map<CompostId, Compost>()
  let nextCorpseId = 1
  let nextPoopId = 1
  let nextCompostId = 1

  return {
    addCorpse(position: Vec2, energy: number): Corpse | null {
      if (energy <= 0) return null
      const id = nextCorpseId as CorpseId
      nextCorpseId++
      const corpse: Corpse = { id, position, energy }
      corpseMap.set(id, corpse)
      return corpse
    },
    addPoop(position: Vec2, energy: number): Poop {
      const id = nextPoopId as PoopId
      nextPoopId++
      const poop: Poop = { id, position, energy }
      poopMap.set(id, poop)
      return poop
    },
    addCompost(position: Vec2, energy: number): Compost {
      const id = nextCompostId as CompostId
      nextCompostId++
      const compost: Compost = { id, position, energy }
      compostMap.set(id, compost)
      return compost
    },
    removeCorpse(id: CorpseId): void {
      corpseMap.delete(id)
    },
    removePoop(id: PoopId): void {
      poopMap.delete(id)
    },
    removeCompost(id: CompostId): void {
      compostMap.delete(id)
    },
    getCorpse(id: CorpseId): Corpse | undefined {
      return corpseMap.get(id)
    },
    getPoop(id: PoopId): Poop | undefined {
      return poopMap.get(id)
    },
    getCompost(id: CompostId): Compost | undefined {
      return compostMap.get(id)
    },
    corpses(): Iterable<Corpse> {
      return corpseMap.values()
    },
    poop(): Iterable<Poop> {
      return poopMap.values()
    },
    compost(): Iterable<Compost> {
      return compostMap.values()
    },
  }
}
