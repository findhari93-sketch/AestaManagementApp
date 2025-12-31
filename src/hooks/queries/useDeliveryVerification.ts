"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  Delivery,
  DeliveryWithVerification,
  DeliveryVerificationFormData,
  DeliveryDiscrepancy,
} from "@/types/material.types";

// Type for pending verification view
interface PendingDeliveryVerification {
  id: string;
  grn_number: string | null;
  po_number: string | null;
  vendor_name: string | null;
  site_id: string;
  delivery_date: string;
  total_value: number | null;
  item_count: number;
  vehicle_number: string | null;
  driver_name: string | null;
}

// ============================================
// DELIVERY VERIFICATION
// ============================================

/**
 * Fetch pending delivery verifications for a site
 */
export function usePendingDeliveryVerifications(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? queryKeys.deliveries.pendingVerification(siteId)
      : ["deliveries", "pending-verification"],
    queryFn: async () => {
      if (!siteId) return [] as PendingDeliveryVerification[];

      // Query deliveries table with joins instead of view
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          grn_number,
          site_id,
          delivery_date,
          vehicle_number,
          driver_name,
          po:purchase_orders(po_number),
          vendor:vendors(name)
        `)
        .eq("site_id", siteId)
        .eq("status", "delivered")
        .order("delivery_date", { ascending: false });

      if (error) throw error;

      // Transform data to match expected shape
      const transformed: PendingDeliveryVerification[] = (data || []).map((d) => ({
        id: d.id,
        grn_number: d.grn_number,
        po_number: (d.po as { po_number: string } | null)?.po_number || null,
        vendor_name: (d.vendor as { name: string } | null)?.name || null,
        site_id: d.site_id,
        delivery_date: d.delivery_date,
        total_value: null,
        item_count: 0,
        vehicle_number: d.vehicle_number,
        driver_name: d.driver_name,
      }));

      return transformed;
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch all pending verifications (for admin/office)
 */
export function useAllPendingVerifications() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["deliveries", "all-pending-verification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          grn_number,
          site_id,
          delivery_date,
          vehicle_number,
          driver_name,
          po:purchase_orders(po_number),
          vendor:vendors(name)
        `)
        .eq("status", "delivered")
        .order("delivery_date", { ascending: false });

      if (error) throw error;

      // Transform data to match expected shape
      const transformed: PendingDeliveryVerification[] = (data || []).map((d) => ({
        id: d.id,
        grn_number: d.grn_number,
        po_number: (d.po as { po_number: string } | null)?.po_number || null,
        vendor_name: (d.vendor as { name: string } | null)?.name || null,
        site_id: d.site_id,
        delivery_date: d.delivery_date,
        total_value: null,
        item_count: 0,
        vehicle_number: d.vehicle_number,
        driver_name: d.driver_name,
      }));

      return transformed;
    },
  });
}

/**
 * Fetch delivery verification details
 */
export function useDeliveryVerificationDetails(deliveryId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: deliveryId
      ? queryKeys.deliveries.byId(deliveryId)
      : ["deliveries", "detail"],
    queryFn: async () => {
      if (!deliveryId) return null;

      // Fetch delivery with relations
      const { data: delivery, error: deliveryError } = await supabase
        .from("deliveries")
        .select(`
          *,
          vendor:vendors(*),
          site:sites(name),
          po:purchase_orders(*)
        `)
        .eq("id", deliveryId)
        .single();

      if (deliveryError) throw deliveryError;

      // Fetch items
      const { data: items, error: itemsError } = await supabase
        .from("delivery_items")
        .select(`
          *,
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name)
        `)
        .eq("delivery_id", deliveryId);

      if (itemsError) throw itemsError;

      return {
        ...delivery,
        vendor: delivery.vendor,
        site: delivery.site,
        po: delivery.po,
        items,
      } as DeliveryWithVerification;
    },
    enabled: !!deliveryId,
  });
}

/**
 * Fetch deliveries by site with verification status
 */
export function useDeliveriesWithVerification(
  siteId: string | undefined,
  options?: {
    verificationStatus?: string;
    limit?: number;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.deliveries.bySite(siteId), "verification", options]
      : ["deliveries", "site", "verification"],
    queryFn: async () => {
      if (!siteId) return [] as PendingDeliveryVerification[];

      let query = supabase
        .from("deliveries")
        .select(`
          id,
          grn_number,
          site_id,
          delivery_date,
          vehicle_number,
          driver_name,
          po:purchase_orders(po_number),
          vendor:vendors(name)
        `)
        .eq("site_id", siteId)
        .order("delivery_date", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data - use type assertion since schema is correct
      const transformed = ((data || []) as Array<{
        id: string;
        grn_number: string | null;
        site_id: string;
        delivery_date: string;
        vehicle_number: string | null;
        driver_name: string | null;
        po: { po_number: string } | null;
        vendor: { name: string } | null;
      }>).map((d) => ({
        id: d.id,
        grn_number: d.grn_number,
        po_number: d.po?.po_number || null,
        vendor_name: d.vendor?.name || null,
        site_id: d.site_id,
        delivery_date: d.delivery_date,
        verification_status: "pending" as const,
        total_value: null,
        item_count: 0,
        vehicle_number: d.vehicle_number,
        driver_name: d.driver_name,
      }));

      return transformed;
    },
    enabled: !!siteId,
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
      deliveryId,
      userId,
      verificationPhotos,
      verificationNotes,
      discrepancies,
      verificationStatus,
    }: {
      deliveryId: string;
      userId: string;
      verificationPhotos: string[];
      verificationNotes?: string;
      discrepancies?: DeliveryDiscrepancy[];
      verificationStatus: "verified" | "disputed" | "rejected";
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Update delivery status directly since RPC may not exist yet
      const { error } = await supabase
        .from("deliveries")
        .update({
          status: verificationStatus === "verified" ? "delivered" : "rejected",
          notes: verificationNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      if (error) throw error;

      // Handle discrepancies by updating delivery items
      if (discrepancies && discrepancies.length > 0) {
        for (const d of discrepancies) {
          await supabase
            .from("delivery_items")
            .update({
              accepted_qty: d.received_qty,
              rejection_reason: `${d.issue}: ${d.notes || ""}`,
            })
            .eq("id", d.item_id);
        }
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveries.byId(variables.deliveryId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveries.all,
      });
      // Invalidate stock since verification triggers stock update
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.all,
      });
    },
  });
}

/**
 * Quick verify delivery (no discrepancies)
 */
export function useQuickVerifyDelivery() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      userId,
      photos,
      notes,
    }: {
      deliveryId: string;
      userId: string;
      photos: string[];
      notes?: string;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // First update delivery items to set accepted_qty = received_qty
      const { data: items, error: itemsError } = await supabase
        .from("delivery_items")
        .select("id, received_qty")
        .eq("delivery_id", deliveryId);

      if (itemsError) throw itemsError;

      // Update each item
      for (const item of items || []) {
        await supabase
          .from("delivery_items")
          .update({ accepted_qty: item.received_qty })
          .eq("id", item.id);
      }

      // Update delivery status directly
      const { error } = await supabase
        .from("deliveries")
        .update({
          status: "delivered",
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveries.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.all,
      });
    },
  });
}

/**
 * Update delivery verification status only
 */
export function useUpdateVerificationStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      status,
      notes,
    }: {
      deliveryId: string;
      status: "pending" | "verified" | "disputed" | "rejected";
      notes?: string;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { error } = await supabase
        .from("deliveries")
        .update({
          verification_status: status,
          verification_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveries.byId(variables.deliveryId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveries.all,
      });
    },
  });
}

/**
 * Update delivery item received quantities (for discrepancies)
 */
export function useUpdateDeliveryItemQuantities() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      items,
    }: {
      deliveryId: string;
      items: Array<{
        id: string;
        receivedQty: number;
        acceptedQty: number;
        rejectedQty?: number;
        rejectionReason?: string;
      }>;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      for (const item of items) {
        const { error } = await supabase
          .from("delivery_items")
          .update({
            received_qty: item.receivedQty,
            accepted_qty: item.acceptedQty,
            rejected_qty: item.rejectedQty || 0,
            rejection_reason: item.rejectionReason || null,
          })
          .eq("id", item.id);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliveries.byId(variables.deliveryId),
      });
    },
  });
}

/**
 * Upload verification photos
 */
export function useUploadVerificationPhotos() {
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      files,
    }: {
      deliveryId: string;
      files: File[];
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const uploadedUrls: string[] = [];

      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${deliveryId}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from("delivery-verifications")
          .upload(fileName, file);

        if (error) throw error;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("delivery-verifications")
          .getPublicUrl(data.path);

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls;
    },
  });
}

/**
 * Get verification statistics
 */
export function useVerificationStats(siteId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["verification-stats", siteId],
    queryFn: async () => {
      let query = supabase
        .from("deliveries")
        .select("status");

      if (siteId) {
        query = query.eq("site_id", siteId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        pending: 0,
        verified: 0,
        disputed: 0,
        rejected: 0,
        total: (data as unknown[])?.length || 0,
      };

      // Type the data properly
      const typedData = data as Array<{ status?: string }> | null;
      for (const d of typedData || []) {
        const status = d.status || "pending";
        if (status === "delivered") {
          stats.verified++;
        } else if (status === "rejected") {
          stats.rejected++;
        } else {
          stats.pending++;
        }
      }

      return stats;
    },
  });
}

/**
 * Get deliveries requiring verification count for badge
 */
export function usePendingVerificationCount(siteId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["pending-verification-count", siteId],
    queryFn: async () => {
      let query = supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_transit"); // Count in-transit deliveries as pending verification

      if (siteId) {
        query = query.eq("site_id", siteId);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}
