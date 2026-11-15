import type { AdherenceSummary } from "@/types";

/** Percentual de doses tomadas. null quando não há doses no período (pessoa sem remédios cadastrados). */
export function adherencePercent(a: Pick<AdherenceSummary, "taken" | "scheduled">): number | null {
  return a.scheduled > 0 ? Math.round((a.taken / a.scheduled) * 100) : null;
}
