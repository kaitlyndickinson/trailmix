export const TOP_PER_CATEGORY = 5;

/**
 * How many per category get the full (hours-aware) score. Hours only lower a
 * score, so this is a close approximation of scoring everything.
 */
export const PRESELECT_PER_CATEGORY = 20;

/** Highest score first, keeping at most `n` per category. Ties break by name. */
export function topPerCategory<
  T extends { category: string; score: number; name: string },
>(items: T[], n = TOP_PER_CATEGORY): T[] {
  const sorted = [...items].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const item of sorted) {
    const count = counts.get(item.category) ?? 0;
    if (count >= n) continue;
    counts.set(item.category, count + 1);
    out.push(item);
  }
  return out;
}
