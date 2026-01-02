"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type { TeaShopEntry, TeaShopSettlement } from "@/types/database.types";

// =============================================================================
// TYPES
// =============================================================================

export interface CombinedTeaShopEntry extends TeaShopEntry {
  site_id: string;
  site_name: string;
  source: "individual" | "group";
}

export interface CombinedTeaShopSettlement extends TeaShopSettlement {
  site_id: string;
  site_name: string;
  source: "individual" | "group";
}

interface SiteWithShop {
  id: string;
  name: string;
  tea_shop_id: string | null;
}

// =============================================================================
// COMBINED TEA SHOP ENTRIES
// Fetches entries from ALL sites in a group
// =============================================================================

export function useCombinedTeaShopEntries(
  siteGroupId: string | undefined,
  options?: { dateFrom?: string; dateTo?: string }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? [...queryKeys.combinedTeaShop.entries(siteGroupId), options]
      : ["combined-tea-shop", "entries"],
    queryFn: async (): Promise<CombinedTeaShopEntry[]> => {
      if (!siteGroupId) return [];

      // 1. Get all sites in the group
      const { data: sites, error: sitesError } = await (supabase as any)
        .from("sites")
        .select("id, name")
        .eq("site_group_id", siteGroupId)
        .order("name");

      if (sitesError) throw sitesError;
      if (!sites || sites.length === 0) return [];

      // Build a map of site_id -> site_name
      const siteIds = sites.map((s: any) => s.id);
      const siteNameMap = new Map<string, string>();
      sites.forEach((s: any) => siteNameMap.set(s.id, s.name));

      // 2. Fetch entries for all sites in the group (by site_id, not tea_shop_id)
      // This ensures we capture ALL historical entries regardless of which shop they belong to
      let query = (supabase as any)
        .from("tea_shop_entries")
        .select("*")
        .in("site_id", siteIds)
        .order("date", { ascending: false });

      if (options?.dateFrom) {
        query = query.gte("date", options.dateFrom);
      }
      if (options?.dateTo) {
        query = query.lte("date", options.dateTo);
      }

      const { data: entries, error: entriesError } = await query;
      if (entriesError) throw entriesError;

      // 3. Map entries with site names (entries already have site_id)
      const combinedEntries: CombinedTeaShopEntry[] = (entries || []).map(
        (entry: any) => {
          return {
            ...entry,
            site_name: siteNameMap.get(entry.site_id) || "Unknown Site",
            source: "individual" as const,
          };
        }
      );

      // 4. Also fetch any legacy group entries (for backward compat)
      const { data: groupEntries } = await (supabase as any)
        .from("tea_shop_group_entries")
        .select(`
          *,
          allocations:tea_shop_group_allocations(
            site_id,
            allocated_amount,
            site:sites(id, name)
          )
        `)
        .eq("site_group_id", siteGroupId)
        .order("date", { ascending: false });

      // Convert group entries to combined format
      if (groupEntries && groupEntries.length > 0) {
        groupEntries.forEach((ge: any) => {
          // Add one combined entry per group entry (showing as "Group" source)
          // Use unknown cast since group entries have different structure
          combinedEntries.push({
            id: ge.id,
            tea_shop_id: ge.tea_shop_id,
            date: ge.date,
            tea_count: null,
            tea_rate: null,
            tea_total: null,
            snacks_count: null,
            snacks_rate: null,
            snacks_total: null,
            total_amount: ge.total_amount,
            notes: ge.notes,
            entered_by: ge.entered_by,
            created_at: ge.created_at,
            updated_at: ge.updated_at,
            site_id: siteGroupId, // Use group ID for group entries
            site_name: "All Sites (Group)",
            source: "group" as const,
            // Include payment status from group entry
            amount_paid: ge.amount_paid,
            is_fully_paid: ge.is_fully_paid,
          } as unknown as CombinedTeaShopEntry);
        });
      }

      // Sort all entries by date descending
      combinedEntries.sort((a, b) => b.date.localeCompare(a.date));

      return combinedEntries;
    },
    enabled: !!siteGroupId,
  });
}

// =============================================================================
// COMBINED TEA SHOP PENDING BALANCE
// Calculates pending from ALL sites in group
// =============================================================================

export function useCombinedTeaShopPendingBalance(
  siteGroupId: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? queryKeys.combinedTeaShop.pending(siteGroupId)
      : ["combined-tea-shop", "pending"],
    queryFn: async () => {
      if (!siteGroupId)
        return { entriesTotal: 0, paidTotal: 0, pending: 0 };

      // Get all sites in the group
      const { data: sites } = await (supabase as any)
        .from("sites")
        .select("id")
        .eq("site_group_id", siteGroupId);

      if (!sites || sites.length === 0)
        return { entriesTotal: 0, paidTotal: 0, pending: 0 };

      const siteIds = sites.map((s: any) => s.id);

      // Get total entries amount from individual entries (by site_id, not tea_shop_id)
      // This ensures we capture ALL historical entries regardless of which shop they belong to
      const { data: entries } = await (supabase as any)
        .from("tea_shop_entries")
        .select("total_amount")
        .in("site_id", siteIds);

      const individualEntriesTotal =
        entries?.reduce(
          (sum: number, e: { total_amount: number }) =>
            sum + (e.total_amount || 0),
          0
        ) || 0;

      // Get total from group entries
      const { data: groupEntries } = await (supabase as any)
        .from("tea_shop_group_entries")
        .select("total_amount")
        .eq("site_group_id", siteGroupId);

      const groupEntriesTotal =
        groupEntries?.reduce(
          (sum: number, e: { total_amount: number }) =>
            sum + (e.total_amount || 0),
          0
        ) || 0;

      const entriesTotal = individualEntriesTotal + groupEntriesTotal;

      // Get ALL tea shop accounts for sites in group (including inactive - for historical settlements)
      const { data: shops } = await (supabase as any)
        .from("tea_shop_accounts")
        .select("id")
        .in("site_id", siteIds);

      const shopIds = (shops || []).map((s: any) => s.id);

      // Get total settled amount from individual settlements (need tea_shop_id since settlements don't have site_id)
      const { data: settlements } = shopIds.length > 0
        ? await (supabase as any)
            .from("tea_shop_settlements")
            .select("amount_paid")
            .in("tea_shop_id", shopIds)
        : { data: [] };

      const individualPaidTotal =
        settlements?.reduce(
          (sum: number, s: { amount_paid: number }) =>
            sum + (s.amount_paid || 0),
          0
        ) || 0;

      // Get total from group settlements
      const { data: groupSettlements } = await (supabase as any)
        .from("tea_shop_group_settlements")
        .select("amount_paid")
        .eq("site_group_id", siteGroupId)
        .eq("is_cancelled", false);

      const groupPaidTotal =
        groupSettlements?.reduce(
          (sum: number, s: { amount_paid: number }) =>
            sum + (s.amount_paid || 0),
          0
        ) || 0;

      const paidTotal = individualPaidTotal + groupPaidTotal;

      return {
        entriesTotal,
        paidTotal,
        pending: entriesTotal - paidTotal,
      };
    },
    enabled: !!siteGroupId,
  });
}

// =============================================================================
// COMBINED TEA SHOP UNSETTLED ENTRIES
// Returns unsettled entries from ALL sites (oldest first for waterfall)
// =============================================================================

export function useCombinedTeaShopUnsettledEntries(
  siteGroupId: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? queryKeys.combinedTeaShop.unsettled(siteGroupId)
      : ["combined-tea-shop", "unsettled"],
    queryFn: async (): Promise<CombinedTeaShopEntry[]> => {
      if (!siteGroupId) return [];

      // Get all sites in the group
      const { data: sites } = await (supabase as any)
        .from("sites")
        .select("id, name")
        .eq("site_group_id", siteGroupId)
        .order("name");

      if (!sites || sites.length === 0) return [];

      const siteIds = sites.map((s: any) => s.id);
      const siteNameMap = new Map<string, string>();
      sites.forEach((s: any) => siteNameMap.set(s.id, s.name));

      // Fetch unsettled individual entries by site_id (oldest first for waterfall)
      // This ensures we capture ALL historical entries regardless of which shop they belong to
      const { data: entries } = await (supabase as any)
        .from("tea_shop_entries")
        .select("*")
        .in("site_id", siteIds)
        .or("is_fully_paid.is.null,is_fully_paid.eq.false")
        .order("date", { ascending: true });

      const combinedEntries: CombinedTeaShopEntry[] = (entries || []).map(
        (entry: any) => {
          return {
            ...entry,
            site_name: siteNameMap.get(entry.site_id) || "Unknown Site",
            source: "individual" as const,
          };
        }
      );

      // Also fetch unsettled group entries
      const { data: groupEntries } = await (supabase as any)
        .from("tea_shop_group_entries")
        .select("*")
        .eq("site_group_id", siteGroupId)
        .or("is_fully_paid.is.null,is_fully_paid.eq.false")
        .order("date", { ascending: true });

      if (groupEntries && groupEntries.length > 0) {
        groupEntries.forEach((ge: any) => {
          combinedEntries.push({
            id: ge.id,
            tea_shop_id: ge.tea_shop_id,
            date: ge.date,
            tea_count: null,
            tea_rate: null,
            tea_total: null,
            snacks_count: null,
            snacks_rate: null,
            snacks_total: null,
            total_amount: ge.total_amount,
            notes: ge.notes,
            entered_by: ge.entered_by,
            created_at: ge.created_at,
            updated_at: ge.updated_at,
            site_id: siteGroupId,
            site_name: "All Sites (Group)",
            source: "group" as const,
            amount_paid: ge.amount_paid,
            is_fully_paid: ge.is_fully_paid,
          } as unknown as CombinedTeaShopEntry);
        });
      }

      // Sort by date ascending for waterfall (oldest first)
      combinedEntries.sort((a, b) => a.date.localeCompare(b.date));

      return combinedEntries;
    },
    enabled: !!siteGroupId,
  });
}

// =============================================================================
// COMBINED TEA SHOP SETTLEMENTS
// Fetches settlements from ALL sites in a group
// =============================================================================

export function useCombinedTeaShopSettlements(
  siteGroupId: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteGroupId
      ? queryKeys.combinedTeaShop.settlements(siteGroupId)
      : ["combined-tea-shop", "settlements"],
    queryFn: async (): Promise<CombinedTeaShopSettlement[]> => {
      if (!siteGroupId) return [];

      // Get all sites in the group
      const { data: sites } = await (supabase as any)
        .from("sites")
        .select("id, name")
        .eq("site_group_id", siteGroupId)
        .order("name");

      if (!sites || sites.length === 0) return [];

      const siteIds = sites.map((s: any) => s.id);
      const siteNameMap = new Map<string, string>();
      sites.forEach((s: any) => siteNameMap.set(s.id, s.name));

      // Get ALL tea shop accounts for sites in group (including inactive - for historical settlements)
      const { data: shops } = await (supabase as any)
        .from("tea_shop_accounts")
        .select("id, site_id")
        .in("site_id", siteIds);

      const shopSiteMap = new Map<string, string>();
      (shops || []).forEach((shop: any) => {
        if (shop.site_id) {
          shopSiteMap.set(shop.id, shop.site_id);
        }
      });

      const shopIds = Array.from(shopSiteMap.keys());

      // Fetch individual settlements (settlements don't have site_id, so we query by tea_shop_id)
      const { data: settlements } = shopIds.length > 0
        ? await (supabase as any)
            .from("tea_shop_settlements")
            .select("*, subcontracts(id, title)")
            .in("tea_shop_id", shopIds)
            .order("payment_date", { ascending: false })
        : { data: [] };

      const combinedSettlements: CombinedTeaShopSettlement[] = (
        settlements || []
      ).map((s: TeaShopSettlement) => {
        const siteId = shopSiteMap.get(s.tea_shop_id) || "";
        return {
          ...s,
          site_id: siteId,
          site_name: siteNameMap.get(siteId) || "Unknown Site",
          source: "individual" as const,
        };
      });

      // Also fetch group settlements
      const { data: groupSettlements } = await (supabase as any)
        .from("tea_shop_group_settlements")
        .select("*, subcontracts(id, title)")
        .eq("site_group_id", siteGroupId)
        .eq("is_cancelled", false)
        .order("payment_date", { ascending: false });

      if (groupSettlements && groupSettlements.length > 0) {
        groupSettlements.forEach((gs: any) => {
          combinedSettlements.push({
            id: gs.id,
            tea_shop_id: gs.tea_shop_id,
            amount_paid: gs.amount_paid,
            payment_date: gs.payment_date,
            payment_mode: gs.payment_mode,
            payer_type: gs.payer_type,
            notes: gs.notes,
            created_at: gs.created_at,
            updated_at: gs.updated_at,
            site_id: siteGroupId,
            site_name: "All Sites (Group)",
            source: "group" as const,
            // Include additional group settlement fields
            settlement_reference: gs.settlement_reference,
            proof_url: gs.proof_url,
            is_engineer_settled: gs.is_engineer_settled,
            subcontracts: gs.subcontracts,
          } as unknown as CombinedTeaShopSettlement);
        });
      }

      // Sort by payment date descending
      combinedSettlements.sort((a, b) =>
        b.payment_date.localeCompare(a.payment_date)
      );

      return combinedSettlements;
    },
    enabled: !!siteGroupId,
  });
}

// =============================================================================
// HELPER: Get attendance counts for all sites in group on a date
// =============================================================================

export function useCombinedGroupAttendance(
  siteGroupId: string | undefined,
  date: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey:
      siteGroupId && date
        ? ["combined-tea-shop", "attendance", siteGroupId, date]
        : ["combined-tea-shop", "attendance"],
    queryFn: async () => {
      if (!siteGroupId || !date) return new Map<string, { named: number; market: number }>();

      // Get all sites in the group
      const { data: sites } = await (supabase as any)
        .from("sites")
        .select("id, name")
        .eq("site_group_id", siteGroupId)
        .order("name");

      if (!sites || sites.length === 0) return new Map();

      const attendanceMap = new Map<string, { named: number; market: number; siteName: string }>();

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

        attendanceMap.set(site.id, {
          named: namedCount,
          market: marketCount,
          siteName: site.name,
        });
      }

      return attendanceMap;
    },
    enabled: !!siteGroupId && !!date,
  });
}
