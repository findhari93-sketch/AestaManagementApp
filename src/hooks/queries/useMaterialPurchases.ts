"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  MaterialPurchaseExpense,
  MaterialPurchaseExpenseWithDetails,
  MaterialPurchaseType,
  MaterialBatchStatus,
  MaterialPurchaseExpenseFormData,
  GroupStockBatch,
  CompleteBatchFormData,
  ConvertToOwnSiteFormData,
  MaterialPaymentMode,
} from "@/types/material.types";
import type { PayerSource } from "@/types/settlement.types";

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
// FETCH MATERIAL PURCHASES
// ============================================

/**
 * Fetch all material purchases for a site
 */
export function useMaterialPurchases(
  siteId: string | undefined,
  options?: {
    type?: MaterialPurchaseType;
    status?: MaterialBatchStatus;
    limit?: number;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: options?.type === "own_site"
      ? queryKeys.materialPurchases.ownSite(siteId || "")
      : queryKeys.materialPurchases.bySite(siteId || ""),
    queryFn: async () => {
      if (!siteId) return [] as MaterialPurchaseExpenseWithDetails[];

      try {
        let query = (supabase as any)
          .from("material_purchase_expenses")
          .select(`
            *,
            site:sites(id, name),
            vendor:vendors(id, name),
            site_group:site_groups(id, name),
            items:material_purchase_expense_items(
              *,
              material:materials(id, name, code, unit),
              brand:material_brands(id, brand_name)
            )
          `)
          .eq("site_id", siteId)
          .order("purchase_date", { ascending: false });

        if (options?.type) {
          query = query.eq("purchase_type", options.type);
        }

        if (options?.status) {
          query = query.eq("status", options.status);
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) {
          if (isQueryError(error)) {
            console.warn("Material purchases query failed:", error.message);
            return [] as MaterialPurchaseExpenseWithDetails[];
          }
          throw error;
        }
        return (data || []) as MaterialPurchaseExpenseWithDetails[];
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Material purchases query failed:", err);
          return [] as MaterialPurchaseExpenseWithDetails[];
        }
        throw err;
      }
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch material purchases for a group (group stock only)
 */
export function useGroupMaterialPurchases(
  groupId: string | undefined,
  options?: {
    status?: MaterialBatchStatus;
    limit?: number;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.materialPurchases.groupStock(groupId || ""),
    queryFn: async () => {
      if (!groupId) return [] as MaterialPurchaseExpenseWithDetails[];

      try {
        let query = (supabase as any)
          .from("material_purchase_expenses")
          .select(`
            *,
            site:sites(id, name),
            vendor:vendors(id, name),
            site_group:site_groups(id, name),
            items:material_purchase_expense_items(
              *,
              material:materials(id, name, code, unit),
              brand:material_brands(id, brand_name)
            )
          `)
          .eq("site_group_id", groupId)
          .eq("purchase_type", "group_stock")
          .order("purchase_date", { ascending: false });

        if (options?.status) {
          query = query.eq("status", options.status);
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) {
          if (isQueryError(error)) {
            console.warn("Group material purchases query failed:", error.message);
            return [] as MaterialPurchaseExpenseWithDetails[];
          }
          throw error;
        }
        return (data || []) as MaterialPurchaseExpenseWithDetails[];
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Group material purchases query failed:", err);
          return [] as MaterialPurchaseExpenseWithDetails[];
        }
        throw err;
      }
    },
    enabled: !!groupId,
  });
}

/**
 * Fetch a single material purchase by ID
 */
export function useMaterialPurchaseById(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: id
      ? queryKeys.materialPurchases.byId(id)
      : ["material-purchases", "detail"],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await (supabase as any)
        .from("material_purchase_expenses")
        .select(`
          *,
          site:sites(id, name),
          vendor:vendors(id, name),
          site_group:site_groups(id, name),
          items:material_purchase_expense_items(
            *,
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as MaterialPurchaseExpenseWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Fetch a material purchase by reference code
 */
export function useMaterialPurchaseByRefCode(refCode: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: refCode
      ? queryKeys.materialPurchases.byRefCode(refCode)
      : ["material-purchases", "ref"],
    queryFn: async () => {
      if (!refCode) return null;

      const { data, error } = await (supabase as any)
        .from("material_purchase_expenses")
        .select(`
          *,
          site:sites(id, name),
          vendor:vendors(id, name),
          site_group:site_groups(id, name),
          items:material_purchase_expense_items(
            *,
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          )
        `)
        .eq("ref_code", refCode)
        .single();

      if (error) throw error;
      return data as MaterialPurchaseExpenseWithDetails;
    },
    enabled: !!refCode,
  });
}

// ============================================
// GROUP STOCK BATCHES
// ============================================

/**
 * Fetch group stock batches for a site group
 */
export function useGroupStockBatches(
  groupId: string | undefined,
  options?: {
    status?: MaterialBatchStatus | MaterialBatchStatus[];
    limit?: number;
    enabled?: boolean;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.materialPurchases.batches(groupId || ""),
    queryFn: async () => {
      if (!groupId) return [] as GroupStockBatch[];

      try {
        // Get group stock purchases
        let query = (supabase as any)
          .from("material_purchase_expenses")
          .select(`
            *,
            site:sites(id, name),
            vendor:vendors(id, name),
            items:material_purchase_expense_items(
              *,
              material:materials(id, name, code, unit),
              brand:material_brands(id, brand_name)
            )
          `)
          .eq("site_group_id", groupId)
          .eq("purchase_type", "group_stock")
          .order("purchase_date", { ascending: false });

        if (options?.status) {
          if (Array.isArray(options.status)) {
            query = query.in("status", options.status);
          } else {
            query = query.eq("status", options.status);
          }
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data: purchases, error } = await query;
        if (error) {
          if (isQueryError(error)) {
            console.warn("Group stock batches query failed:", error.message);
            return [] as GroupStockBatch[];
          }
          throw error;
        }

        // Transform to GroupStockBatch format
        const batches: GroupStockBatch[] = (purchases || []).map((p: any) => ({
          batch_code: p.ref_code, // Use ref_code as batch_code
          ref_code: p.ref_code,
          purchase_date: p.purchase_date,
          vendor_id: p.vendor_id,
          vendor_name: p.vendor_name || p.vendor?.name,
          payment_source_site_id: p.site_id,
          payment_source_site_name: p.site?.name,
          total_amount: p.total_amount,
          original_quantity: p.items?.reduce((sum: number, item: any) => sum + Number(item.quantity), 0) || 0,
          remaining_quantity: p.items?.reduce((sum: number, item: any) => sum + Number(item.quantity), 0) || 0, // TODO: Calculate from usage
          status: p.status,
          bill_url: p.bill_url,
          payment_mode: p.payment_mode,
          payment_reference: p.payment_reference,
          payment_screenshot_url: p.payment_screenshot_url,
          notes: p.notes,
          items: (p.items || []).map((item: any) => ({
            material_id: item.material_id,
            material_name: item.material?.name || "",
            material_code: item.material?.code,
            brand_id: item.brand_id,
            brand_name: item.brand?.brand_name,
            quantity: item.quantity,
            unit: item.material?.unit || "piece",
            unit_price: item.unit_price,
          })),
          allocations: [], // TODO: Calculate from usage transactions
        }));

        return batches;
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Group stock batches query failed:", err);
          return [] as GroupStockBatch[];
        }
        throw err;
      }
    },
    enabled: options?.enabled !== false && !!groupId,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Generate a reference code for a material purchase
 */
export function useGenerateMaterialRefCode() {
  const supabase = createClient();

  return useMutation({
    mutationFn: async (type: MaterialPurchaseType) => {
      const functionName = type === "own_site"
        ? "generate_material_purchase_reference"
        : "generate_group_stock_purchase_reference";

      const { data, error } = await (supabase as any).rpc(functionName);

      if (error) throw error;
      return data as string;
    },
  });
}

/**
 * Create a new material purchase expense
 */
export function useCreateMaterialPurchase() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MaterialPurchaseExpenseFormData) => {
      await ensureFreshSession();

      // Generate reference code
      const functionName = data.purchase_type === "own_site"
        ? "generate_material_purchase_reference"
        : "generate_group_stock_purchase_reference";

      const { data: refCode, error: refError } = await (supabase as any).rpc(functionName);
      if (refError) throw refError;

      // Calculate total amount from items
      const totalAmount = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      ) + (data.transport_cost || 0);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert purchase expense
      const { data: purchase, error: purchaseError } = await (supabase as any)
        .from("material_purchase_expenses")
        .insert({
          site_id: data.site_id,
          ref_code: refCode,
          purchase_type: data.purchase_type,
          vendor_id: data.vendor_id,
          vendor_name: data.vendor_name,
          purchase_date: data.purchase_date,
          total_amount: totalAmount,
          transport_cost: data.transport_cost || 0,
          payment_mode: data.payment_mode,
          payment_reference: data.payment_reference,
          payment_screenshot_url: data.payment_screenshot_url,
          is_paid: data.is_paid || false,
          paid_date: data.paid_date,
          bill_url: data.bill_url,
          status: data.purchase_type === "own_site" ? "completed" : "recorded",
          site_group_id: data.site_group_id,
          purchase_order_id: data.purchase_order_id || null,
          notes: data.notes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Insert items
      if (data.items.length > 0) {
        const items = data.items.map((item) => ({
          purchase_expense_id: purchase.id,
          material_id: item.material_id,
          brand_id: item.brand_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes,
        }));

        const { error: itemsError } = await (supabase as any)
          .from("material_purchase_expense_items")
          .insert(items);

        if (itemsError) throw itemsError;
      }

      return purchase as MaterialPurchaseExpense;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.materialPurchases.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.bySite(variables.site_id),
      });
      if (variables.site_group_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.materialPurchases.byGroup(variables.site_group_id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.materialPurchases.batches(variables.site_group_id),
        });
      }
    },
  });
}

/**
 * Update a material purchase expense
 */
export function useUpdateMaterialPurchase() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<MaterialPurchaseExpenseFormData>;
    }) => {
      await ensureFreshSession();

      // Calculate total amount if items are provided
      let totalAmount = data.items
        ? data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) +
          (data.transport_cost || 0)
        : undefined;

      // Update purchase expense
      const updateData: Record<string, any> = {};
      if (data.vendor_id !== undefined) updateData.vendor_id = data.vendor_id;
      if (data.vendor_name !== undefined) updateData.vendor_name = data.vendor_name;
      if (data.purchase_date !== undefined) updateData.purchase_date = data.purchase_date;
      if (totalAmount !== undefined) updateData.total_amount = totalAmount;
      if (data.transport_cost !== undefined) updateData.transport_cost = data.transport_cost;
      if (data.payment_mode !== undefined) updateData.payment_mode = data.payment_mode;
      if (data.payment_reference !== undefined) updateData.payment_reference = data.payment_reference;
      if (data.payment_screenshot_url !== undefined) updateData.payment_screenshot_url = data.payment_screenshot_url;
      if (data.is_paid !== undefined) updateData.is_paid = data.is_paid;
      if (data.paid_date !== undefined) updateData.paid_date = data.paid_date;
      if (data.bill_url !== undefined) updateData.bill_url = data.bill_url;
      if (data.notes !== undefined) updateData.notes = data.notes;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await (supabase as any)
          .from("material_purchase_expenses")
          .update(updateData)
          .eq("id", id);

        if (updateError) throw updateError;
      }

      // Update items if provided
      if (data.items) {
        // Delete existing items
        await (supabase as any)
          .from("material_purchase_expense_items")
          .delete()
          .eq("purchase_expense_id", id);

        // Insert new items
        if (data.items.length > 0) {
          const items = data.items.map((item) => ({
            purchase_expense_id: id,
            material_id: item.material_id,
            brand_id: item.brand_id || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.notes,
          }));

          const { error: itemsError } = await (supabase as any)
            .from("material_purchase_expense_items")
            .insert(items);

          if (itemsError) throw itemsError;
        }
      }

      return { id };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialPurchases.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.materialPurchases.byId(id) });
    },
  });
}

/**
 * Delete a material purchase expense
 */
export function useDeleteMaterialPurchase() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await ensureFreshSession();

      // Items will be deleted automatically via ON DELETE CASCADE
      const { error } = await (supabase as any)
        .from("material_purchase_expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialPurchases.all });
    },
  });
}

// ============================================
// SETTLEMENT
// ============================================

/**
 * Generate a settlement reference code
 */
function generateSettlementRef(): string {
  const shortId = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `PSET-${shortId}`;
}

/**
 * Form data for settling a material purchase
 */
export interface SettleMaterialPurchaseData {
  id: string;
  settlement_date: string;
  payment_mode: MaterialPaymentMode;
  payer_source: PayerSource;
  payer_name?: string;
  payment_reference?: string;
  bill_url?: string;
  payment_screenshot_url?: string;
  notes?: string;
}

/**
 * Settle a material purchase expense
 * Generates a settlement reference and marks the purchase as settled
 */
export function useSettleMaterialPurchase() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SettleMaterialPurchaseData) => {
      await ensureFreshSession();

      const settlementRef = generateSettlementRef();

      const { error } = await (supabase as any)
        .from("material_purchase_expenses")
        .update({
          settlement_reference: settlementRef,
          settlement_date: data.settlement_date,
          settlement_payer_source: data.payer_source,
          settlement_payer_name: data.payer_name || null,
          payment_mode: data.payment_mode,
          payment_reference: data.payment_reference || null,
          bill_url: data.bill_url || null,
          payment_screenshot_url: data.payment_screenshot_url || null,
          is_paid: true,
          paid_date: data.settlement_date,
          notes: data.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);

      if (error) throw error;
      return { id: data.id, settlement_reference: settlementRef };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialPurchases.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
    },
  });
}

/**
 * Complete a group stock batch by allocating usage to sites
 */
export function useCompleteGroupStockBatch() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CompleteBatchFormData) => {
      await ensureFreshSession();

      const { data: result, error } = await (supabase as any).rpc(
        "complete_group_stock_batch",
        {
          p_batch_code: data.batch_code,
          p_site_allocations: data.allocations,
        }
      );

      if (error) throw error;
      return { child_ref_codes: result };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialPurchases.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupStock.all });
    },
  });
}

/**
 * Convert a group stock purchase to own site purchase
 */
export function useConvertGroupToOwnSite() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ConvertToOwnSiteFormData) => {
      await ensureFreshSession();

      const { data: newRefCode, error } = await (supabase as any).rpc(
        "convert_group_to_own_site",
        {
          p_batch_code: data.batch_code,
          p_target_site_id: data.target_site_id,
        }
      );

      if (error) throw error;
      return { new_ref_code: newRefCode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialPurchases.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.groupStock.all });
    },
  });
}

// ============================================
// SITE MATERIAL EXPENSES (for Expenses Page)
// ============================================

/**
 * Fetch material expenses for a site (for display in Site Expenses page)
 * Includes:
 * - Own site purchases (purchase_type = 'own_site')
 * - Allocated group stock purchases (original_batch_code IS NOT NULL)
 */
export function useSiteMaterialExpenses(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.materialPurchases.bySite(siteId), "expenses"]
      : ["material-expenses"],
    queryFn: async () => {
      if (!siteId) return { expenses: [], total: 0 };

      try {
        // Fetch material purchase expenses for this site
        // Include both own_site purchases AND allocated group purchases
        const { data, error } = await (supabase as any)
          .from("material_purchase_expenses")
          .select(`
            *,
            vendor:vendors(id, name),
            purchase_order:purchase_orders(id, po_number),
            items:material_purchase_expense_items(
              *,
              material:materials(id, name, code, unit),
              brand:material_brands(id, brand_name)
            )
          `)
          .eq("site_id", siteId)
          .or("purchase_type.eq.own_site,original_batch_code.not.is.null")
          .order("purchase_date", { ascending: false });

        if (error) {
          if (isQueryError(error)) {
            console.warn("Site material expenses query failed:", error.message);
            return { expenses: [], total: 0 };
          }
          throw error;
        }

        const expenses = (data || []) as MaterialPurchaseExpenseWithDetails[];
        const total = expenses.reduce((sum, exp) => sum + Number(exp.total_amount || 0), 0);

        return { expenses, total };
      } catch (err) {
        if (isQueryError(err)) {
          console.warn("Site material expenses query failed:", err);
          return { expenses: [], total: 0 };
        }
        throw err;
      }
    },
    enabled: !!siteId,
  });
}
