import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AdvanceRow {
  id: string;
  settlementRef: string | null;
  date: string;
  forLabel: string;
  amount: number;
  laborerId: string | null;
}

export interface UseAdvancesArgs {
  siteId: string | undefined;
  dateFrom: string | null;
  dateTo: string | null;
}

export function useAdvances(args: UseAdvancesArgs) {
  const supabase = createClient();
  const { siteId, dateFrom, dateTo } = args;
  return useQuery<AdvanceRow[]>({
    queryKey: ["advances", siteId, dateFrom, dateTo],
    enabled: Boolean(siteId),
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_payments_ledger", {
        p_site_id:   siteId,
        p_date_from: dateFrom,
        p_date_to:   dateTo,
        p_status:    "completed",
        p_type:      "weekly",
      });
      if (error) throw error;
      const rows = (data ?? []) as Array<any>;
      return rows
        .filter((r) => r.subtype === "advance")
        .map<AdvanceRow>((r) => ({
          id:            r.id,
          settlementRef: r.settlement_ref,
          date:          r.date_or_week_start,
          forLabel:      r.for_label,
          amount:        Number(r.amount) || 0,
          laborerId:     r.laborer_id ?? null,
        }));
    },
  });
}
