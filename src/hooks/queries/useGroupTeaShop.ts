"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  TeaShopAccount,
  TeaShopGroupEntry,
  TeaShopGroupEntryWithAllocations,
  TeaShopGroupAllocation,
  TeaShopGroupAllocationWithSite,
  TeaShopGroupSettlement,
  TeaShopGroupSettlementAllocation,
  SiteAttendanceData,
  LaborGroupPercentageSplit,
} from "@/types/database.types";

// =============================================================================
// GROUP TEA SHOP ACCOUNT
// =============================================================================

/**
 * Fetch the tea shop account for a site group
 */
export function useGroupTeaShopAccount(siteGroupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? queryKeys.groupTeaShop.byGroup(siteGroupId)
      : ["group-tea-shop", "account"],
    queryFn: async () => {
      if (!siteGroupId) return null;

      const { data, error } = await (supabase as any)
        .from("tea_shop_accounts")
        .select("*")
        .eq("site_group_id", siteGroupId)
        .eq("is_group_shop", true)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as TeaShopAccount | null;
    },
    enabled: !!siteGroupId,
  });
}

// =============================================================================
// GROUP TEA SHOP ENTRIES
// =============================================================================

/**
 * Fetch group tea shop entries for a site group
 */
export function useGroupTeaShopEntries(
  siteGroupId: string | undefined,
  options?: { dateFrom?: string; dateTo?: string }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? [...queryKeys.groupTeaShop.entries(siteGroupId), options]
      : ["group-tea-shop", "entries"],
    queryFn: async () => {
      if (!siteGroupId) return [];

      let query = (supabase as any)
        .from("tea_shop_group_entries")
        .select(`
          *,
          allocations:tea_shop_group_allocations(
            *,
            site:sites(id, name)
          )
        `)
        .eq("site_group_id", siteGroupId)
        .order("date", { ascending: false });

      if (options?.dateFrom) {
        query = query.gte("date", options.dateFrom);
      }
      if (options?.dateTo) {
        query = query.lte("date", options.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TeaShopGroupEntryWithAllocations[];
    },
    enabled: !!siteGroupId,
  });
}

/**
 * Fetch a single group entry with allocations
 * This queries tea_shop_entries (with is_group_entry=true) and tea_shop_entry_allocations
 */
export function useGroupTeaShopEntry(entryId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: entryId
      ? ["group-tea-shop", "entry", entryId]
      : ["group-tea-shop", "entry"],
    queryFn: async () => {
      if (!entryId) return null;

      // Fetch entry from tea_shop_entries
      const { data: entry, error: entryError } = await (supabase as any)
        .from("tea_shop_entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (entryError) throw entryError;
      if (!entry) return null;

      // Fetch allocations from tea_shop_entry_allocations
      const { data: allocations, error: allocError } = await (supabase as any)
        .from("tea_shop_entry_allocations")
        .select("*, site:sites(id, name)")
        .eq("entry_id", entryId);

      if (allocError) {
        console.warn("Error fetching allocations:", allocError.message);
      }

      // Transform to the expected format
      const transformedAllocations = (allocations || []).map((alloc: any) => ({
        id: alloc.id,
        group_entry_id: entryId,
        site_id: alloc.site_id,
        site: alloc.site,
        // Use worker_count for attendance_count
        named_laborer_count: alloc.worker_count || 0,
        market_laborer_count: 0,
        attendance_count: alloc.worker_count || 0,
        allocation_percentage: alloc.allocation_percentage,
        allocated_amount: alloc.allocated_amount,
      }));

      return {
        id: entry.id,
        tea_shop_id: entry.tea_shop_id,
        site_group_id: entry.site_group_id || null,
        date: entry.date,
        total_amount: entry.total_amount,
        is_percentage_override: entry.is_percentage_override || false,
        percentage_split: entry.percentage_split || null,
        notes: entry.notes,
        entered_by: entry.entered_by,
        entered_by_user_id: entry.entered_by_user_id,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        allocations: transformedAllocations,
      } as TeaShopGroupEntryWithAllocations;
    },
    enabled: !!entryId,
  });
}

// =============================================================================
// GROUP ATTENDANCE FOR PERCENTAGE CALCULATION
// =============================================================================

/**
 * Fetch attendance counts for all sites in a group on a specific date
 * Used for auto-calculating percentage split
 */
export function useGroupAttendanceCounts(
  siteGroupId: string | undefined,
  date: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey:
      siteGroupId && date
        ? queryKeys.groupTeaShop.attendance(siteGroupId, date)
        : ["group-tea-shop", "attendance"],
    queryFn: async (): Promise<SiteAttendanceData[]> => {
      if (!siteGroupId || !date) return [];

      // Get sites in the group
      const { data: sites, error: sitesError } = await (supabase as any)
        .from("sites")
        .select("id, name")
        .eq("site_group_id", siteGroupId)
        .order("name");

      if (sitesError) throw sitesError;
      if (!sites || sites.length === 0) return [];

      // Get attendance for each site
      const attendanceData: SiteAttendanceData[] = [];

      for (const site of sites) {
        // Get named laborer count
        const { data: namedData } = await (supabase as any)
          .from("daily_attendance")
          .select("id", { count: "exact" })
          .eq("site_id", site.id)
          .eq("date", date)
          .eq("is_deleted", false);

        // Get market laborer count
        const { data: marketData } = await (supabase as any)
          .from("market_laborer_attendance")
          .select("count")
          .eq("site_id", site.id)
          .eq("date", date)
          .eq("is_deleted", false);

        const namedCount = namedData?.length || 0;
        const marketCount =
          marketData?.reduce(
            (sum: number, m: { count: number }) => sum + (m.count || 0),
            0
          ) || 0;

        attendanceData.push({
          siteId: site.id,
          siteName: site.name,
          namedLaborerCount: namedCount,
          marketLaborerCount: marketCount,
          totalCount: namedCount + marketCount,
          percentage: 0, // Will be calculated
          allocatedAmount: 0, // Will be calculated
        });
      }

      // Calculate percentages
      const totalWorkers = attendanceData.reduce(
        (sum, s) => sum + s.totalCount,
        0
      );

      if (totalWorkers > 0) {
        attendanceData.forEach((site) => {
          site.percentage = Math.round((site.totalCount / totalWorkers) * 100);
        });

        // Adjust to ensure sum is 100
        const totalPercentage = attendanceData.reduce(
          (sum, s) => sum + s.percentage,
          0
        );
        if (totalPercentage !== 100 && attendanceData.length > 0) {
          // Add remainder to the site with the most workers
          const maxSite = attendanceData.reduce((max, s) =>
            s.totalCount > max.totalCount ? s : max
          );
          maxSite.percentage += 100 - totalPercentage;
        }
      } else {
        // Equal split if no attendance
        const equalPercentage = Math.floor(100 / attendanceData.length);
        attendanceData.forEach((site, index) => {
          site.percentage =
            index === 0
              ? 100 - equalPercentage * (attendanceData.length - 1)
              : equalPercentage;
        });
      }

      return attendanceData;
    },
    enabled: !!siteGroupId && !!date,
  });
}

// =============================================================================
// CREATE GROUP ENTRY
// =============================================================================

interface CreateGroupEntryData {
  teaShopId: string;
  siteGroupId: string;
  date: string;
  totalAmount: number;
  allocations: {
    siteId: string;
    namedLaborerCount: number;
    marketLaborerCount: number;
    percentage: number;
    amount: number;
  }[];
  isPercentageOverride?: boolean;
  percentageSplit?: LaborGroupPercentageSplit;
  notes?: string;
  enteredBy?: string;
  enteredByUserId?: string;
}

export function useCreateGroupTeaShopEntry() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: CreateGroupEntryData) => {
      const isSessionValid = await ensureFreshSession();
      if (!isSessionValid) {
        throw new Error("Session expired. Please refresh the page and try again.");
      }

      // Create the entry in tea_shop_entries with is_group_entry = true
      const { data: entry, error: entryError } = await (supabase as any)
        .from("tea_shop_entries")
        .insert({
          tea_shop_id: data.teaShopId,
          site_group_id: data.siteGroupId,
          site_id: null, // Group entries don't have a single site
          date: data.date,
          total_amount: data.totalAmount,
          amount_paid: 0,
          is_fully_paid: false,
          is_group_entry: true,
          percentage_split: data.percentageSplit || null,
          notes: data.notes || null,
          entered_by: data.enteredBy || null,
          entered_by_user_id: data.enteredByUserId || null,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Create allocations in tea_shop_entry_allocations
      const allocationsToInsert = data.allocations.map((alloc) => ({
        entry_id: entry.id,
        site_id: alloc.siteId,
        worker_count: alloc.namedLaborerCount + alloc.marketLaborerCount,
        allocation_percentage: alloc.percentage,
        allocated_amount: alloc.amount,
      }));

      const { error: allocError } = await (supabase as any)
        .from("tea_shop_entry_allocations")
        .insert(allocationsToInsert);

      if (allocError) throw allocError;

      return entry as TeaShopGroupEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.entries(variables.siteGroupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.pending(variables.siteGroupId),
      });
    },
  });
}

// =============================================================================
// UPDATE GROUP ENTRY
// =============================================================================

interface UpdateGroupEntryData extends CreateGroupEntryData {
  id: string;
  updatedBy?: string;
  updatedByUserId?: string;
}

export function useUpdateGroupTeaShopEntry() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: UpdateGroupEntryData) => {
      const isSessionValid = await ensureFreshSession();
      if (!isSessionValid) {
        throw new Error("Session expired. Please refresh the page and try again.");
      }

      // Update the entry in tea_shop_entries (not tea_shop_group_entries)
      const { data: entry, error: entryError } = await (supabase as any)
        .from("tea_shop_entries")
        .update({
          date: data.date,
          total_amount: data.totalAmount,
          percentage_split: data.percentageSplit || null,
          notes: data.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select()
        .single();

      if (entryError) throw entryError;

      // Delete existing allocations from tea_shop_entry_allocations
      await (supabase as any)
        .from("tea_shop_entry_allocations")
        .delete()
        .eq("entry_id", data.id);

      // Create new allocations in tea_shop_entry_allocations
      const allocationsToInsert = data.allocations.map((alloc) => ({
        entry_id: data.id,
        site_id: alloc.siteId,
        worker_count: alloc.namedLaborerCount + alloc.marketLaborerCount,
        allocation_percentage: alloc.percentage,
        allocated_amount: alloc.amount,
      }));

      const { error: allocError } = await (supabase as any)
        .from("tea_shop_entry_allocations")
        .insert(allocationsToInsert);

      if (allocError) throw allocError;

      return entry as TeaShopGroupEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.entries(variables.siteGroupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.pending(variables.siteGroupId),
      });
    },
  });
}

// =============================================================================
// DELETE GROUP ENTRY
// =============================================================================

export function useDeleteGroupTeaShopEntry() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      siteGroupId,
    }: {
      id: string;
      siteGroupId: string;
    }) => {
      await ensureFreshSession();

      // Allocations are deleted via CASCADE
      const { error } = await (supabase as any)
        .from("tea_shop_group_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.entries(variables.siteGroupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.pending(variables.siteGroupId),
      });
    },
  });
}

// =============================================================================
// GROUP SETTLEMENTS
// =============================================================================

/**
 * Fetch group settlements
 */
export function useGroupTeaShopSettlements(siteGroupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? queryKeys.groupTeaShop.settlements(siteGroupId)
      : ["group-tea-shop", "settlements"],
    queryFn: async () => {
      if (!siteGroupId) return [];

      const { data, error } = await (supabase as any)
        .from("tea_shop_group_settlements")
        .select("*, subcontracts(id, title)")
        .eq("site_group_id", siteGroupId)
        .eq("is_cancelled", false)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return (data || []) as TeaShopGroupSettlement[];
    },
    enabled: !!siteGroupId,
  });
}

/**
 * Calculate pending balance for group tea shop
 */
export function useGroupTeaShopPendingBalance(siteGroupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? queryKeys.groupTeaShop.pending(siteGroupId)
      : ["group-tea-shop", "pending"],
    queryFn: async () => {
      if (!siteGroupId) return { entriesTotal: 0, paidTotal: 0, pending: 0 };

      // Get total entries amount
      const { data: entries } = await (supabase as any)
        .from("tea_shop_group_entries")
        .select("total_amount")
        .eq("site_group_id", siteGroupId);

      const entriesTotal =
        entries?.reduce(
          (sum: number, e: { total_amount: number }) =>
            sum + (e.total_amount || 0),
          0
        ) || 0;

      // Get total settled amount
      const { data: settlements } = await (supabase as any)
        .from("tea_shop_group_settlements")
        .select("amount_paid")
        .eq("site_group_id", siteGroupId)
        .eq("is_cancelled", false);

      const paidTotal =
        settlements?.reduce(
          (sum: number, s: { amount_paid: number }) =>
            sum + (s.amount_paid || 0),
          0
        ) || 0;

      return {
        entriesTotal,
        paidTotal,
        pending: entriesTotal - paidTotal,
      };
    },
    enabled: !!siteGroupId,
  });
}

/**
 * Get unsettled entries for waterfall allocation preview
 */
export function useGroupTeaShopUnsettledEntries(
  siteGroupId: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? ["group-tea-shop", "unsettled", siteGroupId]
      : ["group-tea-shop", "unsettled"],
    queryFn: async () => {
      if (!siteGroupId) return [];

      const { data, error } = await (supabase as any)
        .from("tea_shop_group_entries")
        .select(`
          *,
          allocations:tea_shop_group_allocations(
            *,
            site:sites(id, name)
          )
        `)
        .eq("site_group_id", siteGroupId)
        .or("is_fully_paid.is.null,is_fully_paid.eq.false")
        .order("date", { ascending: true }); // Oldest first for waterfall

      if (error) throw error;
      return (data || []) as TeaShopGroupEntryWithAllocations[];
    },
    enabled: !!siteGroupId,
  });
}

// =============================================================================
// CREATE GROUP SETTLEMENT
// =============================================================================

interface CreateGroupSettlementData {
  teaShopId: string;
  siteGroupId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMode: string;
  payerType: string;
  siteEngineerId?: string;
  createWalletTransaction?: boolean;
  payerSource?: string;
  payerName?: string;
  proofUrl?: string;
  subcontractId?: string;
  notes?: string;
  recordedBy?: string;
  recordedByUserId?: string;
  // Waterfall allocation data
  allocations: {
    entryId: string;
    amount: number;
  }[];
  periodStart: string;
  periodEnd: string;
  entriesTotal: number;
  totalDue: number;
  balanceRemaining: number;
}

export function useCreateGroupTeaShopSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: CreateGroupSettlementData) => {
      await ensureFreshSession();

      // Create the settlement
      const { data: settlement, error: settlementError } = await (
        supabase as any
      )
        .from("tea_shop_group_settlements")
        .insert({
          tea_shop_id: data.teaShopId,
          site_group_id: data.siteGroupId,
          period_start: data.periodStart,
          period_end: data.periodEnd,
          entries_total: data.entriesTotal,
          total_due: data.totalDue,
          amount_paid: data.amountPaid,
          balance_remaining: data.balanceRemaining,
          payment_date: data.paymentDate,
          payment_mode: data.paymentMode,
          payer_type: data.payerType,
          site_engineer_id: data.siteEngineerId || null,
          payer_source: data.payerSource || null,
          payer_name: data.payerName || null,
          proof_url: data.proofUrl || null,
          subcontract_id: data.subcontractId || null,
          notes: data.notes || null,
          recorded_by: data.recordedBy || null,
          recorded_by_user_id: data.recordedByUserId || null,
          status: data.balanceRemaining > 0 ? "partial" : "completed",
        })
        .select()
        .single();

      if (settlementError) throw settlementError;

      // Create settlement allocations (waterfall tracking)
      const allocationsToInsert = data.allocations.map((alloc) => ({
        settlement_id: settlement.id,
        group_entry_id: alloc.entryId,
        allocated_amount: alloc.amount,
      }));

      const { error: allocError } = await (supabase as any)
        .from("tea_shop_group_settlement_allocations")
        .insert(allocationsToInsert);

      if (allocError) throw allocError;

      // Note: Entry payment status is updated via trigger

      return settlement as TeaShopGroupSettlement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.settlements(variables.siteGroupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.entries(variables.siteGroupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.pending(variables.siteGroupId),
      });
    },
  });
}

// =============================================================================
// DELETE GROUP SETTLEMENT
// =============================================================================

export function useDeleteGroupTeaShopSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      siteGroupId,
    }: {
      id: string;
      siteGroupId: string;
    }) => {
      await ensureFreshSession();

      // Allocations are deleted via CASCADE, and trigger updates entry statuses
      const { error } = await (supabase as any)
        .from("tea_shop_group_settlements")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.settlements(variables.siteGroupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.entries(variables.siteGroupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupTeaShop.pending(variables.siteGroupId),
      });
    },
  });
}

// =============================================================================
// HELPER: Smart Amount Allocation (Rounding)
// =============================================================================

/**
 * Allocate a total amount across sites based on percentages
 * Uses smart rounding to avoid decimals while ensuring sum equals total
 */
export function allocateAmounts(
  total: number,
  percentages: number[]
): number[] {
  if (percentages.length === 0) return [];
  if (total <= 0) return percentages.map(() => 0);

  // Floor each amount
  const amounts = percentages.map((p) => Math.floor((p / 100) * total));

  // Calculate remainder
  const allocated = amounts.reduce((a, b) => a + b, 0);
  let remainder = total - allocated;

  // Distribute remainder to sites with largest fractional parts
  const fractionalParts = percentages.map((p, i) => ({
    index: i,
    fraction: ((p / 100) * total) - amounts[i],
  }));
  fractionalParts.sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remainder; i++) {
    amounts[fractionalParts[i].index]++;
  }

  return amounts;
}
