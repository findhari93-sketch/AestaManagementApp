"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  InterSiteSettlement,
  InterSiteSettlementWithDetails,
  InterSiteBalance,
  SiteSettlementSummary,
  InterSiteSettlementStatus,
  SettlementPaymentFormData,
} from "@/types/material.types";

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if error is due to missing table or query issues
 */
function isQueryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42P01" ||
    err.code === "PGRST" ||
    (err.message?.includes("relation") ?? false) ||
    (err.message?.includes("does not exist") ?? false) ||
    (err.message?.includes("Could not find") ?? false)
  );
}

// ============================================
// FETCH SETTLEMENTS
// ============================================

/**
 * Fetch all settlements for a site (where site is either creditor or debtor)
 */
export function useInterSiteSettlements(
  siteId: string | undefined,
  status?: InterSiteSettlementStatus
) {
  const supabase = createClient();

  return useQuery({
    queryKey: status
      ? [...queryKeys.interSiteSettlements.bySite(siteId || ""), status]
      : queryKeys.interSiteSettlements.bySite(siteId || ""),
    queryFn: async () => {
      if (!siteId) return [] as InterSiteSettlementWithDetails[];

      try {
        let query = (supabase as any)
          .from("inter_site_material_settlements")
          .select(`
            *,
            from_site:sites!inter_site_material_settlements_from_site_id_fkey(id, name),
            to_site:sites!inter_site_material_settlements_to_site_id_fkey(id, name),
            site_group:site_groups(id, name)
          `)
          .or(`from_site_id.eq.${siteId},to_site_id.eq.${siteId}`)
          .order("created_at", { ascending: false });

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error } = await query;
        if (error) {
          if (isQueryError(error)) {
            console.warn("Inter-site settlements query failed:", error.message);
            return [] as InterSiteSettlementWithDetails[];
          }
          throw error;
        }
        return (data || []) as InterSiteSettlementWithDetails[];
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Inter-site settlements query failed:", err);
          return [] as InterSiteSettlementWithDetails[];
        }
        throw err;
      }
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch a single settlement with full details
 */
export function useInterSiteSettlement(settlementId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: settlementId
      ? queryKeys.interSiteSettlements.byId(settlementId)
      : ["inter-site-settlements", "detail"],
    queryFn: async () => {
      if (!settlementId) return null;

      // Get settlement with related data
      const { data: settlement, error: settlementError } = await (supabase as any)
        .from("inter_site_material_settlements")
        .select(`
          *,
          from_site:sites!inter_site_material_settlements_from_site_id_fkey(id, name),
          to_site:sites!inter_site_material_settlements_to_site_id_fkey(id, name),
          site_group:site_groups(id, name)
        `)
        .eq("id", settlementId)
        .single();

      if (settlementError) throw settlementError;

      // Get settlement items
      const { data: items, error: itemsError } = await (supabase as any)
        .from("inter_site_settlement_items")
        .select(`
          *,
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name)
        `)
        .eq("settlement_id", settlementId)
        .order("usage_date", { ascending: false });

      if (itemsError) throw itemsError;

      // Get payment records
      const { data: payments, error: paymentsError } = await (supabase as any)
        .from("inter_site_settlement_payments")
        .select("*")
        .eq("settlement_id", settlementId)
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      return {
        ...settlement,
        items: items || [],
        payments: payments || [],
      } as InterSiteSettlementWithDetails;
    },
    enabled: !!settlementId,
  });
}

// ============================================
// BALANCE CALCULATIONS
// ============================================

/**
 * Calculate pending balances between sites in a group
 * This aggregates unsettled transactions to show who owes whom
 */
export function useInterSiteBalances(groupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? queryKeys.interSiteSettlements.balances(groupId)
      : ["inter-site-settlements", "balances"],
    queryFn: async () => {
      if (!groupId) return [] as InterSiteBalance[];

      try {
        // Get all usage transactions that haven't been settled (old approach)
        const { data: usageTransactions, error: txError } = await (supabase as any)
          .from("group_stock_transactions")
          .select(`
            *,
            material:materials(id, name, code, unit),
            usage_site:sites!group_stock_transactions_usage_site_id_fkey(id, name),
            payment_source_site:sites!group_stock_transactions_payment_source_site_id_fkey(id, name)
          `)
          .eq("site_group_id", groupId)
          .eq("transaction_type", "usage")
          .is("settlement_id", null) // Not yet settled
          .not("usage_site_id", "is", null)
          .order("transaction_date", { ascending: false });

        if (txError) {
          if (isQueryError(txError)) {
            console.warn("Group stock transactions query failed:", txError.message);
          } else {
            throw txError;
          }
        }

        // ALSO get pending batch usage records (new approach)
        const { data: batchUsageRecords, error: batchError } = await (supabase as any)
          .from("batch_usage_records")
          .select(`
            *,
            material:materials(id, name, code, unit),
            usage_site:sites!batch_usage_records_usage_site_id_fkey(id, name),
            batch:material_purchase_expenses!batch_usage_records_batch_ref_code_fkey(
              ref_code,
              paying_site_id,
              site_id,
              paying_site:sites!material_purchase_expenses_paying_site_id_fkey(id, name)
            )
          `)
          .eq("site_group_id", groupId)
          .eq("settlement_status", "pending")
          .not("usage_site_id", "is", null)
          .eq("is_self_use", false) // Exclude self-use
          .order("usage_date", { ascending: false });

        if (batchError) {
          if (isQueryError(batchError)) {
            console.warn("Batch usage records query failed:", batchError.message);
          } else {
            throw batchError;
          }
        }

        // Get related purchase transactions to identify payment source
        const { data: purchaseTransactions, error: purchaseError } = await (supabase as any)
          .from("group_stock_transactions")
          .select(`
            *,
            payment_source_site:sites!group_stock_transactions_payment_source_site_id_fkey(id, name)
          `)
          .eq("site_group_id", groupId)
          .eq("transaction_type", "purchase")
          .not("payment_source_site_id", "is", null);

        if (purchaseError) {
          if (isQueryError(purchaseError)) {
            console.warn("Purchase transactions query failed:", purchaseError.message);
            return [] as InterSiteBalance[];
          }
          throw purchaseError;
        }

        // Get group info
        const { data: group, error: groupError } = await (supabase as any)
          .from("site_groups")
          .select("id, name")
          .eq("id", groupId)
          .single();

        if (groupError) {
          if (isQueryError(groupError)) {
            console.warn("Site group query failed:", groupError.message);
            return [] as InterSiteBalance[];
          }
          throw groupError;
        }

        // Aggregate balances: for each usage by site X of material paid by site Y
        // Site X owes Site Y the usage cost
        const balanceMap = new Map<string, InterSiteBalance>();

        for (const tx of usageTransactions || []) {
          if (!tx.usage_site_id || !tx.payment_source_site_id) continue;

          // Skip if the using site is the same as the paying site
          if (tx.usage_site_id === tx.payment_source_site_id) continue;

          const key = `${tx.payment_source_site_id}-${tx.usage_site_id}`;
          const amount = Math.abs(tx.total_cost || 0);

          if (balanceMap.has(key)) {
            const existing = balanceMap.get(key)!;
            existing.total_amount_owed += amount;
            existing.transaction_count += 1;
            existing.total_quantity += Math.abs(tx.quantity || 0);
          } else {
            balanceMap.set(key, {
              site_group_id: groupId,
              group_name: group.name,
              creditor_site_id: tx.payment_source_site_id,
              creditor_site_name: tx.payment_source_site?.name || "Unknown",
              debtor_site_id: tx.usage_site_id,
              debtor_site_name: tx.usage_site?.name || "Unknown",
              year: new Date().getFullYear(),
              week_number: getWeekNumber(new Date()),
              week_start: getWeekStart(new Date()).toISOString().split("T")[0],
              week_end: getWeekEnd(new Date()).toISOString().split("T")[0],
              transaction_count: 1,
              material_count: 1,
              total_quantity: Math.abs(tx.quantity || 0),
              total_amount_owed: amount,
              is_settled: false,
            });
          }
        }

        // Process batch usage records (new approach)
        for (const record of batchUsageRecords || []) {
          const paymentSourceSiteId = record.batch?.paying_site_id || record.batch?.site_id;

          if (!record.usage_site_id || !paymentSourceSiteId) continue;

          // Skip if the using site is the same as the paying site
          if (record.usage_site_id === paymentSourceSiteId) continue;

          const key = `${paymentSourceSiteId}-${record.usage_site_id}`;
          const amount = record.total_cost || 0;

          if (balanceMap.has(key)) {
            const existing = balanceMap.get(key)!;
            existing.total_amount_owed += amount;
            existing.transaction_count += 1;
            existing.total_quantity += record.quantity || 0;
          } else {
            balanceMap.set(key, {
              site_group_id: groupId,
              group_name: group.name,
              creditor_site_id: paymentSourceSiteId,
              creditor_site_name: record.batch?.paying_site?.name || "Unknown",
              debtor_site_id: record.usage_site_id,
              debtor_site_name: record.usage_site?.name || "Unknown",
              year: new Date(record.usage_date).getFullYear(),
              week_number: getWeekNumber(new Date(record.usage_date)),
              week_start: getWeekStart(new Date(record.usage_date)).toISOString().split("T")[0],
              week_end: getWeekEnd(new Date(record.usage_date)).toISOString().split("T")[0],
              transaction_count: 1,
              material_count: 1,
              total_quantity: record.quantity || 0,
              total_amount_owed: amount,
              is_settled: false,
            });
          }
        }

        return Array.from(balanceMap.values());
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Inter-site balances calculation failed:", err);
          return [] as InterSiteBalance[];
        }
        throw err;
      }
    },
    enabled: !!groupId,
  });
}

/**
 * Get settlement summary for a site
 * Shows total owed to the site and total the site owes
 */
export function useSiteSettlementSummary(siteId: string | undefined) {
  const supabase = createClient();

  const defaultSummary = {
    site_id: siteId || "",
    site_name: "",
    group_id: "",
    group_name: "",
    total_owed_to_you: 0,
    total_you_owe: 0,
    net_balance: 0,
    pending_settlements_count: 0,
  } as SiteSettlementSummary;

  return useQuery({
    queryKey: siteId
      ? queryKeys.interSiteSettlements.summary(siteId)
      : ["inter-site-settlements", "summary"],
    queryFn: async () => {
      if (!siteId) return defaultSummary;

      try {
        // Get site info with group
        const { data: site, error: siteError } = await (supabase as any)
          .from("sites")
          .select(`
            id, name, site_group_id,
            site_group:site_groups(id, name)
          `)
          .eq("id", siteId)
          .single();

        if (siteError || !site?.site_group_id) {
          return {
            ...defaultSummary,
            site_name: site?.name || "",
          };
        }

        // Get pending settlements where site is creditor (from_site)
        const { data: asCreditor, error: creditorError } = await (supabase as any)
          .from("inter_site_material_settlements")
          .select("total_amount, paid_amount")
          .eq("from_site_id", siteId)
          .in("status", ["pending", "approved"]);

        if (creditorError) {
          if (isQueryError(creditorError)) {
            console.warn("Creditor settlements query failed:", creditorError.message);
            return { ...defaultSummary, site_name: site.name };
          }
          throw creditorError;
        }

        // Get pending settlements where site is debtor (to_site)
        const { data: asDebtor, error: debtorError } = await (supabase as any)
          .from("inter_site_material_settlements")
          .select("total_amount, paid_amount")
          .eq("to_site_id", siteId)
          .in("status", ["pending", "approved"]);

        if (debtorError) {
          if (isQueryError(debtorError)) {
            console.warn("Debtor settlements query failed:", debtorError.message);
            return { ...defaultSummary, site_name: site.name };
          }
          throw debtorError;
        }

        // Also check for unsettled transactions (not yet converted to settlements)
        const { data: unsettledUsage, error: usageError } = await (supabase as any)
          .from("group_stock_transactions")
          .select("total_cost, usage_site_id, payment_source_site_id")
          .eq("site_group_id", site.site_group_id)
          .eq("transaction_type", "usage")
          .is("settlement_id", null);

        if (usageError) {
          if (isQueryError(usageError)) {
            console.warn("Unsettled usage query failed:", usageError.message);
            return { ...defaultSummary, site_name: site.name };
          }
          throw usageError;
        }

        // Calculate totals from formal settlements
        const owedToYou = (asCreditor || []).reduce(
          (sum: number, s: { total_amount: number; paid_amount: number }) =>
            sum + (s.total_amount - s.paid_amount),
          0
        );

        const youOwe = (asDebtor || []).reduce(
          (sum: number, s: { total_amount: number; paid_amount: number }) =>
            sum + (s.total_amount - s.paid_amount),
          0
        );

        // Add unsettled transaction amounts
        let unsettledOwedToYou = 0;
        let unsettledYouOwe = 0;

        for (const tx of unsettledUsage || []) {
          const amount = Math.abs(tx.total_cost || 0);
          if (tx.payment_source_site_id === siteId && tx.usage_site_id !== siteId) {
            // This site paid, another site used = they owe us
            unsettledOwedToYou += amount;
          } else if (tx.usage_site_id === siteId && tx.payment_source_site_id !== siteId) {
            // This site used, another site paid = we owe them
            unsettledYouOwe += amount;
          }
        }

        const totalOwedToYou = owedToYou + unsettledOwedToYou;
        const totalYouOwe = youOwe + unsettledYouOwe;

        return {
          site_id: siteId,
          site_name: site.name,
          group_id: site.site_group_id,
          group_name: site.site_group?.name || "",
          total_owed_to_you: totalOwedToYou,
          total_you_owe: totalYouOwe,
          net_balance: totalOwedToYou - totalYouOwe,
          pending_settlements_count: (asCreditor?.length || 0) + (asDebtor?.length || 0),
        } as SiteSettlementSummary;
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Settlement summary query failed:", err);
          return defaultSummary;
        }
        throw err;
      }
    },
    enabled: !!siteId,
  });
}

// ============================================
// SETTLEMENT MUTATIONS
// ============================================

/**
 * Generate a settlement from pending transactions
 */
export function useGenerateSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      siteGroupId: string;
      fromSiteId: string; // Creditor (paid for materials)
      toSiteId: string; // Debtor (used materials)
      year?: number;
      weekNumber?: number;
      userId?: string;
    }) => {
      await ensureFreshSession();

      const year = data.year || new Date().getFullYear();
      const weekNumber = data.weekNumber || getWeekNumber(new Date());

      // Get all unsettled usage transactions where:
      // - payment_source_site_id = fromSiteId (creditor paid)
      // - usage_site_id = toSiteId (debtor used)
      const { data: transactions, error: txError } = await (supabase as any)
        .from("group_stock_transactions")
        .select("*")
        .eq("site_group_id", data.siteGroupId)
        .eq("transaction_type", "usage")
        .eq("payment_source_site_id", data.fromSiteId)
        .eq("usage_site_id", data.toSiteId)
        .is("settlement_id", null);

      if (txError) throw txError;

      if (!transactions || transactions.length === 0) {
        throw new Error("No unsettled transactions found between these sites");
      }

      // Find batch_ref_code from batch_usage_records
      // Query batch_usage_records for the debtor site to find which batch they used
      const { data: batchUsageRecords, error: batchError } = await (supabase as any)
        .from("batch_usage_records")
        .select("batch_ref_code")
        .eq("site_group_id", data.siteGroupId)
        .eq("usage_site_id", data.toSiteId)
        .eq("settlement_status", "pending")
        .limit(1);

      if (batchError) {
        console.warn("Failed to find batch_ref_code:", batchError);
      }

      // Get the batch_ref_code (should be the same for all records in this settlement)
      const batchRefCode = batchUsageRecords?.[0]?.batch_ref_code || null;

      // Calculate total amount
      const totalAmount = transactions.reduce(
        (sum: number, tx: { total_cost: number }) => sum + Math.abs(tx.total_cost || 0),
        0
      );

      // Generate settlement code
      const settlementCode = `SET-${year}-W${weekNumber}-${generateShortId()}`;

      // Create settlement record
      const { data: settlement, error: settlementError } = await (supabase as any)
        .from("inter_site_material_settlements")
        .insert({
          settlement_code: settlementCode,
          site_group_id: data.siteGroupId,
          from_site_id: data.fromSiteId,
          to_site_id: data.toSiteId,
          batch_ref_code: batchRefCode, // NEW: Store batch reference for settlement dialog
          year,
          week_number: weekNumber,
          period_start: getWeekStart(new Date(year, 0, 1 + (weekNumber - 1) * 7))
            .toISOString()
            .split("T")[0],
          period_end: getWeekEnd(new Date(year, 0, 1 + (weekNumber - 1) * 7))
            .toISOString()
            .split("T")[0],
          total_amount: totalAmount,
          paid_amount: 0,
          // pending_amount is a generated column (total_amount - paid_amount)
          status: "pending",
          created_by: data.userId || null,
        })
        .select()
        .single();

      if (settlementError) throw settlementError;

      // Create settlement items from transactions
      const itemsToInsert = transactions.map((tx: {
        id: string;
        material_id: string;
        brand_id: string | null;
        quantity: number;
        unit_cost: number;
        total_cost: number;
        transaction_date: string;
      }) => ({
        settlement_id: settlement.id,
        material_id: tx.material_id,
        brand_id: tx.brand_id,
        quantity_used: Math.abs(tx.quantity),
        unit: "nos", // Will be updated from material
        unit_cost: tx.unit_cost || 0,
        total_cost: Math.abs(tx.total_cost || 0),
        transaction_id: tx.id,
        usage_date: tx.transaction_date,
      }));

      const { error: itemsError } = await (supabase as any)
        .from("inter_site_settlement_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Mark transactions as settled
      const txIds = transactions.map((tx: { id: string }) => tx.id);
      await (supabase as any)
        .from("group_stock_transactions")
        .update({ settlement_id: settlement.id })
        .in("id", txIds);

      return settlement as InterSiteSettlement;
    },
    onSuccess: (settlement) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.byGroup(settlement.site_group_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.balances(settlement.site_group_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.bySite(settlement.from_site_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.bySite(settlement.to_site_id),
      });
    },
  });
}

/**
 * Approve a settlement
 */
export function useApproveSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: { settlementId: string; userId?: string }) => {
      await ensureFreshSession();

      const { data: settlement, error } = await (supabase as any)
        .from("inter_site_material_settlements")
        .update({
          status: "approved",
          approved_by: data.userId || null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.settlementId)
        .select()
        .single();

      if (error) throw error;
      return settlement as InterSiteSettlement;
    },
    onSuccess: (settlement) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.byId(settlement.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.bySite(settlement.from_site_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.bySite(settlement.to_site_id),
      });
    },
  });
}

/**
 * Delete a settlement
 */
export function useDeleteSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (settlementId: string) => {
      await ensureFreshSession();

      // First, get settlement details for cache invalidation
      const { data: settlement, error: getError } = await (supabase as any)
        .from("inter_site_material_settlements")
        .select("site_group_id, from_site_id, to_site_id, settlement_code")
        .eq("id", settlementId)
        .single();

      if (getError) throw getError;

      // CRITICAL: Reset batch_usage_records back to unsettled state
      // This makes them reappear in "Unsettled Balances" after deletion
      const { error: resetBatchError } = await (supabase as any)
        .from("batch_usage_records")
        .update({
          settlement_id: null,
          settlement_status: 'pending', // Keep as pending so they show in Unsettled Balances
          updated_at: new Date().toISOString(),
        })
        .eq("settlement_id", settlementId);

      if (resetBatchError) {
        console.error("Error resetting batch usage records:", resetBatchError);
        throw new Error("Failed to reset batch usage records. Cannot delete settlement.");
      }

      // ALSO reset group_stock_transactions (used by Unsettled Balances query)
      const { error: resetTxError } = await (supabase as any)
        .from("group_stock_transactions")
        .update({
          settlement_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("settlement_id", settlementId);

      if (resetTxError) {
        console.error("Error resetting group stock transactions:", resetTxError);
        // Don't throw - this might not exist for batch-based settlements
      }

      // Delete settlement items
      const { error: itemsError } = await (supabase as any)
        .from("inter_site_settlement_items")
        .delete()
        .eq("settlement_id", settlementId);

      if (itemsError) throw itemsError;

      // Delete the settlement itself
      const { error } = await (supabase as any)
        .from("inter_site_material_settlements")
        .delete()
        .eq("id", settlementId);

      if (error) throw error;
      return settlement;
    },
    onSuccess: (settlement) => {
      // Invalidate all related settlement queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.byGroup(settlement.site_group_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.balances(settlement.site_group_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.bySite(settlement.from_site_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.bySite(settlement.to_site_id),
      });
    },
  });
}

/**
 * Record a payment against a settlement
 */
export function useRecordSettlementPayment() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: SettlementPaymentFormData & { userId?: string }) => {
      await ensureFreshSession();

      // Get current settlement
      const { data: settlement, error: getError } = await (supabase as any)
        .from("inter_site_material_settlements")
        .select("*")
        .eq("id", data.settlement_id)
        .single();

      if (getError) throw getError;

      // Create payment record
      const { data: payment, error: paymentError } = await (supabase as any)
        .from("inter_site_settlement_payments")
        .insert({
          settlement_id: data.settlement_id,
          payment_date: data.payment_date,
          amount: data.amount,
          payment_mode: data.payment_mode,
          reference_number: data.reference_number || null,
          notes: data.notes || null,
          recorded_by: data.userId || null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update settlement amounts
      const newPaidAmount = (settlement.paid_amount || 0) + data.amount;
      const newPendingAmount = settlement.total_amount - newPaidAmount;
      const newStatus = newPendingAmount <= 0 ? "settled" : settlement.status;

      const updateData: Record<string, unknown> = {
        paid_amount: newPaidAmount,
        pending_amount: Math.max(0, newPendingAmount),
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "settled") {
        updateData.settled_by = data.userId || null;
        updateData.settled_at = new Date().toISOString();
      }

      await (supabase as any)
        .from("inter_site_material_settlements")
        .update(updateData)
        .eq("id", data.settlement_id);

      return payment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.byId(variables.settlement_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.all,
      });
    },
  });
}

/**
 * Cancel a settlement
 */
export function useCancelSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      settlementId: string;
      reason: string;
      userId?: string;
    }) => {
      await ensureFreshSession();

      // Get settlement to get transaction IDs
      const { data: items, error: itemsError } = await (supabase as any)
        .from("inter_site_settlement_items")
        .select("transaction_id")
        .eq("settlement_id", data.settlementId);

      if (itemsError) throw itemsError;

      // Unmark transactions
      if (items && items.length > 0) {
        const txIds = items
          .map((i: { transaction_id: string | null }) => i.transaction_id)
          .filter(Boolean);

        if (txIds.length > 0) {
          await (supabase as any)
            .from("group_stock_transactions")
            .update({ settlement_id: null })
            .in("id", txIds);
        }
      }

      // Update settlement status
      const { data: settlement, error } = await (supabase as any)
        .from("inter_site_material_settlements")
        .update({
          status: "cancelled",
          cancelled_by: data.userId || null,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: data.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.settlementId)
        .select()
        .single();

      if (error) throw error;
      return settlement as InterSiteSettlement;
    },
    onSuccess: (settlement) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.byGroup(settlement.site_group_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.balances(settlement.site_group_id),
      });
    },
  });
}

// ============================================
// GROUP STOCK TRANSACTIONS
// ============================================

export interface GroupStockTransaction {
  id: string;
  site_group_id: string;
  inventory_id: string;
  material_id: string;
  brand_id: string | null;
  transaction_type: "purchase" | "usage" | "transfer" | "adjustment";
  quantity: number;
  unit_cost: number;
  total_cost: number;
  transaction_date: string;
  payment_source_site_id: string | null;
  usage_site_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  batch_ref_code: string | null;
  notes: string | null;
  recorded_by: string | null;
  settlement_id: string | null;
  created_at: string;
  // Joined data
  material?: { id: string; name: string; code: string; unit: string };
  brand?: { id: string; brand_name: string };
  payment_source_site?: { id: string; name: string };
  usage_site?: { id: string; name: string };
}

/**
 * Fetch all group stock transactions for a site group
 * Includes both purchases and usage transactions
 */
export function useGroupStockTransactions(
  groupId: string | undefined,
  options?: {
    transactionType?: "purchase" | "usage" | "transfer" | "adjustment";
    limit?: number;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? [...queryKeys.interSiteSettlements.balances(groupId), "transactions", options?.transactionType]
      : ["group-stock-transactions"],
    queryFn: async () => {
      if (!groupId) return [] as GroupStockTransaction[];

      try {
        let query = (supabase as any)
          .from("group_stock_transactions")
          .select(`
            *,
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name),
            payment_source_site:sites!group_stock_transactions_payment_source_site_id_fkey(id, name),
            usage_site:sites!group_stock_transactions_usage_site_id_fkey(id, name)
          `)
          .eq("site_group_id", groupId)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (options?.transactionType) {
          query = query.eq("transaction_type", options.transactionType);
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
          if (isQueryError(error)) {
            console.warn("Group stock transactions query failed:", error.message);
            return [] as GroupStockTransaction[];
          }
          throw error;
        }

        return (data || []) as GroupStockTransaction[];
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Group stock transactions query failed:", err);
          return [] as GroupStockTransaction[];
        }
        throw err;
      }
    },
    enabled: !!groupId,
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Sunday
  return end;
}

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
