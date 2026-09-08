/**
 * Execution top-up pack catalogue (client-safe, pure).
 *
 * Mirrors `./addons` deliberately: prices live here and nowhere else, the
 * browser only ever names a published pack id, and the server recomputes the
 * charge from this file in `./execution-packs.server`.
 *
 * Purchased executions never expire — they are only drawn on once the plan's
 * monthly included allowance has run out. The standing balance lives in the
 * `execution_credits` collection and is never reset by the monthly rollover.
 *
 * NOTE: the per-pack prices below follow this file's existing volume-discount
 * shape (bigger pack, lower unit price) and are a reasonable starting point,
 * not confirmed final public pricing. Confirm before these are quoted
 * publicly. The pack ids must stay in sync with the `pack_id` select values on
 * `execution_pack_purchases` in `pb_schema.json`.
 */

export const EXECUTION_PACK_IDS = [
  "exec_250",
  "exec_1000",
  "exec_5000",
  "exec_10000",
  "exec_25000",
] as const;

export type ExecutionPackId = (typeof EXECUTION_PACK_IDS)[number];

/** Credit kind recorded on `execution_pack_purchases` and `execution_credits`. */
export const EXECUTION_CREDIT_KIND = "executions";

/** Heading shown wherever the monthly execution allowance has been reached. */
export const EXECUTION_LIMIT_TITLE = "Monthly executions";

export interface ExecutionPack {
  id: ExecutionPackId;
  /** Executions granted by one purchase of this pack. */
  executions: number;
  /** Price of the whole pack, in ZAR. */
  priceZar: number;
}

export const EXECUTION_PACK_CATALOG: Record<ExecutionPackId, ExecutionPack> = {
  exec_250: { id: "exec_250", executions: 250, priceZar: 50 },
  exec_1000: { id: "exec_1000", executions: 1000, priceZar: 180 },
  exec_5000: { id: "exec_5000", executions: 5000, priceZar: 800 },
  exec_10000: { id: "exec_10000", executions: 10000, priceZar: 1400 },
  exec_25000: { id: "exec_25000", executions: 25000, priceZar: 3000 },
};

/** Published packs, smallest first — the order shown in the buy modal. */
export const EXECUTION_PACK_LIST: ExecutionPack[] = EXECUTION_PACK_IDS.map(
  (id) => EXECUTION_PACK_CATALOG[id],
);

export function isExecutionPackId(value: unknown): value is ExecutionPackId {
  return (EXECUTION_PACK_IDS as readonly string[]).includes(String(value));
}

export function getExecutionPack(id: unknown): ExecutionPack {
  if (!isExecutionPackId(id)) throw new Error("Unknown execution pack.");
  return EXECUTION_PACK_CATALOG[id];
}

/** Authoritative price for one pack purchase, in cents. */
export function executionPackPriceCents(id: unknown): number {
  return Math.round(getExecutionPack(id).priceZar * 100);
}

/** Per-execution price of a pack, as shown under the pack name. */
export function executionUnitPriceZar(id: unknown): number {
  const pack = getExecutionPack(id);
  return pack.priceZar / pack.executions;
}

/** Human copy for the per-execution price, e.g. "R0.18 per execution". */
export function formatExecutionUnitPrice(id: unknown): string {
  const unit = executionUnitPriceZar(id);
  return `R${unit.toFixed(2)} per execution`;
}

/** Standing purchased-execution balance returned to the browser. */
export interface ExecutionCreditBalance {
  purchased: number;
  used: number;
  remaining: number;
}

export function emptyExecutionBalance(): ExecutionCreditBalance {
  return { purchased: 0, used: 0, remaining: 0 };
}
