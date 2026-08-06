import type { WorkflowBlock } from "./types";

const PLACEHOLDER = /\{\{\s*([\w.[\]]+)\s*\}\}/g;

/** Reads a dotted path such as payload.customer.email from a context object. */
export function readPath(context: unknown, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      if (typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[key];
    }, context);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Replaces every {{placeholder}} in a string with its value from the context. */
export function resolveString(input: string, context: Record<string, unknown>): string {
  return input.replace(PLACEHOLDER, (match, path: string) => {
    const value = readPath(context, path);
    return value === undefined ? match : stringify(value);
  });
}

/** Recursively resolves placeholders inside any config value. */
export function resolveValue<T>(value: T, context: Record<string, unknown>): T {
  if (typeof value === "string") return resolveString(value, context) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, context)) as unknown as T;
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = resolveValue(item, context);
    }
    return output as unknown as T;
  }
  return value;
}

/** Placeholders in a string that the given context cannot fill. */
export function unresolvedPlaceholders(value: unknown, context: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const walk = (item: unknown) => {
    if (typeof item === "string") {
      for (const match of item.matchAll(PLACEHOLDER)) {
        const path = match[1] as string;
        if (readPath(context, path) === undefined) missing.push(`{{${path}}}`);
      }
      return;
    }
    if (Array.isArray(item)) return item.forEach(walk);
    if (item && typeof item === "object") Object.values(item as object).forEach(walk);
  };
  walk(value);
  return Array.from(new Set(missing));
}

export interface PreviewStep {
  block: WorkflowBlock;
  resolvedConfig: Record<string, unknown>;
  missing: string[];
}

/**
 * Walks the workflow with the sample input, building the context each block would
 * see and resolving its configuration for the preview and the test run.
 */
export function previewWorkflow(
  blocks: WorkflowBlock[],
  sampleInput: Record<string, unknown>,
  user?: { email?: string; name?: string; business_name?: string },
): { steps: PreviewStep[]; context: Record<string, unknown> } {
  const context: Record<string, unknown> = {
    ...sampleInput,
    user: {
      email: user?.email ?? "",
      name: user?.name ?? "",
      business_name: user?.business_name ?? "",
    },
  };

  const steps = blocks.map((block) => {
    const resolvedConfig = resolveValue(block.config ?? {}, context);
    const missing = unresolvedPlaceholders(block.config ?? {}, context);
    const outputVariable = block.config?.["output_variable"];
    if (typeof outputVariable === "string" && outputVariable) {
      context[outputVariable] = `[${block.label} output]`;
    }
    return { block, resolvedConfig, missing };
  });

  return { steps, context };
}
