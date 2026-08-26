/**
 * Shared filtering logic for the workflow area (templates + user workflows).
 *
 * Design rules:
 * - The PLATFORM filter is never a hardcoded list. Platform options are derived
 *   from `INTEGRATIONS` (the integration catalog, which is the single source of
 *   truth for supported platforms) intersected with the platforms that the
 *   currently loaded templates/workflows actually reference. Adding a new
 *   integration to the catalog makes it filterable automatically, with no
 *   change to this file or to the workflows page.
 * - The CATEGORY filter is derived from the categories actually present in the
 *   data (template `category`, and for user workflows the category of the
 *   template they were activated from).
 * - All three filters (category, platform, search) are independent predicates
 *   and are combined with AND.
 */

import { INTEGRATIONS, type IntegrationDefinition } from "@/lib/integrations/catalog";

/** Minimal shape both templates and user workflows satisfy. */
export interface FilterableItem {
  name: string;
  description?: string | undefined;
  category?: string | undefined;
  integrations_required?: string[] | undefined;
  blocks?: Array<{
    type?: string | undefined;
    trigger_type?: string | undefined;
    action_type?: string | undefined;
    logic_type?: string | undefined;
    label?: string | undefined;
  }>;
  trigger_type?: string | undefined;
}

export const UNCATEGORISED = "Uncategorised";

/**
 * Every lowercase token that could name a platform for this item: declared
 * integration requirements plus the block subtypes it actually uses.
 */
export function platformTokens(item: FilterableItem): string[] {
  const tokens: string[] = [];
  for (const entry of item.integrations_required ?? []) {
    if (typeof entry === "string" && entry.trim()) tokens.push(entry.trim().toLowerCase());
  }
  if (item.trigger_type) tokens.push(item.trigger_type.toLowerCase());
  for (const block of item.blocks ?? []) {
    for (const value of [block.trigger_type, block.action_type, block.logic_type]) {
      if (typeof value === "string" && value.trim()) tokens.push(value.trim().toLowerCase());
    }
  }
  return tokens;
}

/** Words that identify one integration, taken from the catalog entry itself. */
function integrationAliases(definition: IntegrationDefinition): string[] {
  const aliases = new Set<string>();
  aliases.add(definition.key.toLowerCase());
  // "Email sending" -> "email", "sending". Single-word names like "Slack"
  // and "HubSpot" collapse to themselves.
  for (const word of definition.name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length > 2) aliases.add(word);
  }
  return [...aliases];
}

/**
 * Integration keys this item involves. A token matches an integration when the
 * token contains one of that integration's aliases as a whole word-ish chunk,
 * so `send_email` and `email_received` both resolve to the `email` platform.
 */
export function itemPlatforms(item: FilterableItem): string[] {
  const tokens = platformTokens(item);
  const found = new Set<string>();
  for (const definition of INTEGRATIONS) {
    const aliases = integrationAliases(definition);
    const hit = tokens.some((token) =>
      aliases.some((alias) => token === alias || token.split(/[^a-z0-9]+/).includes(alias)),
    );
    if (hit) found.add(definition.key);
  }
  return [...found];
}

export interface PlatformOption {
  key: string;
  name: string;
}

/**
 * Platform filter options: catalog order, restricted to platforms that at least
 * one loaded item references. Never a hand-maintained list.
 */
export function collectPlatformOptions(items: FilterableItem[]): PlatformOption[] {
  const present = new Set<string>();
  for (const item of items) {
    for (const key of itemPlatforms(item)) present.add(key);
  }
  return INTEGRATIONS.filter((definition) => present.has(definition.key)).map((definition) => ({
    key: definition.key,
    name: definition.name,
  }));
}

/** Category filter options, derived from the data, alphabetical. */
export function collectCategoryOptions(items: FilterableItem[]): string[] {
  const present = new Set<string>();
  for (const item of items) {
    const value = (item.category ?? "").trim();
    present.add(value ? value : UNCATEGORISED);
  }
  const known = [...present].filter((c) => c !== UNCATEGORISED).sort((a, b) => a.localeCompare(b));
  return present.has(UNCATEGORISED) ? [...known, UNCATEGORISED] : known;
}

/** Category of an item, normalised. Blank categories collapse to Uncategorised. */
export function itemCategory(item: FilterableItem): string {
  return (item.category ?? "").trim() || UNCATEGORISED;
}

/**
 * Category group. OR within the group: an empty selection means "no category
 * restriction", otherwise the item must sit in one of the chosen categories.
 */
export function matchesCategories(item: FilterableItem, categories: readonly string[]): boolean {
  if (categories.length === 0) return true;
  return categories.includes(itemCategory(item));
}

/**
 * Apps group. OR within the group: an empty selection means "no app
 * restriction", otherwise the item must use at least one chosen app.
 */
export function matchesPlatforms(item: FilterableItem, platforms: readonly string[]): boolean {
  if (platforms.length === 0) return true;
  const used = itemPlatforms(item);
  return platforms.some((key) => used.includes(key));
}

/** Name/keyword search across name, description, category and platform names. */
export function matchesSearch(item: FilterableItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    item.name,
    item.description ?? "",
    item.category ?? "",
    ...platformTokens(item),
    ...itemPlatforms(item).map(
      (key) => INTEGRATIONS.find((i) => i.key === key)?.name.toLowerCase() ?? key,
    ),
    ...(item.blocks ?? []).map((b) => b.label ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Multi-select filter state: OR inside each group, AND across the groups. */
export interface FilterState {
  query: string;
  categories: string[];
  platforms: string[];
}

export const EMPTY_FILTERS: FilterState = { query: "", categories: [], platforms: [] };

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.query.trim() !== "" || filters.categories.length > 0 || filters.platforms.length > 0
  );
}

/** Toggle one value inside a selection array (used by the dropdown filters). */
export function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/**
 * (category A OR category B) AND (app X OR app Y) AND search.
 */
export function matchesFilters(item: FilterableItem, filters: FilterState): boolean {
  return (
    matchesCategories(item, filters.categories) &&
    matchesPlatforms(item, filters.platforms) &&
    matchesSearch(item, filters.query)
  );
}

