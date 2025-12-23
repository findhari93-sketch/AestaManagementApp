/**
 * useAttendanceData Hook
 *
 * React Query-based hook for fetching attendance data.
 * Properly integrates with the cache system for automatic invalidation on site change.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys, cacheTTL } from "@/lib/cache/keys";
import { useSite } from "@/contexts/SiteContext";
import { useEffect, useRef } from "react";

export interface AttendanceQueryParams {
  dateFrom: string | null;
  dateTo: string | null;
  isAllTime?: boolean;
}

export interface RawAttendanceData {
  dailyAttendance: any[];
  marketAttendance: any[];
  workSummaries: any[];
  teaShopEntries: any[];
}

async function fetchAttendanceData(
  supabase: ReturnType<typeof createClient>,
  siteId: string,
  params: AttendanceQueryParams
): Promise<RawAttendanceData> {
  const { dateFrom, dateTo, isAllTime } = params;

  // Build daily attendance query
  let attendanceQuery = supabase
    .from("daily_attendance")
    .select(
      `
      id, date, laborer_id, work_days, hours_worked, daily_rate_applied, daily_earnings, is_paid, payment_notes, subcontract_id,
      in_time, lunch_out, lunch_in, out_time, work_hours, break_hours, total_hours, day_units, snacks_amount,
      attendance_status, work_progress_percent,
      engineer_transaction_id, expense_id, paid_via,
      entered_by, recorded_by, recorded_by_user_id, updated_by, updated_by_user_id, created_at, updated_at,
      laborers!inner(name, team_id, category_id, role_id, laborer_type, team:teams!laborers_team_id_fkey(name), labor_categories(name), labor_roles(name)),
      building_sections!inner(name),
      subcontracts(title),
      recorded_by_user:users!daily_attendance_recorded_by_user_id_fkey(avatar_url),
      updated_by_user:users!daily_attendance_updated_by_user_id_fkey(avatar_url)
    `
    )
    .eq("site_id", siteId)
    .order("date", { ascending: false });

  // Only apply date filters if not "All Time"
  if (!isAllTime && dateFrom && dateTo) {
    attendanceQuery = attendanceQuery.gte("date", dateFrom).lte("date", dateTo);
  }

  // Build market laborer attendance query
  let marketQuery = (supabase.from("market_laborer_attendance") as any)
    .select(
      "id, role_id, date, count, work_days, rate_per_person, total_cost, day_units, snacks_per_person, total_snacks, in_time, out_time, is_paid, payment_notes, engineer_transaction_id, expense_id, labor_roles(name)"
    )
    .eq("site_id", siteId);

  if (!isAllTime && dateFrom && dateTo) {
    marketQuery = marketQuery.gte("date", dateFrom).lte("date", dateTo);
  }

  // Build work summaries query
  let summaryQuery = (supabase.from("daily_work_summary") as any)
    .select("*")
    .eq("site_id", siteId);

  if (!isAllTime && dateFrom && dateTo) {
    summaryQuery = summaryQuery.gte("date", dateFrom).lte("date", dateTo);
  }

  // Build tea shop entries query
  let teaShopQuery = (supabase.from("tea_shop_entries") as any)
    .select(
      "date, tea_total, snacks_total, total_amount, working_laborer_count, working_laborer_total, nonworking_laborer_count, nonworking_laborer_total, market_laborer_count, market_laborer_total"
    )
    .eq("site_id", siteId);

  if (!isAllTime && dateFrom && dateTo) {
    teaShopQuery = teaShopQuery.gte("date", dateFrom).lte("date", dateTo);
  }

  // Execute all queries in parallel
  const [attendanceResult, marketResult, summaryResult, teaShopResult] =
    await Promise.all([
      attendanceQuery,
      marketQuery,
      summaryQuery,
      teaShopQuery,
    ]);

  // Check for critical errors
  if (attendanceResult.error) {
    throw new Error(
      `Failed to fetch attendance: ${attendanceResult.error.message}`
    );
  }

  // Log non-critical errors but continue
  if (marketResult.error) {
    console.warn("Market laborer query failed:", marketResult.error);
  }
  if (summaryResult.error) {
    console.warn("Work summary query failed:", summaryResult.error);
  }
  if (teaShopResult.error) {
    console.warn("Tea shop query failed:", teaShopResult.error);
  }

  return {
    dailyAttendance: attendanceResult.data || [],
    marketAttendance: marketResult.data || [],
    workSummaries: summaryResult.data || [],
    teaShopEntries: teaShopResult.data || [],
  };
}

export interface UseAttendanceDataOptions {
  dateFrom: string | null;
  dateTo: string | null;
  isAllTime?: boolean;
  enabled?: boolean;
}

export interface UseAttendanceDataResult {
  data: RawAttendanceData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  /** True when site is changing and we're waiting for new data */
  isTransitioning: boolean;
}

/**
 * Hook for fetching attendance data with React Query caching.
 *
 * Features:
 * - Automatic cache invalidation when site changes (via SyncInitializer)
 * - Proper cache keys including siteId for site-specific data isolation
 * - Automatic refetch on window focus for fresh data
 * - Loading states that properly handle site transitions
 */
export function useAttendanceData(
  options: UseAttendanceDataOptions
): UseAttendanceDataResult {
  const { dateFrom, dateTo, isAllTime = false, enabled = true } = options;
  const { selectedSite } = useSite();
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Track previous site ID to detect transitions
  const previousSiteIdRef = useRef<string | null>(null);
  const isTransitioning =
    previousSiteIdRef.current !== null &&
    previousSiteIdRef.current !== selectedSite?.id;

  // Update previous site ID ref
  useEffect(() => {
    if (selectedSite?.id) {
      previousSiteIdRef.current = selectedSite.id;
    }
  }, [selectedSite?.id]);

  // Clear cache for previous site when switching
  useEffect(() => {
    if (isTransitioning && previousSiteIdRef.current) {
      // Remove old site's attendance queries from cache
      queryClient.removeQueries({
        queryKey: ["attendance", "site", previousSiteIdRef.current],
      });
    }
  }, [isTransitioning, queryClient]);

  const siteId = selectedSite?.id;

  // Use the standardized query key from keys.ts
  const queryKey = siteId
    ? dateFrom && dateTo
      ? queryKeys.attendance.dateRange(siteId, dateFrom, dateTo)
      : queryKeys.attendance.active(siteId)
    : ["attendance", "disabled"];

  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchAttendanceData(supabase, siteId!, { dateFrom, dateTo, isAllTime }),
    enabled: enabled && !!siteId,
    staleTime: cacheTTL.transactional, // 5 minutes
    gcTime: cacheTTL.transactional * 2, // 10 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: true, // Refetch when network reconnects
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
    isTransitioning: isTransitioning && query.isFetching,
  };
}

/**
 * Hook to manually invalidate attendance data cache.
 * Use after mutations (add, edit, delete) to refresh the data.
 */
export function useInvalidateAttendanceData() {
  const queryClient = useQueryClient();
  const { selectedSite } = useSite();

  return () => {
    if (selectedSite?.id) {
      queryClient.invalidateQueries({
        queryKey: ["attendance", "site", selectedSite.id],
      });
    }
  };
}
