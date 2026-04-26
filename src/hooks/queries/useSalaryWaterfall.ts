import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface WaterfallFilledBy {
  ref: string;
  amount: number;
  settledAt: string;
}

export interface WaterfallWeek {
  weekStart: string;
  weekEnd: string;
  daysWorked: number;
  laborerCount: number;
  wagesDue: number;
  paid: number;
  status: "settled" | "underpaid" | "pending";
  filledBy: WaterfallFilledBy[];
}

export interface UseSalaryWaterfallArgs {
  siteId: string | undefined;
  subcontractId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export function useSalaryWaterfall(args: UseSalaryWaterfallArgs) {
  const supabase = createClient();
  const { siteId, subcontractId, dateFrom, dateTo } = args;
  return useQuery<WaterfallWeek[]>({
    queryKey: ["salary-waterfall", siteId, subcontractId, dateFrom, dateTo],
    enabled: Boolean(siteId),
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_salary_waterfall", {
        p_site_id:        siteId,
        p_subcontract_id: subcontractId,
        p_date_from:      dateFrom,
        p_date_to:        dateTo,
      });
      if (error) throw error;
      const rows = (data ?? []) as Array<any>;
      return rows.map<WaterfallWeek>((r) => ({
        weekStart:    r.week_start,
        weekEnd:      r.week_end,
        daysWorked:   Number(r.days_worked) || 0,
        laborerCount: Number(r.laborer_count) || 0,
        wagesDue:     Number(r.wages_due) || 0,
        paid:         Number(r.paid) || 0,
        status:       r.status as WaterfallWeek["status"],
        filledBy:     Array.isArray(r.filled_by)
          ? r.filled_by.map((f: any) => ({
              ref:        String(f.ref),
              amount:     Number(f.amount) || 0,
              settledAt:  String(f.settled_at),
            }))
          : [],
      }));
    },
  });
}
