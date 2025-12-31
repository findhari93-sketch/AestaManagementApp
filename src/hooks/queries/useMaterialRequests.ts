"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  MaterialRequest,
  MaterialRequestWithDetails,
  MaterialRequestFormData,
  MaterialRequestItemFormData,
  MaterialRequestStatus,
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
 * Create a new material request
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

      // Generate request number
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const requestNumber = `MR-${timestamp}-${random}`;

      // Insert request
      const { data: request, error: requestError } = await supabase
        .from("material_requests")
        .insert({
          site_id: data.site_id,
          section_id: data.section_id,
          requested_by: data.requested_by!,
          request_number: requestNumber,
          request_date: new Date().toISOString().split("T")[0],
          required_by_date: data.required_by_date,
          priority: data.priority,
          status: "pending",
          notes: data.notes,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Insert request items
      const requestItems = data.items.map((item) => ({
        request_id: request.id,
        material_id: item.material_id,
        brand_id: item.brand_id,
        requested_qty: item.requested_qty,
        estimated_cost: item.estimated_cost,
        notes: item.notes,
        fulfilled_qty: 0,
      }));

      const { error: itemsError } = await supabase
        .from("material_request_items")
        .insert(requestItems);

      if (itemsError) throw itemsError;

      return request as MaterialRequest;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialRequests.bySite(variables.site_id),
      });
    },
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
 * Approve a material request
 */
export function useApproveMaterialRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      approvedItems,
    }: {
      id: string;
      userId: string;
      approvedItems: { itemId: string; approved_qty: number }[];
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
 * Reject a material request
 */
export function useRejectMaterialRequest() {
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
