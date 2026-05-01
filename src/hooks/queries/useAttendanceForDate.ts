/**
 * useAttendanceForDate
 *
 * Powers the daily-shape branch of the InspectPane Attendance tab.
 * Calls the get_attendance_for_date RPC (added in migration
 * 20260426120000_add_inspect_pane_rpcs.sql) which returns the 3 totals
 * (daily / market / tea) plus per-laborer + per-market-laborer detail
 * rows for one site + one date in a single round-trip.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/utils/timeout";

// Single-row RPC; fail-fast at 8s so React Query retries quickly instead of
// holding the InspectPane skeleton for the global 30s default.
const PER_DAY_TIMEOUT_MS = 8_000;

export interface AttendanceForDateData {
  dailyTotal: number;
  marketTotal: number;
  teaShopTotal: number;
  dailyLaborers: Array<{
    id: string;
    name: string;
    role: string;
    fullDay: boolean;
    amount: number;
    isOverridden: boolean;
    overrideReason: string | null;
    laborerId: string | null;
  }>;
  marketLaborers: Array<{
    id: string;
    role: string;
    count: number;
    amount: number;
  }>;
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function useAttendanceForDate(siteId: string, date: string) {
  const supabase = createClient();
  return useQuery<AttendanceForDateData>({
    queryKey: ["inspect-attendance-date", siteId, date],
    enabled: Boolean(siteId && date),
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<AttendanceForDateData> => {
      // Diagnostics: this query has a recurring "stuck on skeleton" bug
      // (see commit 716af8d). Logs are tagged so we can grep the console
      // when it next reproduces — remove once root cause is identified.
      const t0 = Date.now();
      const visibility =
        typeof document !== "undefined" ? document.visibilityState : "n/a";
      const online =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      const tag = `[diag inspect-attendance-date ${date}]`;
      console.warn(`${tag} start`, { visibility, online });

      try {
        // RPC returns a single jsonb row; supabase-js wraps that in `data`.
        // .abortSignal(signal) lets React Query actually cancel the underlying
        // fetch when the observer unmounts (avoids zombie requests piling up).
        const { data, error } = await withTimeout(
          Promise.resolve(
            (supabase as any)
              .rpc("get_attendance_for_date", {
                p_site_id: siteId,
                p_date: date,
              })
              .abortSignal(signal)
          ),
          PER_DAY_TIMEOUT_MS,
          `Attendance-for-date query timed out after ${PER_DAY_TIMEOUT_MS / 1000}s.`,
        );
        const ms = Date.now() - t0;
        if (error) {
          console.warn(`${tag} rpc-error +${ms}ms`, error);
          throw error;
        }
        console.warn(`${tag} ok +${ms}ms`);
        const r: any = data || {};
        return {
          dailyTotal: toNumber(r.daily_total),
          marketTotal: toNumber(r.market_total),
          teaShopTotal: toNumber(r.tea_shop_total),
          dailyLaborers: (r.daily_laborers ?? []).map((l: any) => ({
            id: String(l.id),
            name: String(l.name ?? "").trim(),
            role: String(l.role ?? ""),
            fullDay: Boolean(l.full_day),
            amount: toNumber(l.amount),
            isOverridden: Boolean(l.is_overridden),
            overrideReason:
              typeof l.override_reason === "string" && l.override_reason.length > 0
                ? l.override_reason
                : null,
            laborerId: l.laborer_id ? String(l.laborer_id) : null,
          })),
          marketLaborers: (r.market_laborers ?? []).map((m: any) => ({
            id: String(m.id),
            role: String(m.role ?? ""),
            count: toNumber(m.count),
            amount: toNumber(m.amount),
          })),
        };
      } catch (err) {
        const ms = Date.now() - t0;
        console.warn(`${tag} threw +${ms}ms`, err);
        throw err;
      }
    },
  });
}
