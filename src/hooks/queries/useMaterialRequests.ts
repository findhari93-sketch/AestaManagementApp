"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import { useOptimisticMutation } from "@/hooks/mutations/useOptimisticMutation";
import {
  createStatusUpdater,
  createAddItemUpdater,
} from "@/lib/optimistic/updaters";
import type {
  MaterialRequest,
  MaterialRequestWithDetails,
  MaterialRequestFormData,
  MaterialRequestItemFormData,
  MaterialRequestStatus,
  ConvertRequestToPOFormData,
  RequestItemForConversion,
  LinkedPurchaseOrderSummary,
  PurchaseOrder,
} from "@/types/material.types";

// ============================================
// MATERIAL REQUESTS
// ============================================

/**
 * Fetch material requests for a site with optional status filter
 */
export function useMaterialRequests(
  siteId: string | undefined,
  status?: MaterialRequestStatus | null
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? status
        ? [...queryKeys.materialRequests.bySite(siteId), status]
        : queryKeys.materialRequests.bySite(siteId)
      : ["material-requests", "unknown"],
    queryFn: async () => {
      if (!siteId) return [];

      let query = supabase
        .from("material_requests")
        .select(
          `
          *,
          section:building_sections(id, name),
          items:material_request_items(
            id, material_id, requested_qty, approved_qty, fulfilled_qty,
            material:materials(id, name, code, unit)
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
      return data as MaterialRequestWithDetails[];
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch a single material request by ID
 */
export function useMaterialRequest(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: id
      ? ["material-requests", "detail", id]
      : ["material-requests", "detail", "unknown"],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("material_requests")
        .select(
          `
          *,
          section:building_sections(id, name),
          items:material_request_items(
            *,
            material:materials(id, name, code, unit, gst_rate),
            brand:material_brands(id, brand_name)
          ),
          converted_to_po:purchase_orders(id, po_number, status)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as MaterialRequestWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Create a new material request with optimistic updates
 * Shows the new request immediately in the list with a pending indicator
 */
export function useCreateMaterialRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: MaterialRequestFormData) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Calculate estimated total cost
      let estimatedCost = 0;
      data.items.forEach((item) => {
        if (item.estimated_cost) {
          estimatedCost += item.estimated_cost;
        }
      });

      // Generate request number with crypto for better uniqueness
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomBytes = typeof crypto !== 'undefined' && crypto.getRandomValues
        ? Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
        : Math.random().toString(36).substring(2, 10).toUpperCase();
      const requestNumber = `MR-${timestamp}-${randomBytes}`;

      // Insert request
      const { data: request, error: requestError } = await supabase
        .from("material_requests")
        .insert({
          site_id: data.site_id,
          section_id: data.section_id || null, // Convert undefined to null for UUID
          requested_by: data.requested_by!,
          request_number: requestNumber,
          request_date: new Date().toISOString().split("T")[0],
          required_by_date: data.required_by_date || null,
          priority: data.priority,
          status: "pending",
          notes: data.notes || null,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Insert request items
      const requestItems = data.items.map((item) => ({
        request_id: request.id,
        material_id: item.material_id,
        brand_id: item.brand_id || null, // Convert undefined to null for UUID
        requested_qty: item.requested_qty,
        estimated_cost: item.estimated_cost || null,
        notes: item.notes || null,
        fulfilled_qty: 0,
      }));

      const { error: itemsError } = await supabase
        .from("material_request_items")
        .insert(requestItems);

      if (itemsError) throw itemsError;

      return request as MaterialRequest;
    },
    // Optimistic update: Show new request immediately
    onMutate: async (variables) => {
      const queryKey = queryKeys.materialRequests.bySite(variables.site_id);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<MaterialRequestWithDetails[]>(queryKey);

      // Generate optimistic ID
      const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Optimistically add the new request (use unknown cast for partial data)
      const optimisticRequest = {
        id: optimisticId,
        site_id: variables.site_id,
        section_id: variables.section_id || null,
        requested_by: variables.requested_by!,
        request_number: `MR-PENDING-${optimisticId.slice(-6).toUpperCase()}`,
        request_date: new Date().toISOString().split("T")[0],
        required_by_date: variables.required_by_date || null,
        priority: variables.priority,
        status: "pending" as const,
        notes: variables.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        converted_to_po_id: null,
        section: null,
        items: variables.items.map((item, idx) => ({
          id: `${optimisticId}-item-${idx}`,
          request_id: optimisticId,
          material_id: item.material_id,
          brand_id: item.brand_id || null,
          requested_qty: item.requested_qty,
          approved_qty: null,
          fulfilled_qty: 0,
          estimated_cost: item.estimated_cost || null,
          notes: item.notes || null,
          created_at: new Date().toISOString(),
          material: null,
        })),
        // Mark as pending optimistic update
        isPending: true,
        optimisticId,
      } as unknown as MaterialRequestWithDetails;

      queryClient.setQueryData<MaterialRequestWithDetails[]>(queryKey, (old) => {
        return [optimisticRequest, ...(old || [])];
      });

      return { previousData, optimisticId, siteId: variables.site_id };
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(
          queryKeys.materialRequests.bySite(context.siteId),
          context.previousData
        );
      }
    },
    // Refetch on success to reconcile with server data
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(variables.site_id),
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(variables.site_id),
      });
    },
    retry: false, // Explicitly disable retry
  });
}

/**
 * Update a material request (only for pending/draft status)
 */
export function useUpdateMaterialRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<MaterialRequestFormData>;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data: result, error } = await supabase
        .from("material_requests")
        .update({
          section_id: data.section_id,
          required_by_date: data.required_by_date,
          priority: data.priority,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as MaterialRequest;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "detail", result.id],
      });
    },
  });
}

/**
 * Approve a material request with optimistic update
 * Shows the approved status immediately in the list
 */
export function useApproveMaterialRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      approvedItems,
      siteId,
    }: {
      id: string;
      userId: string;
      approvedItems: { itemId: string; approved_qty: number }[];
      siteId: string; // Added for optimistic update
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Update request status
      const { data: request, error: requestError } = await supabase
        .from("material_requests")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending")
        .select()
        .single();

      if (requestError) throw requestError;

      // Update item approved quantities
      for (const item of approvedItems) {
        await supabase
          .from("material_request_items")
          .update({ approved_qty: item.approved_qty })
          .eq("id", item.itemId);
      }

      return request as MaterialRequest;
    },
    // Optimistic update: Show approved status immediately
    onMutate: async (variables) => {
      const queryKey = queryKeys.materialRequests.bySite(variables.siteId);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<MaterialRequestWithDetails[]>(queryKey);

      // Optimistically update the request status
      queryClient.setQueryData<MaterialRequestWithDetails[]>(queryKey, (old) => {
        if (!old) return [];
        return old.map((request) => {
          if (request.id === variables.id) {
            return {
              ...request,
              status: "approved" as MaterialRequestStatus,
              approved_by: variables.userId,
              approved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              isPending: true,
            };
          }
          return request;
        });
      });

      return { previousData, siteId: variables.siteId };
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(
          queryKeys.materialRequests.bySite(context.siteId),
          context.previousData
        );
      }
    },
    // Refetch on success to reconcile
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(variables.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "detail", result.id],
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(variables.siteId),
      });
    },
    retry: false, // Explicitly disable retry
  });
}

/**
 * Reject a material request with optimistic update
 * Shows the rejected status immediately in the list
 */
export function useRejectMaterialRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      reason,
      siteId,
    }: {
      id: string;
      userId: string;
      reason?: string;
      siteId: string; // Added for optimistic update
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("material_requests")
        .update({
          status: "rejected",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending")
        .select()
        .single();

      if (error) throw error;
      return data as MaterialRequest;
    },
    // Optimistic update: Show rejected status immediately
    onMutate: async (variables) => {
      const queryKey = queryKeys.materialRequests.bySite(variables.siteId);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<MaterialRequestWithDetails[]>(queryKey);

      // Optimistically update the request status
      queryClient.setQueryData<MaterialRequestWithDetails[]>(queryKey, (old) => {
        if (!old) return [];
        return old.map((request) => {
          if (request.id === variables.id) {
            return {
              ...request,
              status: "rejected" as MaterialRequestStatus,
              approved_by: variables.userId,
              approved_at: new Date().toISOString(),
              rejection_reason: variables.reason || null,
              updated_at: new Date().toISOString(),
              isPending: true,
            } as MaterialRequestWithDetails;
          }
          return request;
        });
      });

      return { previousData, siteId: variables.siteId };
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(
          queryKeys.materialRequests.bySite(context.siteId),
          context.previousData
        );
      }
    },
    // Refetch on success to reconcile
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(variables.siteId),
      });
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "detail", result.id],
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(variables.siteId),
      });
    },
    retry: false,
  });
}

/**
 * Cancel a material request
 */
export function useCancelMaterialRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("material_requests")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", ["draft", "pending"])
        .select()
        .single();

      if (error) throw error;
      return data as MaterialRequest;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "detail", result.id],
      });
    },
  });
}

/**
 * Mark request as ordered (linked to PO)
 */
export function useMarkRequestOrdered() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, poId }: { id: string; poId: string }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("material_requests")
        .update({
          status: "ordered",
          converted_to_po_id: poId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MaterialRequest;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(result.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "detail", result.id],
      });
    },
  });
}

/**
 * Update fulfilled quantity for a request item
 */
export function useUpdateFulfilledQty() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      fulfilledQty,
      requestId,
    }: {
      itemId: string;
      fulfilledQty: number;
      requestId: string;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { error } = await supabase
        .from("material_request_items")
        .update({ fulfilled_qty: fulfilledQty })
        .eq("id", itemId);

      if (error) throw error;

      // Check if all items are fulfilled
      const { data: items } = await supabase
        .from("material_request_items")
        .select("approved_qty, fulfilled_qty")
        .eq("request_id", requestId);

      if (items) {
        const allFulfilled = items.every(
          (item) =>
            (item.fulfilled_qty ?? 0) >=
            (item.approved_qty || item.fulfilled_qty || 0)
        );
        const someFulfilled = items.some(
          (item) => (item.fulfilled_qty ?? 0) > 0
        );

        const newStatus = allFulfilled
          ? "fulfilled"
          : someFulfilled
          ? "partial_fulfilled"
          : undefined;

        if (newStatus) {
          await supabase
            .from("material_requests")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", requestId);
        }
      }

      return { itemId, fulfilledQty };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "detail", variables.requestId],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.all,
      });
    },
  });
}

// ============================================
// SUMMARY QUERIES
// ============================================

/**
 * Get request summary counts by status
 */
export function useRequestSummary(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.materialRequests.bySite(siteId), "summary"]
      : ["material-requests", "summary"],
    queryFn: async () => {
      if (!siteId) return null;

      const { data, error } = await supabase
        .from("material_requests")
        .select("status")
        .eq("site_id", siteId);

      if (error) throw error;

      const summary = {
        draft: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        ordered: 0,
        partial_fulfilled: 0,
        fulfilled: 0,
        cancelled: 0,
        total: data.length,
      };

      data.forEach((req) => {
        summary[req.status as MaterialRequestStatus]++;
      });

      return summary;
    },
    enabled: !!siteId,
  });
}

/**
 * Get pending requests count (for notifications)
 */
export function usePendingRequestsCount(siteId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? queryKeys.materialRequests.pending(siteId)
      : ["material-requests", "pending-count"],
    queryFn: async () => {
      let query = supabase
        .from("material_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (siteId) {
        query = query.eq("site_id", siteId);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });
}

/**
 * Get my requests (for the requesting user)
 */
export function useMyRequests(userId: string | undefined, siteId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["material-requests", "mine", userId, siteId],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("material_requests")
        .select(
          `
          *,
          items:material_request_items(
            id, material_id, requested_qty, approved_qty, fulfilled_qty,
            material:materials(id, name, unit)
          )
        `
        )
        .eq("requested_by", userId)
        .order("created_at", { ascending: false });

      if (siteId) {
        query = query.eq("site_id", siteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MaterialRequestWithDetails[];
    },
    enabled: !!userId,
  });
}

// ============================================
// REQUEST-TO-PO LINKING
// ============================================

/**
 * Get all purchase orders linked to a material request
 */
export function useRequestLinkedPOs(requestId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: requestId
      ? ["material-requests", "linked-pos", requestId]
      : ["material-requests", "linked-pos", "unknown"],
    queryFn: async () => {
      if (!requestId) return [];

      try {
        // Get POs where source_request_id matches this request
        const { data, error } = await supabase
          .from("purchase_orders")
          .select(
            `
            id, po_number, status, total_amount, order_date,
            vendor:vendors(id, name),
            items:purchase_order_items(id)
          `
          )
          .eq("source_request_id", requestId)
          .order("created_at", { ascending: false });

        if (error) {
          // If error is about unknown column, return empty array gracefully
          if (error.message?.includes("source_request_id") || error.code === "42703") {
            console.warn("[useRequestLinkedPOs] source_request_id column not available yet");
            return [];
          }
          throw error;
        }

        // Transform to LinkedPurchaseOrderSummary
        return (data || []).map((po) => ({
          id: po.id,
          po_number: po.po_number,
          status: po.status,
          vendor_name: (po.vendor as any)?.name || "Unknown Vendor",
          total_amount: po.total_amount,
          order_date: po.order_date,
          item_count: (po.items as any[])?.length || 0,
        })) as LinkedPurchaseOrderSummary[];
      } catch (err) {
        // Gracefully handle any errors with the new column
        console.warn("[useRequestLinkedPOs] Error fetching linked POs:", err);
        return [];
      }
    },
    enabled: !!requestId,
  });
}

/**
 * Get request items prepared for conversion to PO
 * Includes remaining quantities after existing PO allocations
 */
export function useRequestItemsForConversion(requestId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: requestId
      ? ["material-requests", "items-for-conversion", requestId]
      : ["material-requests", "items-for-conversion", "unknown"],
    queryFn: async () => {
      if (!requestId) return [];

      // Get request items with material details including variants
      const { data: items, error: itemsError } = await supabase
        .from("material_request_items")
        .select(
          `
          id, material_id, brand_id, requested_qty, approved_qty, fulfilled_qty, estimated_cost,
          material:materials(id, name, code, unit, gst_rate, parent_material_id),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("request_id", requestId);

      // Get all material IDs to fetch their variants
      const materialIds = (items || []).map(item => item.material_id).filter(Boolean);

      // Fetch variants for these materials (materials where parent_material_id matches)
      let variantsByParent: Record<string, Array<{ id: string; name: string }>> = {};
      if (materialIds.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from("materials")
          .select("id, name, parent_id")
          .in("parent_id", materialIds)
          .eq("is_active", true);

        if (!variantsError && variants) {
          variants.forEach(v => {
            if (v.parent_id) {
              if (!variantsByParent[v.parent_id]) {
                variantsByParent[v.parent_id] = [];
              }
              variantsByParent[v.parent_id].push({ id: v.id, name: v.name });
            }
          });
        }
      }

      if (itemsError) throw itemsError;

      // Get already allocated quantities from junction table
      const itemIds = (items || []).map((item) => item.id);

      let allocations: { request_item_id: string; quantity_allocated: number }[] = [];
      if (itemIds.length > 0) {
        try {
          // Cast to any since this table is new and not in generated types yet
          const { data: allocData, error: allocError } = await (supabase as any)
            .from("purchase_order_request_items")
            .select("request_item_id, quantity_allocated")
            .in("request_item_id", itemIds);

          // If table doesn't exist or error, just use empty allocations
          if (!allocError && allocData) {
            allocations = allocData;
          }
        } catch {
          // Table may not exist yet - gracefully continue with no allocations
          console.warn("[useRequestItemsForConversion] purchase_order_request_items table not available");
        }
      }

      // Calculate already ordered quantities
      const allocatedByItem: Record<string, number> = {};
      allocations.forEach((alloc) => {
        allocatedByItem[alloc.request_item_id] =
          (allocatedByItem[alloc.request_item_id] || 0) + Number(alloc.quantity_allocated);
      });

      // Transform to RequestItemForConversion
      return (items || []).map((item) => {
        const material = item.material as any;
        const brand = item.brand as any;
        const approvedQty = item.approved_qty ?? item.requested_qty;
        const alreadyOrderedQty = allocatedByItem[item.id] || 0;
        const remainingQty = Math.max(0, approvedQty - alreadyOrderedQty);

        // Get variants for this material (if any)
        const variants = variantsByParent[item.material_id] || [];
        const hasVariants = variants.length > 0;

        return {
          id: item.id,
          material_id: item.material_id,
          material_name: material?.name || "Unknown Material",
          material_code: material?.code || null,
          unit: material?.unit || "piece",
          brand_id: item.brand_id,
          brand_name: brand?.brand_name || null,
          requested_qty: item.requested_qty,
          approved_qty: approvedQty,
          already_ordered_qty: alreadyOrderedQty,
          remaining_qty: remainingQty,
          estimated_cost: item.estimated_cost,
          // Default form state
          selected: remainingQty > 0,
          quantity_to_order: remainingQty,
          unit_price: 0,
          tax_rate: material?.gst_rate || 0,
          // Enhanced fields for variant/brand selection
          has_variants: hasVariants,
          variants: hasVariants ? variants : undefined,
          selected_variant_id: null,
          selected_variant_name: null,
          selected_brand_id: item.brand_id || null,
          selected_brand_name: brand?.brand_name || null,
        } as RequestItemForConversion;
      });
    },
    enabled: !!requestId,
  });
}

/**
 * Convert a material request to a purchase order
 * Creates PO, PO items, and junction records
 */
export function useConvertRequestToPO() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: ConvertRequestToPOFormData) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // First, get the request to verify it's approved and get site_id
      const { data: request, error: requestError } = await supabase
        .from("material_requests")
        .select("id, site_id, status, request_number")
        .eq("id", data.request_id)
        .single();

      if (requestError) throw requestError;
      if (!request) throw new Error("Material request not found");
      if (request.status !== "approved" && request.status !== "ordered" && request.status !== "partial_fulfilled") {
        throw new Error("Material request must be approved before converting to PO");
      }

      // Calculate totals
      let subtotal = 0;
      let taxAmount = 0;

      const itemsWithTotals = data.items.map((item) => {
        const itemTotal = item.quantity * item.unit_price;
        const itemTax = item.tax_rate ? (itemTotal * item.tax_rate) / 100 : 0;

        subtotal += itemTotal;
        taxAmount += itemTax;

        return {
          ...item,
          discount_amount: 0,
          tax_amount: Math.round(itemTax),
          total_amount: Math.round(itemTotal + itemTax),
        };
      });

      // Round final totals
      const totalAmount = Math.round(subtotal + taxAmount + (data.transport_cost || 0));
      subtotal = Math.round(subtotal);
      taxAmount = Math.round(taxAmount);

      // Generate PO number
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const poNumber = `PO-${timestamp}-${random}`;

      // Insert PO with source_request_id
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          site_id: request.site_id,
          vendor_id: data.vendor_id,
          po_number: poNumber,
          status: "draft",
          order_date: new Date().toISOString().split("T")[0],
          expected_delivery_date: data.expected_delivery_date,
          delivery_address: data.delivery_address,
          delivery_location_id: data.delivery_location_id,
          payment_terms: data.payment_terms,
          payment_timing: data.payment_timing || "on_delivery",
          transport_cost: data.transport_cost || null,
          notes: data.notes ? `${data.notes}\n\nConverted from Request: ${request.request_number}` : `Converted from Request: ${request.request_number}`,
          source_request_id: data.request_id,
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
        discount_percent: 0,
        discount_amount: 0,
        total_amount: item.total_amount,
        received_qty: 0,
        pricing_mode: "per_piece",
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(poItems)
        .select("id, material_id, brand_id");

      if (itemsError) throw itemsError;

      // Create junction records linking PO items to request items
      const junctionRecords = itemsWithTotals.map((item, index) => {
        const poItem = insertedItems?.[index];
        return {
          po_item_id: poItem?.id,
          request_item_id: item.request_item_id,
          quantity_allocated: item.quantity,
        };
      }).filter((rec) => rec.po_item_id);

      if (junctionRecords.length > 0) {
        // Cast to any since this table is new and not in generated types yet
        const { error: junctionError } = await (supabase as any)
          .from("purchase_order_request_items")
          .insert(junctionRecords);

        if (junctionError) throw junctionError;
      }

      // Check if all items are now allocated and update request status
      const { data: allItems, error: allItemsError } = await supabase
        .from("material_request_items")
        .select("id, approved_qty, requested_qty")
        .eq("request_id", data.request_id);

      if (!allItemsError && allItems) {
        const itemIds = allItems.map((i) => i.id);

        // Cast to any since this table is new and not in generated types yet
        const { data: allAllocations } = await (supabase as any)
          .from("purchase_order_request_items")
          .select("request_item_id, quantity_allocated")
          .in("request_item_id", itemIds) as { data: { request_item_id: string; quantity_allocated: number }[] | null };

        // Calculate total allocated per item
        const allocatedByItem: Record<string, number> = {};
        (allAllocations || []).forEach((alloc: { request_item_id: string; quantity_allocated: number }) => {
          allocatedByItem[alloc.request_item_id] =
            (allocatedByItem[alloc.request_item_id] || 0) + Number(alloc.quantity_allocated);
        });

        // Check if all items are fully allocated
        const allFullyAllocated = allItems.every((item) => {
          const approved = item.approved_qty ?? item.requested_qty;
          const allocated = allocatedByItem[item.id] || 0;
          return allocated >= approved;
        });

        // Update request status to "ordered" if all items are converted
        if (allFullyAllocated && request.status === "approved") {
          await supabase
            .from("material_requests")
            .update({
              status: "ordered",
              updated_at: new Date().toISOString(),
            })
            .eq("id", data.request_id);
        }
      }

      // Auto-record prices to price_history
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
        notes: `Auto-recorded from PO ${poNumber} (converted from ${request.request_number})`,
      }));

      // Insert price history records (don't fail if this fails)
      try {
        await supabase.from("price_history").insert(priceRecords);
      } catch (priceError) {
        console.warn("Failed to record price history:", priceError);
      }

      return po as PurchaseOrder;
    },
    onSuccess: (po, variables) => {
      // Invalidate request queries
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "detail", variables.request_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "linked-pos", variables.request_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["material-requests", "items-for-conversion", variables.request_id],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.all,
      });

      // Invalidate PO queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.bySite(po.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: ["price-history"],
      });
    },
  });
}

// ============================================
// PAGINATED QUERIES
// ============================================

/**
 * Pagination parameters for server-side pagination
 */
export interface RequestPaginationParams {
  pageIndex: number;
  pageSize: number;
}

/**
 * Paginated result with total count
 */
export interface PaginatedRequestResult {
  data: MaterialRequestWithDetails[];
  totalCount: number;
  pageCount: number;
}

/**
 * Fetch material requests with server-side pagination and filtering
 * Use this for large datasets where client-side pagination is not efficient
 */
export function usePaginatedMaterialRequests(
  siteId: string | undefined,
  options: {
    pagination: RequestPaginationParams;
    status?: MaterialRequestStatus | null;
    priority?: string;
    searchTerm?: string;
  }
) {
  const supabase = createClient();
  const { pagination, status, priority, searchTerm } = options;
  const { pageIndex, pageSize } = pagination;
  const offset = pageIndex * pageSize;

  return useQuery({
    queryKey: [
      ...queryKeys.materialRequests.bySite(siteId || ""),
      "paginated",
      { pageIndex, pageSize, status, priority, searchTerm },
    ],
    queryFn: async (): Promise<PaginatedRequestResult> => {
      if (!siteId) return { data: [], totalCount: 0, pageCount: 0 };

      // Build count query with filters
      let countQuery = supabase
        .from("material_requests")
        .select("*", { count: "exact", head: true })
        .eq("site_id", siteId);

      if (status) {
        countQuery = countQuery.eq("status", status);
      }
      if (priority) {
        countQuery = countQuery.eq("priority", priority);
      }
      if (searchTerm && searchTerm.length >= 2) {
        countQuery = countQuery.ilike("request_number", `%${searchTerm}%`);
      }

      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw countError;

      // Build data query with pagination
      let dataQuery = supabase
        .from("material_requests")
        .select(
          `
          *,
          section:building_sections(id, name),
          items:material_request_items(
            id, material_id, requested_qty, approved_qty, fulfilled_qty,
            material:materials(id, name, code, unit)
          )
        `
        )
        .eq("site_id", siteId)
        .range(offset, offset + pageSize - 1)
        .order("created_at", { ascending: false });

      if (status) {
        dataQuery = dataQuery.eq("status", status);
      }
      if (priority) {
        dataQuery = dataQuery.eq("priority", priority);
      }
      if (searchTerm && searchTerm.length >= 2) {
        dataQuery = dataQuery.ilike("request_number", `%${searchTerm}%`);
      }

      const { data, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      return {
        data: data as MaterialRequestWithDetails[],
        totalCount: totalCount || 0,
        pageCount: Math.ceil((totalCount || 0) / pageSize),
      };
    },
    enabled: !!siteId,
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}
