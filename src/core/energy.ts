/**
 * Central energy ledger. Every energy movement in the sim goes through `transfer`.
 * Enforces the conservation invariant at compile time (no `void` pool) and, in
 * Cycle 2, at runtime via assertEnergyConserved after every tick.
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
  assertEnergyConserved(): void
  assertFinite(): void
}

const poolKey = (p: EnergyPool): string =>
  p.kind === 'soil' ? 'soil' : `${p.kind}#${String(p.id)}`

export function makeLedger(opts: LedgerOptions): Ledger {
  const epsilon = opts.epsilon ?? 1e-6
  const balances = new Map<string, number>()
  balances.set('soil', opts.initialSoil)

  const get = (pool: EnergyPool): number => {
    return balances.get(poolKey(pool)) ?? 0
  }

  return {
    get,
    totalEnergy(): number {
      let sum = 0
      for (const v of balances.values()) {
        sum += v
      }
      return sum
    },
    register(pool: EnergyPool, initialAmount: number): void {
      const k = poolKey(pool)
      if (balances.has(k)) {
        throw new Error(`ledger: pool ${k} already registered`)
      }
      balances.set(k, initialAmount)
    },
    unregister(pool: EnergyPool): void {
      const k = poolKey(pool)
      const v = balances.get(k)
      if (v === undefined) {
        throw new Error(`ledger: unknown pool ${k}`)
      }
      if (v !== 0) {
        throw new Error(`ledger: cannot unregister non-empty pool ${k} (${String(v)})`)
      }
      balances.delete(k)
    },
    transfer(from: EnergyPool, to: EnergyPool, amount: number): void {
      if (!Number.isFinite(amount)) {
        throw new Error(`ledger: non-finite amount ${String(amount)}`)
      }
      if (amount < 0) {
        throw new Error(`ledger: negative amount ${String(amount)}`)
      }
      if (amount === 0) {
        return
      }
      const fromKey = poolKey(from)
      const toKey = poolKey(to)
      const fromBal = balances.get(fromKey)
      if (fromBal === undefined) {
        throw new Error(`ledger: unknown from pool ${fromKey}`)
      }
      if (fromBal < amount - epsilon) {
        throw new Error(
          `ledger: overdraw ${fromKey} has ${String(fromBal)}, need ${String(amount)}`,
        )
      }
      const toBal = balances.get(toKey)
      if (toBal === undefined) {
        throw new Error(`ledger: unknown to pool ${toKey}`)
      }
      balances.set(fromKey, fromBal - amount)
      balances.set(toKey, toBal + amount)
    },
    assertEnergyConserved(): void {
      throw new Error('energy.assertEnergyConserved: not implemented')
    },
    assertFinite(): void {
      throw new Error('energy.assertFinite: not implemented')
    },
  }
}
