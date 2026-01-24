"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  PurchaseOrder,
  PurchaseOrderWithDetails,
  PurchaseOrderFormData,
  PurchaseOrderItem,
  PurchaseOrderItemFormData,
  POStatus,
  Delivery,
  DeliveryWithDetails,
  DeliveryFormData,
  DeliveryItem,
  DeliveryItemFormData,
} from "@/types/material.types";

// ============================================
// PURCHASE ORDERS
// ============================================

/**
 * Fetch purchase orders for a site with optional status filter
 */
export function usePurchaseOrders(
  siteId: string | undefined,
  status?: POStatus | null
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? status
        ? [...queryKeys.purchaseOrders.bySite(siteId), status]
        : queryKeys.purchaseOrders.bySite(siteId)
      : ["purchase-orders", "unknown"],
    queryFn: async () => {
      if (!siteId) return [];

      let query = supabase
        .from("purchase_orders")
        .select(
          `
          *,
          vendor:vendors(id, name, phone, email),
          items:purchase_order_items(
            id, material_id, brand_id, quantity, unit_price,
            tax_rate, tax_amount, total_amount, received_qty, pending_qty,
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          )
        `
        )
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseOrderWithDetails[];
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch a single purchase order by ID
 */
export function usePurchaseOrder(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: id
      ? ["purchase-orders", "detail", id]
      : ["purchase-orders", "detail", "unknown"],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          `
          *,
          vendor:vendors(*),
          items:purchase_order_items(
            *,
            material:materials(id, name, code, unit, gst_rate),
            brand:material_brands(id, brand_name)
          ),
          deliveries(
            id, grn_number, delivery_date, delivery_status,
            challan_number, invoice_amount
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as PurchaseOrderWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Create a new purchase order with items
 */
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Calculate totals
      let subtotal = 0;
      let taxAmount = 0;

      const itemsWithTotals = data.items.map((item) => {
        const itemTotal = item.quantity * item.unit_price;
        const discount = item.discount_percent
          ? (itemTotal * item.discount_percent) / 100
          : 0;
        const taxableAmount = itemTotal - discount;
        const itemTax = item.tax_rate
          ? (taxableAmount * item.tax_rate) / 100
          : 0;

        subtotal += taxableAmount;
        taxAmount += itemTax;

        return {
          ...item,
          discount_amount: discount,
          tax_amount: itemTax,
          total_amount: taxableAmount + itemTax,
        };
      });

      const totalAmount = subtotal + taxAmount;

      // Generate PO number
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const poNumber = `PO-${timestamp}-${random}`;

      // Insert PO
      const { data: po, error: poError } = await (
        supabase.from("purchase_orders") as any
      )
        .insert({
          site_id: data.site_id,
          vendor_id: data.vendor_id,
          po_number: poNumber,
          status: data.status || "draft",
          order_date: data.order_date || new Date().toISOString().split("T")[0],
          expected_delivery_date: data.expected_delivery_date,
          delivery_address: data.delivery_address,
          delivery_location_id: data.delivery_location_id,
          payment_terms: data.payment_terms,
          notes: data.notes,
          internal_notes: data.internal_notes,
          transport_cost: data.transport_cost || null,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Insert PO items
      const poItems = itemsWithTotals.map((item) => ({
        po_id: po.id,
        material_id: item.material_id,
        brand_id: item.brand_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        total_amount: item.total_amount,
        notes: item.notes,
        received_qty: 0,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(poItems);

      if (itemsError) throw itemsError;

      // Auto-record prices to price_history for each item
      const priceRecords = itemsWithTotals.map((item) => ({
        vendor_id: data.vendor_id,
        material_id: item.material_id,
        brand_id: item.brand_id || null,
        price: item.unit_price,
        price_includes_gst: false,
        gst_rate: item.tax_rate || null,
        transport_cost: null,
        loading_cost: null,
        unloading_cost: null,
        total_landed_cost: item.unit_price,
        recorded_date: new Date().toISOString().split("T")[0],
        source: "purchase",
        source_reference: poNumber,
        quantity: item.quantity,
        unit: null,
        recorded_by: null,
        notes: `Auto-recorded from PO ${poNumber}`,
      }));

      // Insert price history records (don't fail PO creation if this fails)
      try {
        await supabase.from("price_history").insert(priceRecords);
      } catch (priceError) {
        console.warn("Failed to record price history:", priceError);
      }

      return po as PurchaseOrder;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(variables.site_id),
      });
      // Also invalidate price history queries
      queryClient.invalidateQueries({
        queryKey: ["price-history"],
      });
    },
  });
}

/**
 * Update a purchase order
 */
export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PurchaseOrderFormData>;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data: result, error } = await supabase
        .from("purchase_orders")
        .update({
          vendor_id: data.vendor_id,
          expected_delivery_date: data.expected_delivery_date,
          delivery_address: data.delivery_address,
          delivery_location_id: data.delivery_location_id,
          payment_terms: data.payment_terms,
          transport_cost: data.transport_cost ?? undefined,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as PurchaseOrder;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", result.id],
      });
    },
  });
}

/**
 * Submit PO for approval
 */
export function useSubmitPOForApproval() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          status: "pending_approval",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "draft")
        .select()
        .single();

      if (error) throw error;
      return data as PurchaseOrder;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", result.id],
      });
    },
  });
}

/**
 * Approve a purchase order
 */
export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending_approval")
        .select()
        .single();

      if (error) throw error;
      return data as PurchaseOrder;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", result.id],
      });
    },
  });
}

/**
 * Mark PO as ordered (sent to vendor)
 * Works from both "draft" and "approved" status (approval step is optional)
 */
export function useMarkPOAsOrdered() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          status: "ordered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", ["draft", "approved"]) // Allow from draft or approved
        .select()
        .single();

      if (error) throw error;
      return data as PurchaseOrder;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", result.id],
      });
    },
  });
}

/**
 * Cancel a purchase order
 */
export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      reason,
    }: {
      id: string;
      userId: string;
      reason?: string;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Try to set cancelled_by, but don't fail if foreign key doesn't exist
      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to cancel purchase order. You may not have permission to perform this action.");
      }
      if (!data) {
        throw new Error("Purchase order not found or you do not have permission to cancel it.");
      }
      return data as PurchaseOrder;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", result.id],
      });
    },
  });
}

/**
 * Delete a purchase order (draft, cancelled, or delivered)
 */
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, siteId }: { id: string; siteId: string }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // First, get all deliveries for this PO
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id")
        .eq("po_id", id);

      // Delete delivery items for all deliveries
      if (deliveries && deliveries.length > 0) {
        const deliveryIds = deliveries.map((d) => d.id);
        const { error: deliveryItemsError } = await supabase
          .from("delivery_items")
          .delete()
          .in("delivery_id", deliveryIds);

        if (deliveryItemsError) throw deliveryItemsError;

        // Delete deliveries
        const { error: deliveriesError } = await supabase
          .from("deliveries")
          .delete()
          .eq("po_id", id);

        if (deliveriesError) throw deliveriesError;
      }

      // Delete material purchase expense items linked to this PO
      const { data: materialExpenses } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id")
        .eq("purchase_order_id", id);

      if (materialExpenses && materialExpenses.length > 0) {
        const expenseIds = materialExpenses.map((e: { id: string }) => e.id);

        // Delete material purchase expense items
        const { error: expenseItemsError } = await (supabase as any)
          .from("material_purchase_expense_items")
          .delete()
          .in("purchase_expense_id", expenseIds);

        if (expenseItemsError) {
          console.warn("Failed to delete material expense items:", expenseItemsError);
        }

        // Delete material purchase expenses
        const { error: expensesError } = await (supabase as any)
          .from("material_purchase_expenses")
          .delete()
          .eq("purchase_order_id", id);

        if (expensesError) {
          console.warn("Failed to delete material expenses:", expensesError);
        }
      }

      // Delete PO items
      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("po_id", id);

      if (itemsError) throw itemsError;

      // Delete PO (only draft, cancelled, or delivered status allowed)
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id)
        .in("status", ["draft", "cancelled", "delivered"]);

      if (error) throw error;
      return { id, siteId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.siteId),
      });
      // Also invalidate deliveries cache
      queryClient.invalidateQueries({
        queryKey: ["deliveries", result.siteId],
      });
      // Invalidate material purchases cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.bySite(result.siteId),
      });
    },
  });
}

/**
 * Deletion impact summary type
 */
export interface PODeletionImpact {
  deliveries: { id: string; grn_number: string; delivery_date: string }[];
  deliveryItemsCount: number;
  materialExpenses: { id: string; ref_code: string; total_amount: number; purchase_type: string }[];
  materialExpenseItemsCount: number;
  batchUsageRecords: { id: string; usage_site_id: string; quantity: number; site_name?: string }[];
  interSiteSettlements: { id: string; settlement_code: string; total_amount: number; debtor_site_name?: string }[];
  derivedExpenses: { id: string; ref_code: string; total_amount: number; site_name?: string }[];
  poItemsCount: number;
  hasGroupStockBatch: boolean;
  batchRefCode: string | null;
}

/**
 * Fetch the impact of deleting a PO - shows all related records that will be affected
 */
export function usePODeletionImpact(poId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: poId ? ["po-deletion-impact", poId] : ["po-deletion-impact"],
    queryFn: async (): Promise<PODeletionImpact> => {
      if (!poId) {
        return {
          deliveries: [],
          deliveryItemsCount: 0,
          materialExpenses: [],
          materialExpenseItemsCount: 0,
          batchUsageRecords: [],
          interSiteSettlements: [],
          derivedExpenses: [],
          poItemsCount: 0,
          hasGroupStockBatch: false,
          batchRefCode: null,
        };
      }

      // Get deliveries for this PO
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, grn_number, delivery_date")
        .eq("po_id", poId);

      // Count delivery items
      let deliveryItemsCount = 0;
      if (deliveries && deliveries.length > 0) {
        const deliveryIds = deliveries.map((d) => d.id);
        const { count } = await supabase
          .from("delivery_items")
          .select("id", { count: "exact", head: true })
          .in("delivery_id", deliveryIds);
        deliveryItemsCount = count || 0;
      }

      // Get material purchase expenses linked to this PO
      const { data: materialExpenses } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id, ref_code, total_amount, purchase_type")
        .eq("purchase_order_id", poId);

      // Count material expense items
      let materialExpenseItemsCount = 0;
      if (materialExpenses && materialExpenses.length > 0) {
        const expenseIds = materialExpenses.map((e: { id: string }) => e.id);
        const { count } = await (supabase as any)
          .from("material_purchase_expense_items")
          .select("id", { count: "exact", head: true })
          .in("expense_id", expenseIds);
        materialExpenseItemsCount = count || 0;
      }

      // Check if this is a group stock batch
      const groupStockExpense = materialExpenses?.find(
        (e: { purchase_type: string }) => e.purchase_type === "group_stock"
      );
      const hasGroupStockBatch = !!groupStockExpense;
      const batchRefCode = groupStockExpense?.ref_code || null;

      // Get batch usage records if it's a group stock
      let batchUsageRecords: { id: string; usage_site_id: string; quantity: number; site_name?: string }[] = [];
      if (batchRefCode) {
        const { data: usageRecords } = await (supabase as any)
          .from("batch_usage_records")
          .select("id, usage_site_id, quantity, sites:usage_site_id(name)")
          .eq("batch_ref_code", batchRefCode);

        if (usageRecords) {
          batchUsageRecords = usageRecords.map((r: any) => ({
            id: r.id,
            usage_site_id: r.usage_site_id,
            quantity: r.quantity,
            site_name: r.sites?.name,
          }));
        }
      }

      // Get inter-site settlements for this batch
      let interSiteSettlements: { id: string; settlement_code: string; total_amount: number; debtor_site_name?: string }[] = [];
      if (batchRefCode) {
        const { data: settlements } = await (supabase as any)
          .from("inter_site_material_settlements")
          .select("id, settlement_code, total_amount, debtor_site:debtor_site_id(name)")
          .eq("batch_ref_code", batchRefCode);

        if (settlements) {
          interSiteSettlements = settlements.map((s: any) => ({
            id: s.id,
            settlement_code: s.settlement_code,
            total_amount: s.total_amount,
            debtor_site_name: s.debtor_site?.name,
          }));
        }
      }

      // Get derived expenses (debtor expenses and self-use expenses) that reference this batch
      let derivedExpenses: { id: string; ref_code: string; total_amount: number; site_name?: string }[] = [];
      if (batchRefCode) {
        const { data: derived } = await (supabase as any)
          .from("material_purchase_expenses")
          .select("id, ref_code, total_amount, site:site_id(name)")
          .eq("original_batch_code", batchRefCode);

        if (derived) {
          derivedExpenses = derived.map((e: any) => ({
            id: e.id,
            ref_code: e.ref_code,
            total_amount: e.total_amount,
            site_name: e.site?.name,
          }));
        }
      }

      // Count PO items
      const { count: poItemsCount } = await supabase
        .from("purchase_order_items")
        .select("id", { count: "exact", head: true })
        .eq("po_id", poId);

      return {
        deliveries: deliveries || [],
        deliveryItemsCount,
        materialExpenses: materialExpenses || [],
        materialExpenseItemsCount,
        batchUsageRecords,
        interSiteSettlements,
        derivedExpenses,
        poItemsCount: poItemsCount || 0,
        hasGroupStockBatch,
        batchRefCode,
      };
    },
    enabled: !!poId,
    staleTime: 0, // Always fetch fresh data
  });
}

/**
 * Delete a purchase order with full cascade (includes group stock cleanup)
 * This enhanced version also cleans up batch usage records, settlements, and derived expenses
 */
export function useDeletePurchaseOrderCascade() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, siteId }: { id: string; siteId: string }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // First, get material purchase expenses to find batch ref_code
      const { data: materialExpenses } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id, ref_code, purchase_type")
        .eq("purchase_order_id", id);

      // Find group stock batch if exists
      const groupStockExpense = materialExpenses?.find(
        (e: { purchase_type: string }) => e.purchase_type === "group_stock"
      );
      const batchRefCode = groupStockExpense?.ref_code || null;

      // If this is a group stock batch, clean up ALL related records
      if (batchRefCode) {
        console.log("[useDeletePurchaseOrderCascade] Deleting batch cascade:", batchRefCode);

        // Step 0: Get inventory IDs for this batch (usage transactions may link via inventory_id)
        const { data: inventoryRecords } = await (supabase as any)
          .from("group_stock_inventory")
          .select("id")
          .eq("batch_code", batchRefCode);

        const inventoryIds = (inventoryRecords || []).map((inv: { id: string }) => inv.id);
        console.log("[useDeletePurchaseOrderCascade] Found inventory records:", inventoryIds.length);

        // Step 1: Get settlement IDs and transaction IDs for proper FK deletion order
        const { data: settlements } = await (supabase as any)
          .from("inter_site_material_settlements")
          .select("id")
          .eq("batch_ref_code", batchRefCode);

        const settlementIds = (settlements || []).map((s: { id: string }) => s.id);

        // Get transactions by batch_ref_code
        const { data: txByBatch } = await (supabase as any)
          .from("group_stock_transactions")
          .select("id")
          .eq("batch_ref_code", batchRefCode);

        // Also get transactions by inventory_id (usage transactions may not have batch_ref_code)
        let txByInventory: { id: string }[] = [];
        if (inventoryIds.length > 0) {
          const { data: txByInv } = await (supabase as any)
            .from("group_stock_transactions")
            .select("id")
            .in("inventory_id", inventoryIds);
          txByInventory = txByInv || [];
        }

        // Combine all transaction IDs
        const allTransactionIds = new Set([
          ...(txByBatch || []).map((t: { id: string }) => t.id),
          ...txByInventory.map((t: { id: string }) => t.id),
        ]);
        const transactionIds = Array.from(allTransactionIds);
        console.log("[useDeletePurchaseOrderCascade] Found transactions:", transactionIds.length);

        // Step 2: Delete inter_site_settlement_items FIRST (FK to transactions and settlements)
        if (settlementIds.length > 0) {
          const { error: itemsBySettlementError } = await (supabase as any)
            .from("inter_site_settlement_items")
            .delete()
            .in("settlement_id", settlementIds);

          if (itemsBySettlementError) {
            console.warn("Warning: Could not delete inter_site_settlement_items by settlement_id:", itemsBySettlementError);
          }
        }

        if (transactionIds.length > 0) {
          const { error: itemsByTxError } = await (supabase as any)
            .from("inter_site_settlement_items")
            .delete()
            .in("transaction_id", transactionIds);

          if (itemsByTxError) {
            console.warn("Warning: Could not delete inter_site_settlement_items by transaction_id:", itemsByTxError);
          }
        }

        // Step 3: Delete inter_site_settlement_payments
        if (settlementIds.length > 0) {
          const { error: paymentsError } = await (supabase as any)
            .from("inter_site_settlement_payments")
            .delete()
            .in("settlement_id", settlementIds);

          if (paymentsError) {
            console.warn("Warning: Could not delete inter_site_settlement_payments:", paymentsError);
          }
        }

        // Step 4: Delete settlement_expense_allocations
        if (settlementIds.length > 0) {
          const { error: allocationsError } = await (supabase as any)
            .from("settlement_expense_allocations")
            .delete()
            .in("settlement_id", settlementIds);

          if (allocationsError) {
            console.warn("Warning: Could not delete settlement_expense_allocations:", allocationsError);
          }
        }

        // Step 5: Delete inter_site_material_settlements
        const { error: settlementsError } = await (supabase as any)
          .from("inter_site_material_settlements")
          .delete()
          .eq("batch_ref_code", batchRefCode);

        if (settlementsError) {
          console.warn("Warning: Could not delete inter_site_material_settlements:", settlementsError);
        }

        // Step 6: Delete batch_usage_records
        const { error: usageError } = await (supabase as any)
          .from("batch_usage_records")
          .delete()
          .eq("batch_ref_code", batchRefCode);

        if (usageError) {
          console.warn("Warning: Could not delete batch_usage_records:", usageError);
        }

        // Step 7: Delete group_stock_transactions by batch_ref_code
        const { error: txError } = await (supabase as any)
          .from("group_stock_transactions")
          .delete()
          .eq("batch_ref_code", batchRefCode);

        if (txError) {
          console.warn("Warning: Could not delete group_stock_transactions by batch_ref_code:", txError);
        }

        // Step 7b: Delete group_stock_transactions by inventory_id (catches usage transactions without batch_ref_code)
        if (inventoryIds.length > 0) {
          const { error: txByInvError } = await (supabase as any)
            .from("group_stock_transactions")
            .delete()
            .in("inventory_id", inventoryIds);

          if (txByInvError) {
            console.warn("Warning: Could not delete group_stock_transactions by inventory_id:", txByInvError);
          } else {
            console.log("[useDeletePurchaseOrderCascade] Deleted transactions by inventory_id");
          }
        }

        // Step 8: Delete group_stock_inventory for this batch
        const { error: inventoryError } = await (supabase as any)
          .from("group_stock_inventory")
          .delete()
          .eq("batch_code", batchRefCode);

        if (inventoryError) {
          console.warn("Warning: Could not delete group_stock_inventory:", inventoryError);
        }

        // Step 9: Delete derived expenses (debtor expenses and self-use expenses)
        const { data: derivedExpenses } = await (supabase as any)
          .from("material_purchase_expenses")
          .select("id")
          .eq("original_batch_code", batchRefCode);

        if (derivedExpenses && derivedExpenses.length > 0) {
          const derivedExpenseIds = derivedExpenses.map((e: { id: string }) => e.id);

          // Delete derived expense items
          await (supabase as any)
            .from("material_purchase_expense_items")
            .delete()
            .in("purchase_expense_id", derivedExpenseIds);

          // Delete derived expenses
          await (supabase as any)
            .from("material_purchase_expenses")
            .delete()
            .eq("original_batch_code", batchRefCode);
        }

        console.log("[useDeletePurchaseOrderCascade] Batch cascade complete:", batchRefCode);
      }

      // Now proceed with the standard deletion flow
      // Get all deliveries for this PO
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id")
        .eq("po_id", id);

      // Delete delivery items for all deliveries
      if (deliveries && deliveries.length > 0) {
        const deliveryIds = deliveries.map((d) => d.id);
        await supabase
          .from("delivery_items")
          .delete()
          .in("delivery_id", deliveryIds);

        // Delete deliveries
        await supabase.from("deliveries").delete().eq("po_id", id);
      }

      // Delete material purchase expense items linked to this PO
      if (materialExpenses && materialExpenses.length > 0) {
        const expenseIds = materialExpenses.map((e: { id: string }) => e.id);

        // Delete material purchase expense items
        await (supabase as any)
          .from("material_purchase_expense_items")
          .delete()
          .in("purchase_expense_id", expenseIds);

        // Delete material purchase expenses
        await (supabase as any)
          .from("material_purchase_expenses")
          .delete()
          .eq("purchase_order_id", id);
      }

      // Delete PO items
      await supabase.from("purchase_order_items").delete().eq("po_id", id);

      // Delete the PO itself
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, siteId };
    },
    onSuccess: (result) => {
      // Invalidate all related caches comprehensively
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: ["deliveries", result.siteId],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.bySite(result.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.all,
      });
      // Invalidate all settlement-related queries
      queryClient.invalidateQueries({
        queryKey: ["inter-site-settlements"],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.all,
      });
      // Invalidate batch usage queries
      queryClient.invalidateQueries({
        queryKey: ["batch-usage-records"],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.all,
      });
      // Invalidate expense queries
      queryClient.invalidateQueries({
        queryKey: ["site-material-expenses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["all-expenses"],
      });
      queryClient.invalidateQueries({
        queryKey: ["expenses"],
      });
      // Invalidate material purchases batches
      queryClient.invalidateQueries({
        queryKey: ["material-purchases", "batches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-stock-transactions"],
      });
    },
  });
}

// ============================================
// PURCHASE ORDER ITEMS
// ============================================

/**
 * Add item to a purchase order
 */
export function useAddPOItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      poId,
      item,
    }: {
      poId: string;
      item: PurchaseOrderItemFormData;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const itemTotal = item.quantity * item.unit_price;
      const discount = item.discount_percent
        ? (itemTotal * item.discount_percent) / 100
        : 0;
      const taxableAmount = itemTotal - discount;
      const itemTax = item.tax_rate ? (taxableAmount * item.tax_rate) / 100 : 0;

      const { data, error } = await supabase
        .from("purchase_order_items")
        .insert({
          po_id: poId,
          material_id: item.material_id,
          brand_id: item.brand_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          tax_amount: itemTax,
          discount_percent: item.discount_percent,
          discount_amount: discount,
          total_amount: taxableAmount + itemTax,
          notes: item.notes,
          received_qty: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Update PO totals
      await updatePOTotals(supabase, poId);

      return data as PurchaseOrderItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", variables.poId],
      });
    },
  });
}

/**
 * Update a PO item
 */
export function useUpdatePOItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      poId,
      item,
    }: {
      id: string;
      poId: string;
      item: Partial<PurchaseOrderItemFormData>;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      let updateData: Record<string, unknown> = { ...item };

      if (item.quantity !== undefined && item.unit_price !== undefined) {
        const itemTotal = item.quantity * item.unit_price;
        const discount = item.discount_percent
          ? (itemTotal * item.discount_percent) / 100
          : 0;
        const taxableAmount = itemTotal - discount;
        const itemTax = item.tax_rate
          ? (taxableAmount * item.tax_rate) / 100
          : 0;

        updateData = {
          ...updateData,
          discount_amount: discount,
          tax_amount: itemTax,
          total_amount: taxableAmount + itemTax,
        };
      }

      const { data, error } = await supabase
        .from("purchase_order_items")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Update PO totals
      await updatePOTotals(supabase, poId);

      return data as PurchaseOrderItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", variables.poId],
      });
    },
  });
}

/**
 * Remove an item from PO
 */
export function useRemovePOItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, poId }: { id: string; poId: string }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { error } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Update PO totals
      await updatePOTotals(supabase, poId);

      return { id, poId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders", "detail", result.poId],
      });
    },
  });
}

// Helper function to update PO totals
async function updatePOTotals(
  supabase: ReturnType<typeof createClient>,
  poId: string
) {
  const { data: items } = await supabase
    .from("purchase_order_items")
    .select("total_amount, tax_amount")
    .eq("po_id", poId);

  if (items) {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.total_amount - (item.tax_amount || 0)),
      0
    );
    const taxAmount = items.reduce(
      (sum, item) => sum + (item.tax_amount || 0),
      0
    );
    const totalAmount = subtotal + taxAmount;

    await supabase
      .from("purchase_orders")
      .update({
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  }
}

/**
 * Record advance payment for a PO
 * Updates the advance_paid field and marks payment details
 */
export function useRecordAdvancePayment() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      po_id: string;
      site_id: string;
      amount_paid: number;
      payment_date: string;
      payment_mode?: string;
      payment_reference?: string;
      payment_screenshot_url?: string;
      notes?: string;
    }) => {
      await ensureFreshSession();

      const { error } = await supabase
        .from("purchase_orders")
        .update({
          advance_paid: data.amount_paid,
          payment_terms: data.notes
            ? `${data.payment_mode || "Advance"} payment on ${data.payment_date}. ${data.notes}`
            : `${data.payment_mode || "Advance"} payment on ${data.payment_date}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.po_id);

      if (error) throw error;
      return { po_id: data.po_id, site_id: data.site_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.materialPurchases.bySite(result.site_id), "expenses"],
      });
    },
  });
}

// ============================================
// DELIVERIES (GRN)
// ============================================

/**
 * Fetch deliveries for a site
 */
export function useDeliveries(
  siteId: string | undefined,
  poId?: string | null
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["deliveries", siteId, poId],
    queryFn: async () => {
      if (!siteId) return [];

      let query = supabase
        .from("deliveries")
        .select(
          `
          *,
          vendor:vendors(id, name, phone),
          po:purchase_orders(id, po_number, status),
          items:delivery_items(
            id, material_id, received_qty, accepted_qty, rejected_qty, unit_price,
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          )
        `
        )
        .eq("site_id", siteId)
        .order("delivery_date", { ascending: false });

      if (poId) {
        query = query.eq("po_id", poId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DeliveryWithDetails[];
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch a single delivery by ID
 */
export function useDelivery(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["delivery", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("deliveries")
        .select(
          `
          *,
          vendor:vendors(*),
          po:purchase_orders(id, po_number, status, expected_delivery_date),
          items:delivery_items(
            *,
            material:materials(id, name, code, unit),
            brand:material_brands(id, brand_name)
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as DeliveryWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Record a new delivery (GRN)
 */
export function useRecordDelivery() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: DeliveryFormData) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Generate GRN number
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const grnNumber = `GRN-${timestamp}-${random}`;

      // Validate and get vendor_id - it's required in the database
      let vendorId = data.vendor_id && data.vendor_id.trim() !== "" ? data.vendor_id : null;

      // If vendor_id is missing but we have a PO, fetch it from the PO
      if (!vendorId && data.po_id) {
        const { data: po } = await supabase
          .from("purchase_orders")
          .select("vendor_id")
          .eq("id", data.po_id)
          .single();

        if (po?.vendor_id) {
          vendorId = po.vendor_id;
        }
      }

      // vendor_id is required - throw error if still missing
      if (!vendorId) {
        throw new Error("Vendor ID is required for delivery. Please ensure the PO has a vendor.");
      }

      // Handle empty strings as null for optional UUID fields
      const locationId = data.location_id && data.location_id.trim() !== "" ? data.location_id : null;

      // Get current user for tracking who recorded the delivery
      const { data: { user } } = await supabase.auth.getUser();

      // Build the insert payload
      // Set requires_verification=false and verification_status='verified' to:
      // 1. Prevent the notification trigger from firing (it has a bug with site_id column)
      // 2. Mark delivery as already verified since we're recording a completed delivery
      const deliveryPayload = {
        po_id: data.po_id || null,
        site_id: data.site_id,
        vendor_id: vendorId,
        location_id: locationId,
        grn_number: grnNumber,
        delivery_date: data.delivery_date,
        delivery_status: "delivered",
        verification_status: "verified",
        requires_verification: false,
        challan_number: data.challan_number || null,
        challan_date: data.challan_date || null,
        vehicle_number: data.vehicle_number || null,
        driver_name: data.driver_name || null,
        driver_phone: data.driver_phone || null,
        delivery_photos: data.delivery_photos && data.delivery_photos.length > 0 ? JSON.stringify(data.delivery_photos) : null,
        recorded_by: user?.id || null,
        recorded_at: new Date().toISOString(),
        notes: data.notes || null,
      };

      // Debug logging
      console.log("[useRecordDelivery] Inserting delivery with payload:", deliveryPayload);

      const { data: delivery, error: deliveryError } = await (
        supabase.from("deliveries") as any
      )
        .insert(deliveryPayload)
        .select()
        .single();

      if (deliveryError) {
        console.error("[useRecordDelivery] Delivery insert error:", deliveryError);
        throw deliveryError;
      }

      // Insert delivery items
      // Handle empty strings as null for UUID fields
      const deliveryItems = data.items.map((item) => ({
        delivery_id: delivery.id,
        po_item_id: item.po_item_id || null,
        material_id: item.material_id,
        brand_id: item.brand_id || null,
        ordered_qty: item.ordered_qty,
        received_qty: item.received_qty,
        accepted_qty: item.accepted_qty ?? item.received_qty,
        rejected_qty: item.rejected_qty ?? 0,
        rejection_reason: item.rejection_reason || null,
        unit_price: item.unit_price,
        notes: item.notes || null,
      }));

      console.log("[useRecordDelivery] Inserting delivery items:", deliveryItems);

      const { error: itemsError } = await supabase
        .from("delivery_items")
        .insert(deliveryItems);

      if (itemsError) {
        console.error("[useRecordDelivery] Delivery items insert error:", itemsError);
        throw itemsError;
      }

      // Update PO item received quantities
      if (data.po_id) {
        for (const item of data.items) {
          if (item.po_item_id) {
            const { data: poItem } = await supabase
              .from("purchase_order_items")
              .select("received_qty")
              .eq("id", item.po_item_id)
              .single();

            if (poItem) {
              await supabase
                .from("purchase_order_items")
                .update({
                  received_qty:
                    (poItem.received_qty ?? 0) +
                    (item.accepted_qty ?? item.received_qty),
                })
                .eq("id", item.po_item_id);
            }
          }
        }

        // Check if PO is fully delivered
        const { data: poItems } = await supabase
          .from("purchase_order_items")
          .select("quantity, received_qty")
          .eq("po_id", data.po_id);

        if (poItems) {
          const allDelivered = poItems.every(
            (item) => (item.received_qty ?? 0) >= item.quantity
          );
          const someDelivered = poItems.some(
            (item) => (item.received_qty ?? 0) > 0
          );

          const newStatus = allDelivered
            ? "delivered"
            : someDelivered
            ? "partial_delivered"
            : undefined;

          if (newStatus) {
            await supabase
              .from("purchase_orders")
              .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", data.po_id);

            // When PO becomes "delivered", auto-create Material Settlement record
            if (newStatus === "delivered") {
              try {
                // Get full PO details with vendor and items
                const { data: po } = await supabase
                  .from("purchase_orders")
                  .select(`
                    *,
                    vendor:vendors(id, name),
                    items:purchase_order_items(
                      id, material_id, brand_id, quantity, unit_price, tax_rate
                    )
                  `)
                  .eq("id", data.po_id)
                  .single();

                if (po) {
                  // Check if PO is a group stock purchase
                  // Parse internal_notes if it's a JSON string
                  let parsedNotes: { is_group_stock?: boolean; site_group_id?: string; group_id?: string } | null = null;
                  if (po.internal_notes) {
                    try {
                      parsedNotes = typeof po.internal_notes === "string"
                        ? JSON.parse(po.internal_notes)
                        : po.internal_notes;
                    } catch {
                      // Ignore parse errors
                    }
                  }
                  const isGroupStock = parsedNotes?.is_group_stock === true;
                  // Backward compatibility: check both site_group_id (new) and group_id (old)
                  const siteGroupId = parsedNotes?.site_group_id || parsedNotes?.group_id || null;

                  console.log("[useRecordDelivery] Creating material expense - PO:", po.po_number);
                  console.log("[useRecordDelivery] internal_notes:", po.internal_notes);
                  console.log("[useRecordDelivery] Parsed:", { isGroupStock, siteGroupId });
                  console.log("[useRecordDelivery] Will create expense with purchase_type:", isGroupStock ? "group_stock" : "own_site");

                  // Generate reference code for material purchase
                  const { data: refCode } = await (supabase as any).rpc(
                    "generate_material_purchase_reference"
                  );

                  // Calculate total from ORDERED quantity (user choice)
                  const itemsTotal = (po.items || []).reduce(
                    (sum: number, item: any) => sum + (item.quantity * item.unit_price),
                    0
                  );
                  const totalAmount = itemsTotal + (po.transport_cost || 0);

                  // Calculate total quantity for batch tracking (for group stock)
                  const totalQuantity = (po.items || []).reduce(
                    (sum: number, item: any) => sum + Number(item.quantity),
                    0
                  );

                  // Get current user
                  const { data: { user } } = await supabase.auth.getUser();

                  // Build expense payload
                  const expensePayload = {
                    site_id: po.site_id,
                    ref_code: refCode || `MAT-${Date.now()}`,
                    purchase_type: isGroupStock ? "group_stock" : "own_site",
                    purchase_order_id: po.id,
                    vendor_id: po.vendor_id,
                    vendor_name: po.vendor?.name || null,
                    purchase_date: new Date().toISOString().split("T")[0],
                    total_amount: totalAmount,
                    transport_cost: po.transport_cost || 0,
                    status: "recorded", // Use "recorded" for both group stock and own site
                    is_paid: false,
                    created_by: user?.id,
                    notes: isGroupStock
                      ? `Group stock batch from PO ${po.po_number}`
                      : `Auto-created from PO ${po.po_number}`,
                    // Group stock batch tracking fields
                    paying_site_id: isGroupStock ? po.site_id : null,
                    site_group_id: isGroupStock ? siteGroupId : null,
                    original_qty: isGroupStock ? totalQuantity : null,
                    remaining_qty: isGroupStock ? totalQuantity : null,
                  };

                  console.log("[useRecordDelivery] Expense payload:", JSON.stringify(expensePayload, null, 2));

                  // Create material_purchase_expense linked to PO
                  // For group stock, this becomes a batch with tracking fields
                  const { data: expense, error: expenseError } = await (supabase as any)
                    .from("material_purchase_expenses")
                    .insert(expensePayload)
                    .select()
                    .single();

                  if (expenseError) {
                    console.error("[useRecordDelivery] Failed to create material expense:", expenseError);
                    console.error("[useRecordDelivery] Error details:", JSON.stringify(expenseError, null, 2));
                    console.error("[useRecordDelivery] Error message:", expenseError.message);
                    console.error("[useRecordDelivery] Error code:", expenseError.code);
                    console.error("[useRecordDelivery] Error hint:", expenseError.hint);
                  } else if (expense) {
                    console.log("[useRecordDelivery] Material expense created successfully:", {
                      id: expense.id,
                      ref_code: expense.ref_code,
                      purchase_type: expense.purchase_type,
                      site_id: expense.site_id,
                      total_amount: expense.total_amount,
                    });

                    if (po.items?.length > 0) {
                      // Create expense items from PO items (ordered quantity)
                      const expenseItems = po.items.map((item: any) => ({
                      purchase_expense_id: expense.id,
                      material_id: item.material_id,
                      brand_id: item.brand_id || null,
                      quantity: item.quantity, // Ordered quantity
                      unit_price: item.unit_price,
                    }));

                    const { error: itemsInsertError } = await (supabase as any)
                      .from("material_purchase_expense_items")
                      .insert(expenseItems);

                    if (itemsInsertError) {
                      console.warn("Failed to create material expense items:", itemsInsertError);
                    }

                    // For group stock, also populate group_stock_inventory for backward compatibility
                    // with the Weekly Usage Report dialog
                    if (isGroupStock && siteGroupId) {
                      for (const item of po.items) {
                        try {
                          // Check if inventory record exists
                          // Use .is() for null brand_id to properly match NULL values in PostgreSQL
                          let invQuery = (supabase as any)
                            .from("group_stock_inventory")
                            .select("id, current_qty, avg_unit_cost")
                            .eq("site_group_id", siteGroupId)
                            .eq("material_id", item.material_id);

                          if (item.brand_id) {
                            invQuery = invQuery.eq("brand_id", item.brand_id);
                          } else {
                            invQuery = invQuery.is("brand_id", null);
                          }

                          const { data: existingInv } = await invQuery.maybeSingle();

                          if (existingInv) {
                            // Update existing inventory - add quantity and recalculate avg cost
                            const newQty = Number(existingInv.current_qty) + Number(item.quantity);
                            const newAvgCost = newQty > 0
                              ? ((Number(existingInv.current_qty) * Number(existingInv.avg_unit_cost || 0)) +
                                 (Number(item.quantity) * Number(item.unit_price))) / newQty
                              : Number(item.unit_price);

                            await (supabase as any)
                              .from("group_stock_inventory")
                              .update({
                                current_qty: newQty,
                                avg_unit_cost: newAvgCost,
                                last_received_date: new Date().toISOString().split("T")[0],
                                updated_at: new Date().toISOString(),
                                batch_code: expense.ref_code, // Update batch code (latest batch)
                              })
                              .eq("id", existingInv.id);
                          } else {
                            // Insert new inventory record
                            await (supabase as any)
                              .from("group_stock_inventory")
                              .insert({
                                site_group_id: siteGroupId,
                                material_id: item.material_id,
                                brand_id: item.brand_id || null,
                                current_qty: Number(item.quantity),
                                avg_unit_cost: Number(item.unit_price),
                                last_received_date: new Date().toISOString().split("T")[0],
                                batch_code: expense.ref_code, // Store batch code for usage tracking
                              });
                          }
                        } catch (invError) {
                          console.warn("Failed to update group_stock_inventory:", invError);
                        }
                      }
                    }
                  }
                }
                }
              } catch (autoCreateError) {
                // Don't fail the delivery if material expense creation fails
                console.warn("Failed to auto-create material expense:", autoCreateError);
              }
            }
          }
        }
      }

      return delivery as Delivery;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["deliveries", variables.site_id],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.bySite(variables.site_id),
      });
      // Invalidate material purchases cache (for auto-created settlement/batch)
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.bySite(variables.site_id),
      });
      // Invalidate all material purchases (for group stock batches that show on inter-site settlement)
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.all,
      });
      // Invalidate batch usage queries (for inter-site settlement batches tab)
      queryClient.invalidateQueries({
        queryKey: queryKeys.batchUsage.all,
      });
      if (variables.po_id) {
        queryClient.invalidateQueries({
          queryKey: ["purchase-orders", "detail", variables.po_id],
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.purchaseOrders.bySite(variables.site_id),
        });
      }
    },
  });
}

/**
 * Verify a delivery
 */
export function useVerifyDelivery() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      notes,
    }: {
      id: string;
      userId: string;
      notes?: string;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("deliveries")
        .update({
          verified: true,
          verified_by: userId,
          verified_at: new Date().toISOString(),
          inspection_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Delivery;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["delivery", result.id] });
      queryClient.invalidateQueries({
        queryKey: ["deliveries", result.site_id],
      });
    },
  });
}

/**
 * Update delivery invoice details
 */
export function useUpdateDeliveryInvoice() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      invoiceNumber,
      invoiceDate,
      invoiceAmount,
      invoiceUrl,
    }: {
      id: string;
      invoiceNumber?: string;
      invoiceDate?: string;
      invoiceAmount?: number;
      invoiceUrl?: string;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("deliveries")
        .update({
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          invoice_amount: invoiceAmount,
          invoice_url: invoiceUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Delivery;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["delivery", result.id] });
      queryClient.invalidateQueries({
        queryKey: ["deliveries", result.site_id],
      });
    },
  });
}

// ============================================
// SUMMARY QUERIES
// ============================================

/**
 * Get PO summary counts by status
 */
export function usePOSummary(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.purchaseOrders.bySite(siteId), "summary"]
      : ["purchase-orders", "summary"],
    queryFn: async () => {
      if (!siteId) return null;

      const { data, error } = await supabase
        .from("purchase_orders")
        .select("status")
        .eq("site_id", siteId);

      if (error) throw error;

      const summary = {
        draft: 0,
        pending_approval: 0,
        approved: 0,
        ordered: 0,
        partial_delivered: 0,
        delivered: 0,
        cancelled: 0,
        total: data.length,
      };

      data.forEach((po) => {
        summary[po.status as POStatus]++;
      });

      return summary;
    },
    enabled: !!siteId,
  });
}

/**
 * Get recent deliveries
 */
export function useRecentDeliveries(siteId: string | undefined, limit = 5) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["recentDeliveries", siteId, limit],
    queryFn: async () => {
      if (!siteId) return [];

      const { data, error } = await supabase
        .from("deliveries")
        .select(
          `
          id, grn_number, delivery_date, delivery_status, invoice_amount,
          vendor:vendors(id, name)
        `
        )
        .eq("site_id", siteId)
        .order("delivery_date", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });
}

/**
 * Get pending deliveries count
 */
export function usePendingDeliveriesCount(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["pendingDeliveriesCount", siteId],
    queryFn: async () => {
      if (!siteId) return 0;

      const { count, error } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("site_id", siteId)
        .in("status", ["ordered", "partial_delivered"]);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!siteId,
  });
}

// ============================================
// INTER-SITE SETTLEMENT SYNC
// ============================================

/**
 * Batch check sync status for multiple Group Stock POs
 * Returns a map of poId -> sync status
 */
export function useGroupStockPOsSyncStatus(poIds: string[]) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["group-stock-pos-sync-status", poIds.sort().join(",")],
    queryFn: async () => {
      if (poIds.length === 0) return new Map<string, boolean>();

      // Get all group stock expenses for these POs
      const { data: expenses } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id, ref_code, purchase_order_id")
        .in("purchase_order_id", poIds)
        .eq("purchase_type", "group_stock");

      if (!expenses || expenses.length === 0) {
        return new Map<string, boolean>();
      }

      // Get all batch ref codes
      const batchRefCodes = expenses.map((e: any) => e.ref_code).filter(Boolean);

      if (batchRefCodes.length === 0) {
        return new Map<string, boolean>();
      }

      // Check which batches have transactions
      const { data: transactions } = await (supabase as any)
        .from("group_stock_transactions")
        .select("batch_ref_code")
        .in("batch_ref_code", batchRefCodes);

      const syncedBatchCodes = new Set(transactions?.map((t: any) => t.batch_ref_code) || []);

      // Build map of poId -> isSynced
      const syncStatusMap = new Map<string, boolean>();
      for (const expense of expenses) {
        const isSynced = syncedBatchCodes.has(expense.ref_code);
        syncStatusMap.set(expense.purchase_order_id, isSynced);
      }

      return syncStatusMap;
    },
    enabled: poIds.length > 0,
    staleTime: 30000,
  });
}

/**
 * Check if a PO's batch is synced to Inter-Site Settlement
 * Returns sync status and batch details
 */
export function usePOBatchSyncStatus(poId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["po-batch-sync-status", poId],
    queryFn: async () => {
      if (!poId) return { isSynced: false, batchRefCode: null, hasGroupStockBatch: false };

      // Get the group stock material expense linked to this PO
      const { data: expenses } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id, ref_code, purchase_type, site_group_id, total_amount")
        .eq("purchase_order_id", poId)
        .eq("purchase_type", "group_stock");

      const groupStockExpense = expenses?.[0];
      if (!groupStockExpense) {
        return { isSynced: false, batchRefCode: null, hasGroupStockBatch: false };
      }

      const batchRefCode = groupStockExpense.ref_code;

      // Check if there are any transactions with this batch_ref_code
      const { count, error } = await (supabase as any)
        .from("group_stock_transactions")
        .select("id", { count: "exact", head: true })
        .eq("batch_ref_code", batchRefCode);

      if (error) {
        console.error("Error checking sync status:", error);
        return {
          isSynced: false,
          batchRefCode,
          hasGroupStockBatch: true,
          expenseId: groupStockExpense.id,
          siteGroupId: groupStockExpense.site_group_id,
        };
      }

      return {
        isSynced: (count || 0) > 0,
        batchRefCode,
        hasGroupStockBatch: true,
        expenseId: groupStockExpense.id,
        siteGroupId: groupStockExpense.site_group_id,
        totalAmount: groupStockExpense.total_amount,
      };
    },
    enabled: !!poId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Push a PO's batch to Inter-Site Settlement
 * Creates purchase transaction in group_stock_transactions
 * If the expense record was deleted, recreates it from PO data
 */
export function usePushBatchToSettlement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ poId }: { poId: string }) => {
      await ensureFreshSession();

      // Get the PO details with items
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          vendor:vendors(id, name),
          items:purchase_order_items(
            id, material_id, brand_id, quantity, unit_price, tax_rate
          )
        `)
        .eq("id", poId)
        .single();

      if (poError || !po) throw new Error("Failed to fetch PO details");

      // Check if this is a Group Stock PO by looking at internal_notes
      let parsedNotes: { is_group_stock?: boolean; site_group_id?: string; group_id?: string } | null = null;
      if (po.internal_notes) {
        try {
          parsedNotes = typeof po.internal_notes === "string"
            ? JSON.parse(po.internal_notes)
            : po.internal_notes;
        } catch {
          // Ignore parse errors
        }
      }

      const isGroupStock = parsedNotes?.is_group_stock === true;
      const siteGroupIdFromNotes = parsedNotes?.site_group_id || parsedNotes?.group_id;

      if (!isGroupStock) {
        throw new Error("This PO is not marked as a Group Stock purchase. Only Group Stock POs can be pushed to Inter-Site Settlement.");
      }

      if (!siteGroupIdFromNotes) {
        throw new Error("This PO does not have a site group associated. Cannot push to Inter-Site Settlement.");
      }

      // Get the group stock material expense (simple query first)
      const { data: expenses, error: expenseError } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id, ref_code, purchase_type, site_group_id, paying_site_id, total_amount")
        .eq("purchase_order_id", poId)
        .eq("purchase_type", "group_stock");

      if (expenseError) {
        console.error("Expense fetch error:", expenseError);
        throw new Error("Failed to fetch expense details");
      }

      let groupStockExpense = expenses?.[0];
      let expenseItems: any[] = [];

      // Get PO items - if not included in the main query, fetch separately
      let poItems = po.items || [];
      if (!poItems || poItems.length === 0) {
        console.log("PO items not found in main query, fetching separately...");
        const { data: fetchedPoItems } = await supabase
          .from("purchase_order_items")
          .select("id, material_id, brand_id, quantity, unit_price, tax_rate")
          .eq("po_id", poId);
        poItems = fetchedPoItems || [];
        console.log("Fetched PO items separately:", poItems.length, "items");
      }

      if (!poItems || poItems.length === 0) {
        throw new Error(`This PO (${po.po_number}) has no items. Cannot push to Inter-Site Settlement.`);
      }

      // If no expense record exists, recreate it from PO data
      if (!groupStockExpense) {
        console.log("No expense record found, recreating from PO data...");

        // Generate a new ref_code
        const { data: refCode } = await (supabase as any).rpc(
          "generate_material_purchase_reference"
        );

        // Calculate totals from PO items
        const itemsTotal = poItems.reduce(
          (sum: number, item: any) => sum + (item.quantity * item.unit_price),
          0
        );
        const totalAmount = itemsTotal + (po.transport_cost || 0);
        const totalQuantity = poItems.reduce(
          (sum: number, item: any) => sum + Number(item.quantity),
          0
        );

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Create the expense record
        const expensePayload = {
          site_id: po.site_id,
          ref_code: refCode || `MAT-${Date.now()}`,
          purchase_type: "group_stock",
          purchase_order_id: po.id,
          vendor_id: po.vendor_id,
          vendor_name: (po.vendor as any)?.name || null,
          purchase_date: po.order_date || new Date().toISOString().split("T")[0],
          total_amount: totalAmount,
          transport_cost: po.transport_cost || 0,
          status: "recorded",
          is_paid: false,
          created_by: user?.id,
          notes: `Recreated for Push to Settlement from PO ${po.po_number}`,
          paying_site_id: po.site_id,
          site_group_id: siteGroupIdFromNotes,
          original_qty: totalQuantity,
          remaining_qty: totalQuantity,
        };

        const { data: newExpense, error: createExpenseError } = await (supabase as any)
          .from("material_purchase_expenses")
          .insert(expensePayload)
          .select("id, ref_code, purchase_type, site_group_id, paying_site_id, total_amount")
          .single();

        if (createExpenseError) {
          console.error("Failed to create expense:", createExpenseError);
          throw new Error("Failed to recreate expense record for this PO");
        }

        // Create expense items from PO items
        const expenseItemsPayload = poItems.map((item: any) => ({
          purchase_expense_id: newExpense.id,
          material_id: item.material_id,
          brand_id: item.brand_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }));

        const { data: insertedItems, error: itemsInsertError } = await (supabase as any)
          .from("material_purchase_expense_items")
          .insert(expenseItemsPayload)
          .select("id, material_id, brand_id, quantity, unit_price");

        if (itemsInsertError) {
          console.warn("Failed to create expense items:", itemsInsertError);
          // Use PO items as fallback for transaction creation
          expenseItems = poItems.map((item: any) => ({
            material_id: item.material_id,
            brand_id: item.brand_id || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }));
        } else {
          expenseItems = insertedItems || [];
        }

        groupStockExpense = newExpense;
        console.log("Expense record recreated:", newExpense.ref_code);
        console.log("DEBUG: Expense items after creation:", expenseItems.length, expenseItems);
      } else {
        // Expense exists, fetch items normally
        console.log("DEBUG: Expense already exists, fetching items for expense ID:", groupStockExpense.id);
        const { data: fetchedItems, error: itemsError } = await (supabase as any)
          .from("material_purchase_expense_items")
          .select("id, material_id, brand_id, quantity, unit_price")
          .eq("purchase_expense_id", groupStockExpense.id);

        console.log("DEBUG: Fetched expense items:", fetchedItems?.length || 0, "Error:", itemsError);

        if (itemsError) {
          console.error("Items fetch error:", itemsError);
        }

        expenseItems = fetchedItems || [];

        // If expense exists but has no items, create them from PO items
        if (expenseItems.length === 0 && poItems.length > 0) {
          console.log("DEBUG: Expense exists but has no items, creating from PO items...");
          const expenseItemsPayload = poItems.map((item: any) => ({
            purchase_expense_id: groupStockExpense.id,
            material_id: item.material_id,
            brand_id: item.brand_id || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }));

          const { data: newItems, error: createItemsError } = await (supabase as any)
            .from("material_purchase_expense_items")
            .insert(expenseItemsPayload)
            .select("id, material_id, brand_id, quantity, unit_price");

          if (createItemsError) {
            console.warn("DEBUG: Failed to create expense items:", createItemsError);
          } else {
            expenseItems = newItems || [];
            console.log("DEBUG: Created expense items:", expenseItems.length);
          }
        }
      }

      const batchRefCode = groupStockExpense.ref_code;
      const siteGroupId = groupStockExpense.site_group_id || siteGroupIdFromNotes;
      const payingSiteId = groupStockExpense.paying_site_id || po.site_id;

      console.log("DEBUG: Final state - batchRefCode:", batchRefCode, "siteGroupId:", siteGroupId, "expenseItems:", expenseItems.length);

      if (!siteGroupId) {
        throw new Error("This batch is not associated with a site group");
      }

      // Check if already synced
      const { count: existingCount } = await (supabase as any)
        .from("group_stock_transactions")
        .select("id", { count: "exact", head: true })
        .eq("batch_ref_code", batchRefCode);

      if (existingCount && existingCount > 0) {
        throw new Error("This batch is already synced to Inter-Site Settlement");
      }

      // FINAL FALLBACK: If we still have no expense items, use PO items directly
      if (!expenseItems || expenseItems.length === 0) {
        console.log("DEBUG: Using PO items as final fallback for transactions");
        if (poItems.length > 0) {
          expenseItems = poItems.map((item: any) => ({
            material_id: item.material_id,
            brand_id: item.brand_id || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }));
        } else {
          throw new Error("No items found in this expense batch and no PO items available as fallback");
        }
      }

      console.log("DEBUG: Proceeding with", expenseItems.length, "items for transaction creation");

      // Create purchase transaction for each item in the expense
      // Note: expense_items has unit_price, transactions table has unit_cost
      // IMPORTANT: group_stock_transactions requires inventory_id (NOT NULL)
      // So we need to find or create inventory records first
      const transactionsToInsert = [];

      for (const item of expenseItems) {
        const unitCost = item.unit_price || item.unit_cost || 0;
        const totalCost = (item.quantity || 0) * unitCost;

        // Try to find existing inventory record for this material/brand/site_group
        let inventoryId: string | null = null;

        let existingInventoryQuery = (supabase as any)
          .from("group_stock_inventory")
          .select("id")
          .eq("site_group_id", siteGroupId)
          .eq("material_id", item.material_id);

        if (item.brand_id) {
          existingInventoryQuery = existingInventoryQuery.eq("brand_id", item.brand_id);
        } else {
          existingInventoryQuery = existingInventoryQuery.is("brand_id", null);
        }

        const { data: existingInventory } = await existingInventoryQuery
          .eq("batch_code", batchRefCode)
          .maybeSingle();

        if (existingInventory?.id) {
          inventoryId = existingInventory.id;
          console.log("DEBUG: Found existing inventory record:", inventoryId);
        } else {
          // Try to find inventory without batch_code filter (general inventory for this material)
          let generalInventoryQuery = (supabase as any)
            .from("group_stock_inventory")
            .select("id")
            .eq("site_group_id", siteGroupId)
            .eq("material_id", item.material_id);

          if (item.brand_id) {
            generalInventoryQuery = generalInventoryQuery.eq("brand_id", item.brand_id);
          } else {
            generalInventoryQuery = generalInventoryQuery.is("brand_id", null);
          }

          const { data: generalInventory } = await generalInventoryQuery
            .is("batch_code", null)
            .maybeSingle();

          if (generalInventory?.id) {
            inventoryId = generalInventory.id;
            console.log("DEBUG: Found general inventory record:", inventoryId);
          } else {
            // Create a new inventory record for this batch
            console.log("DEBUG: Creating new inventory record for material:", item.material_id);
            const { data: newInventory, error: invError } = await (supabase as any)
              .from("group_stock_inventory")
              .insert({
                site_group_id: siteGroupId,
                material_id: item.material_id,
                brand_id: item.brand_id || null,
                batch_code: batchRefCode,
                current_qty: item.quantity || 0,
                avg_unit_cost: unitCost,
                last_received_date: po.order_date || new Date().toISOString().split("T")[0],
              })
              .select("id")
              .single();

            if (invError) {
              console.error("DEBUG: Failed to create inventory record:", invError);
              throw new Error(`Failed to create inventory record: ${invError.message}`);
            }

            inventoryId = newInventory.id;
            console.log("DEBUG: Created new inventory record:", inventoryId);
          }
        }

        transactionsToInsert.push({
          site_group_id: siteGroupId,
          inventory_id: inventoryId,
          transaction_type: "purchase",
          transaction_date: po.order_date || new Date().toISOString().split("T")[0],
          material_id: item.material_id,
          brand_id: item.brand_id,
          quantity: item.quantity,
          unit_cost: unitCost,
          total_cost: totalCost,
          payment_source_site_id: payingSiteId,
          batch_ref_code: batchRefCode,
          reference_id: groupStockExpense.id,
          notes: `Pushed from PO ${po.po_number}`,
        });
      }

      console.log("DEBUG: Inserting", transactionsToInsert.length, "transactions");

      const { data: insertedTx, error: insertError } = await (supabase as any)
        .from("group_stock_transactions")
        .insert(transactionsToInsert)
        .select();

      if (insertError) {
        console.error("DEBUG: Transaction insert error:", insertError);
        throw insertError;
      }

      return {
        success: true,
        transactionsCreated: insertedTx?.length || 0,
        batchRefCode,
      };
    },
    onSuccess: (result, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["po-batch-sync-status", variables.poId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-stock-pos-sync-status"],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.interSiteSettlements.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupStock.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialPurchases.all,
      });
    },
    onError: (error) => {
      console.error("Push to settlement error:", error);
    },
  });
}
