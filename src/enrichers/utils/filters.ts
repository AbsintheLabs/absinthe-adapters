import { ActionEnricher, Enricher, PricedBalanceWindow } from '../../types/enrichment.ts';

/**
 * Deduplicates actions based on their key property
 */
export const dedupeActions: ActionEnricher = async (actions, context) => {
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (!a.key) return true; // fallback: keep if no key
    if (seen.has(a.key)) return false;
    seen.add(a.key);
    return true;
  });
};

/**
 * Filters out windows with zero or undefined USD value
 */
export const filterOutZeroValueEvents: Enricher<PricedBalanceWindow, PricedBalanceWindow> = async (
  windows,
  context,
) => {
  return windows.filter((w) => w.valueUsd !== 0 && w.valueUsd !== undefined);
};
