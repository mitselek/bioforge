/**
 * Central energy ledger. Every energy movement in the sim goes through `transfer`.
 * Enforces the conservation invariant at compile time (no `void` pool) and at
 * runtime (assertEnergyConserved after every tick).
 *
 * RED-phase stub — implementation in GREEN.
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §2.
 */

export type EntityId = number
export type CorpseId = number
export type PoopId = number
export type CompostId = number

export type EnergyPool =
  | { readonly kind: 'entity'; readonly id: EntityId }
  | { readonly kind: 'corpse'; readonly id: CorpseId }
  | { readonly kind: 'poop'; readonly id: PoopId }
  | { readonly kind: 'compost'; readonly id: CompostId }
  | { readonly kind: 'soil' }

export interface LedgerOptions {
  readonly totalEnergy: number
  readonly initialSoil: number
  readonly epsilon?: number
}

export interface Ledger {
  get(pool: EnergyPool): number
  totalEnergy(): number
  register(pool: EnergyPool, initialAmount: number): void
  unregister(pool: EnergyPool): void
  transfer(from: EnergyPool, to: EnergyPool, amount: number): void
}

export function makeLedger(opts: LedgerOptions): Ledger {
  throw new Error(
    `energy.makeLedger: not implemented (totalEnergy=${String(opts.totalEnergy)}, initialSoil=${String(opts.initialSoil)})`,
  )
}
