import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface WeekDayAggregate {
  date: string;
  laborersWorked: number;
  totalEarnings: number;
}

export interface WeekAggregate {
  days: WeekDayAggregate[];
  totalLaborers: number;
  totalEarnings: number;
}

export function useWeekAggregateAttendance(
  siteId: string | undefined,
  subcontractId: string | null,
  weekStart: string | undefined,
  weekEnd: string | undefined
) {
  const supabase = createClient();
  return useQuery<WeekAggregate>({
    queryKey: [
      "week-aggregate-attendance",
      siteId,
      subcontractId,
      weekStart,
      weekEnd,
    ],
    enabled: Boolean(siteId && weekStart && weekEnd),
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from("daily_attendance")
        .select("date, laborer_id, daily_earnings, laborers!inner(laborer_type)")
        .eq("site_id", siteId!)
        .eq("is_deleted", false)
        .eq("laborers.laborer_type", "contract")
        .gte("date", weekStart!)
        .lte("date", weekEnd!);
      if (subcontractId) q = q.eq("subcontract_id", subcontractId);
      const { data, error } = await q;
      if (error) throw error;

      const byDate = new Map<
        string,
        { laborers: Set<string>; earnings: number }
      >();
      const allLaborers = new Set<string>();
      let total = 0;
      for (const r of (data ?? []) as Array<{
        date: string;
        laborer_id: string;
        daily_earnings: number | string | null;
      }>) {
        const e = byDate.get(r.date) ?? { laborers: new Set(), earnings: 0 };
        e.laborers.add(r.laborer_id);
        const amt = Number(r.daily_earnings || 0);
        e.earnings += amt;
        byDate.set(r.date, e);
        allLaborers.add(r.laborer_id);
        total += amt;
      }
      const days: WeekDayAggregate[] = Array.from(byDate.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, v]) => ({
          date,
          laborersWorked: v.laborers.size,
          totalEarnings: v.earnings,
        }));
      return { days, totalLaborers: allLaborers.size, totalEarnings: total };
    },
  });
}
