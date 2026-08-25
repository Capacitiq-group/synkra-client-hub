/**
 * Execution top-up packs (client-safe, pure).
 *
 * A NEW purchasable kind that lives alongside the existing add-ons in
 * `./addons` — the add-on catalogue is deliberately untouched. The difference
 * that justifies its own module: executions are sold as fixed packs with fixed
 * pack prices (not a single unit price times a pack count), and the credit is a
 * standing balance that never expires with the billing month.
 *
 * Published prices — do not alter:
 *     250 executions   R50    (R0.20 / execution)
 *   1,000 executions   R150   (R0.15 / execution)
 *   5,000 executions   R500   (R0.10 / execution)
 *  10,000 executions   R800   (R0.08 / execution)
 *  25,000 executions   R1,500 (R0.06 / execution)
 */

export const EXECUTION_PACK_IDS = [
  "exec_250",
  "exec_1000",
  "exec_5000",
  "exec_10000",
  "exec_25000",
] as const;

export type ExecutionPackId = (typeof EXECUTION_PACK_IDS)[number];

export interface ExecutionPack {
  id: ExecutionPackId;
  /** Executions granted by one pack. */
  executions: number;
  /** Fixed pack price in ZAR rand. */
  priceZar: number;
}

export const EXECUTION_PACKS: Record<ExecutionPackId, ExecutionPack> = {
  exec_250: { id: "exec_250", executions: 250, priceZar: 50 },
  exec_1000: { id: "exec_1000", executions: 1000, priceZar: 150 },
  exec_5000: { id: "exec_5000", executions: 5000, priceZar: 500 },
  exec_10000: { id: "exec_10000", executions: 10000, priceZar: 800 },
  exec_25000: { id: "exec_25000", executions: 25000, priceZar: 1500 },
};

export const EXECUTION_PACK_LIST: ExecutionPack[] = EXECUTION_PACK_IDS.map(
  (id) => EXECUTION_PACKS[id],
);

/** The purchasable kind name, stored on the purchase and credit rows. */
export const EXECUTION_CREDIT_KIND = "executions" as const;

/** Copy shown wherever the monthly included allowance is exhausted. */
export const EXECUTION_LIMIT_TITLE = "You've reached your monthly execution limit";

export function isExecutionPackId(value: unknown): value is ExecutionPackId {
  return typeof value === "string" && (EXECUTION_PACK_IDS as readonly string[]).includes(value);
}

/** Throws for anything that is not a published pack, so no price can be forged. */
export function getExecutionPack(id: unknown): ExecutionPack {
  if (!isExecutionPackId(id)) throw new Error(`Unknown execution pack: ${String(id)}`);
  return EXECUTION_PACKS[id];
}

/** Authoritative charge for one pack, in cents. */
export function executionPackPriceCents(id: unknown): number {
  return Math.round(getExecutionPack(id).priceZar * 100);
}

/** Effective price per execution, for display only. */
export function executionPackUnitPriceZar(id: unknown): number {
  const pack = getExecutionPack(id);
  return pack.priceZar / pack.executions;
}

/** "R0.20 / execution" — display helper used by the pack picker. */
export function formatExecutionUnitPrice(id: unknown): string {
  return `R${executionPackUnitPriceZar(id).toFixed(2)} / execution`;
}

export interface ExecutionCreditBalance {
  purchased: number;
  used: number;
  /** Purchased executions still available. Never expires monthly. */
  remaining: number;
}

export function emptyExecutionBalance(): ExecutionCreditBalance {
  return { purchased: 0, used: 0, remaining: 0 };
}
