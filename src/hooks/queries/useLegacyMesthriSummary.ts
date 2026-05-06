import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, TIMEOUTS } from "@/lib/utils/timeout";

export interface LegacyMesthriSummary {
  id: string;
  mesthriLaborerId: string | null;
  mesthriName: string;
  cutoffDate: string;
  totalWagesOwed: number;
  totalPaid: number;
  laborerCount: number;
  weeksCovered: number;
}

/**
 * Fetches per-mesthri legacy summaries for a site, written by the Mode C
 * "Start fresh — zero balance" reconcile. Empty for sites that haven't been
 * Mode-C-reconciled. Powers MesthriLegacySummaryCard above the live waterfall.
 */
export function useLegacyMesthriSummary(siteId: string | undefined) {
  const supabase = createClient();
  return useQuery<LegacyMesthriSummary[]>({
    queryKey: ["legacy-mesthri-summary", siteId],
    enabled: Boolean(siteId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await withTimeout(
        Promise.resolve(
          (supabase as any)
            .from("site_legacy_mesthri_summary")
            .select(
              `id, mesthri_laborer_id, mesthri_name, cutoff_date,
               total_wages_owed, total_paid, laborer_count, weeks_covered`
            )
            .eq("site_id", siteId)
            .order("total_paid", { ascending: false })
        ),
        TIMEOUTS.QUERY,
        "Legacy mesthri summary query timed out. Please retry.",
      );
      if (error) throw error;
      return ((data ?? []) as Array<any>).map<LegacyMesthriSummary>((r) => ({
        id:               String(r.id),
        mesthriLaborerId: r.mesthri_laborer_id ? String(r.mesthri_laborer_id) : null,
        mesthriName:      String(r.mesthri_name ?? "Unassigned crew"),
        cutoffDate:       String(r.cutoff_date),
        totalWagesOwed:   Number(r.total_wages_owed) || 0,
        totalPaid:        Number(r.total_paid)       || 0,
        laborerCount:     Number(r.laborer_count)    || 0,
        weeksCovered:     Number(r.weeks_covered)    || 0,
      }));
    },
  });
}
