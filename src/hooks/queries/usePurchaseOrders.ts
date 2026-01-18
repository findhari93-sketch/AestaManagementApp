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
          status: "draft",
          order_date: new Date().toISOString().split("T")[0],
          expected_delivery_date: data.expected_delivery_date,
          delivery_address: data.delivery_address,
          delivery_location_id: data.delivery_location_id,
          payment_terms: data.payment_terms,
          notes: data.notes,
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
        .eq("status", "approved")
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

      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          status: "cancelled",
          cancelled_by: userId,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
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
 * Delete a draft purchase order
 */
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, siteId }: { id: string; siteId: string }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Delete items first
      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("po_id", id);

      if (itemsError) throw itemsError;

      // Delete PO
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id)
        .eq("status", "draft");

      if (error) throw error;
      return { id, siteId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(result.siteId),
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

      // Insert delivery
      const { data: delivery, error: deliveryError } = await (
        supabase.from("deliveries") as any
      )
        .insert({
          po_id: data.po_id,
          site_id: data.site_id,
          vendor_id: data.vendor_id,
          location_id: data.location_id,
          grn_number: grnNumber,
          delivery_date: data.delivery_date,
          delivery_status: "delivered",
          challan_number: data.challan_number,
          challan_date: data.challan_date,
          vehicle_number: data.vehicle_number,
          driver_name: data.driver_name,
          driver_phone: data.driver_phone,
          notes: data.notes,
        })
        .select()
        .single();

      if (deliveryError) throw deliveryError;

      // Insert delivery items
      const deliveryItems = data.items.map((item) => ({
        delivery_id: delivery.id,
        po_item_id: item.po_item_id,
        material_id: item.material_id,
        brand_id: item.brand_id,
        ordered_qty: item.ordered_qty,
        received_qty: item.received_qty,
        accepted_qty: item.accepted_qty ?? item.received_qty,
        rejected_qty: item.rejected_qty ?? 0,
        rejection_reason: item.rejection_reason,
        unit_price: item.unit_price,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from("delivery_items")
        .insert(deliveryItems);

      if (itemsError) throw itemsError;

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
