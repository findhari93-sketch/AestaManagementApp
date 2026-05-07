/**
 * useLaborerProfileSummary
 *
 * Powers the LaborerProfileDrawer on /company/laborers. Calls the
 * get_laborer_profile_summary RPC (migration 20260506130000) which returns
 * monthly aggregates (days_worked, earnings_total, paid_total, outstanding),
 * per-site rollup, and the trailing 14-day attendance strip for one laborer.
 *
 * Note: paid_total / outstanding are 0 for laborer_type='contract' by design
 * (contract laborers settle via the mesthri's subcontract, not directly via
 * attendance.is_paid). The drawer renders a "Paid via mesthri team" hint in
 * that case.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, TIMEOUTS } from "@/lib/utils/timeout";

export type LaborerType = "contract" | "daily_market" | string;

export type RecentAttendanceStatus =
  | "present"
  | "half"
  | "contract"
  | "no_record"
  | "before_joining";

export interface LaborerProfileSiteRow {
  siteId: string;
  siteName: string;
  days: number;
  earnings: number;
}

export interface LaborerProfileRecentDay {
  date: string; // YYYY-MM-DD
  status: RecentAttendanceStatus;
  siteId: string | null;
  siteName: string | null;
  earnings: number;
}

export interface LaborerProfileSummary {
  laborerType: LaborerType;
  daysWorked: number;
  earningsTotal: number;
  paidTotal: number;
  outstanding: number;
  sites: LaborerProfileSiteRow[];
  recent14Days: LaborerProfileRecentDay[];
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toRecentStatus(s: unknown): RecentAttendanceStatus {
  if (
    s === "present" ||
    s === "half" ||
    s === "contract" ||
    s === "no_record" ||
    s === "before_joining"
  ) {
    return s;
  }
  return "no_record";
}

/**
 * Returns the first day of the calendar month for a given Date as a
 * YYYY-MM-DD string in the local timezone. Used as the RPC's p_month_start.
 */
export function startOfMonthISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function useLaborerProfileSummary(
  laborerId: string | null,
  monthStartISO: string,
) {
  const supabase = createClient();
  return useQuery<LaborerProfileSummary>({
    queryKey: ["laborer-profile-summary", laborerId, monthStartISO],
    enabled: Boolean(laborerId && monthStartISO),
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<LaborerProfileSummary> => {
      const { data, error } = await withTimeout(
        Promise.resolve(
          (supabase as any)
            .rpc("get_laborer_profile_summary", {
              p_laborer_id: laborerId,
              p_month_start: monthStartISO,
            })
            .abortSignal(signal),
        ),
        TIMEOUTS.QUERY,
        "Laborer profile summary query timed out. Please retry.",
      );
      if (error) throw error;
      const r: any = data || {};
      return {
        laborerType: String(r.laborer_type ?? ""),
        daysWorked: toNumber(r.days_worked),
        earningsTotal: toNumber(r.earnings_total),
        paidTotal: toNumber(r.paid_total),
        outstanding: toNumber(r.outstanding),
        sites: (r.sites ?? []).map((s: any) => ({
          siteId: String(s.site_id ?? ""),
          siteName: String(s.site_name ?? ""),
          days: toNumber(s.days),
          earnings: toNumber(s.earnings),
        })),
        recent14Days: (r.recent_14_days ?? []).map((d: any) => ({
          date: String(d.date),
          status: toRecentStatus(d.status),
          siteId: d.site_id ? String(d.site_id) : null,
          siteName: d.site_name ? String(d.site_name) : null,
          earnings: toNumber(d.earnings),
        })),
      };
    },
  });
}
