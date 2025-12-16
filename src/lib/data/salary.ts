import { createClient } from "@/lib/supabase/server";
import type { SalaryPeriod } from "@/types/database.types";

export type SalaryPeriodDetailed = SalaryPeriod & {
  laborer_name: string;
  laborer_phone: string | null;
  team_name: string | null;
};

export interface SalaryPageData {
  salaryPeriods: SalaryPeriodDetailed[];
}

/**
 * Fetch salary page data on the server.
 * Note: Salary data is company-wide, not site-specific.
 */
export async function getSalaryPageData(): Promise<SalaryPageData> {
  const supabase = await createClient();

  // Fetch salary periods with laborer info
  const { data, error } = await supabase
    .from("salary_periods")
    .select(
      `
      *,
      laborers(name, phone, team:teams!laborers_team_id_fkey(name))
    `
    )
    .order("week_ending", { ascending: false })
    .limit(200);

  if (error) throw error;

  // Transform data to include flattened laborer info
  const salaryPeriods: SalaryPeriodDetailed[] = (data || []).map(
    (item: any) => ({
      ...item,
      laborer_name: item.laborers?.name || "Unknown",
      laborer_phone: item.laborers?.phone || null,
      team_name: item.laborers?.team?.name || null,
    })
  );

  return {
    salaryPeriods,
  };
}
