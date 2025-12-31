"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  LocalPurchase,
  LocalPurchaseWithDetails,
  LocalPurchaseFormData,
  LocalPurchaseItem,
  LocalPurchaseItemFormData,
} from "@/types/material.types";

// ============================================
// LOCAL PURCHASES
// Note: Using type assertions because local_purchases table
// may not be in generated types until regeneration
// ============================================

/**
 * Fetch local purchases for a site
 */
export function useLocalPurchases(
  siteId: string | undefined,
  options?: {
    status?: string;
    limit?: number;
    fromDate?: string;
    toDate?: string;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.localPurchases.bySite(siteId), options]
      : ["local-purchases", "site"],
    queryFn: async () => {
      if (!siteId) return [] as LocalPurchaseWithDetails[];

      // Use type assertion for table that may not be in generated types
      let query = (supabase as any)
        .from("local_purchases")
        .select(`
          *,
          site:sites(name),
          engineer:users(name, email),
          vendor:vendors(*)
        `)
        .eq("site_id", siteId)
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      if (options?.fromDate) {
        query = query.gte("purchase_date", options.fromDate);
      }

      if (options?.toDate) {
        query = query.lte("purchase_date", options.toDate);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocalPurchaseWithDetails[];
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch local purchases for a site group
 */
export function useLocalPurchasesByGroup(
  groupId: string | undefined,
  options?: {
    status?: string;
    limit?: number;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? [...queryKeys.localPurchases.byGroup(groupId), options]
      : ["local-purchases", "group"],
    queryFn: async () => {
      if (!groupId) return [] as LocalPurchaseWithDetails[];

      let query = (supabase as any)
        .from("local_purchases")
        .select(`
          *,
          site:sites(name),
          engineer:users(name, email),
          vendor:vendors(*)
        `)
        .eq("site_group_id", groupId)
        .order("purchase_date", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocalPurchaseWithDetails[];
    },
    enabled: !!groupId,
  });
}

/**
 * Fetch local purchases by engineer
 */
export function useLocalPurchasesByEngineer(
  engineerId: string | undefined,
  options?: {
    status?: string;
    limit?: number;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: engineerId
      ? [...queryKeys.localPurchases.byEngineer(engineerId), options]
      : ["local-purchases", "engineer"],
    queryFn: async () => {
      if (!engineerId) return [] as LocalPurchaseWithDetails[];

      let query = (supabase as any)
        .from("local_purchases")
        .select(`
          *,
          site:sites(name),
          engineer:users(name, email),
          vendor:vendors(*)
        `)
        .eq("engineer_id", engineerId)
        .order("purchase_date", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocalPurchaseWithDetails[];
    },
    enabled: !!engineerId,
  });
}

/**
 * Fetch a single local purchase with items
 */
export function useLocalPurchase(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: id ? ["local-purchases", id] : ["local-purchases", "detail"],
    queryFn: async () => {
      if (!id) return null;

      const { data: purchase, error: purchaseError } = await (supabase as any)
        .from("local_purchases")
        .select(`
          *,
          site:sites(name),
          engineer:users(name, email),
          vendor:vendors(*)
        `)
        .eq("id", id)
        .single();

      if (purchaseError) throw purchaseError;

      // Fetch items
      const { data: items, error: itemsError } = await (supabase as any)
        .from("local_purchase_items")
        .select(`
          *,
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name)
        `)
        .eq("local_purchase_id", id);

      if (itemsError) throw itemsError;

      return {
        ...purchase,
        items: items || [],
      } as LocalPurchaseWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Fetch pending reimbursements
 */
export function usePendingReimbursements() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.localPurchases.pendingReimbursement(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("local_purchases")
        .select(`
          *,
          site:sites(name),
          engineer:users(name, email),
          vendor:vendors(*)
        `)
        .eq("needs_reimbursement", true)
        .is("reimbursement_transaction_id", null)
        .eq("status", "completed")
        .order("purchase_date");

      if (error) throw error;
      return (data || []) as LocalPurchaseWithDetails[];
    },
  });
}

/**
 * Create a new local purchase
 */
export function useCreateLocalPurchase() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (
      data: LocalPurchaseFormData & { engineerId: string }
    ) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { items, ...purchaseData } = data;

      // Determine if needs reimbursement based on payment mode
      const needsReimbursement = data.payment_mode === "engineer_own";
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      );

      // Create purchase
      const { data: purchase, error: purchaseError } = await (supabase as any)
        .from("local_purchases")
        .insert({
          site_id: purchaseData.site_id,
          site_group_id: purchaseData.site_group_id || null,
          engineer_id: data.engineerId,
          vendor_id: purchaseData.vendor_id || null,
          vendor_name: purchaseData.vendor_name,
          vendor_phone: purchaseData.vendor_phone || null,
          vendor_address: purchaseData.vendor_address || null,
          is_new_vendor: purchaseData.is_new_vendor || false,
          purchase_date: purchaseData.purchase_date,
          receipt_url: purchaseData.receipt_url || null,
          total_amount: totalAmount,
          payment_mode: purchaseData.payment_mode,
          payment_reference: purchaseData.payment_reference || null,
          payment_source: purchaseData.payment_source || null,
          description: purchaseData.description || null,
          needs_reimbursement: needsReimbursement,
          reimbursement_amount: needsReimbursement ? totalAmount : null,
          status: "completed", // Engineers are trusted, no approval needed
          add_to_stock: purchaseData.add_to_stock ?? true,
          is_group_stock: purchaseData.is_group_stock || false,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create items
      if (items.length > 0) {
        const itemsData = items.map((item) => ({
          local_purchase_id: purchase.id,
          material_id: item.material_id || null,
          custom_material_name: item.custom_material_name || null,
          brand_id: item.brand_id || null,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          save_to_vendor_inventory: item.save_to_vendor_inventory ?? true,
          save_to_price_history: item.save_to_price_history ?? true,
          notes: item.notes || null,
        }));

        const { error: itemsError } = await (supabase as any)
          .from("local_purchase_items")
          .insert(itemsData);

        if (itemsError) throw itemsError;
      }

      return purchase as LocalPurchase;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.localPurchases.bySite(variables.site_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.localPurchases.byEngineer(variables.engineerId),
      });
      if (variables.site_group_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.localPurchases.byGroup(variables.site_group_id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.groupStock.byGroup(variables.site_group_id),
        });
      }
      if (variables.payment_mode === "engineer_own") {
        queryClient.invalidateQueries({
          queryKey: queryKeys.localPurchases.pendingReimbursement(),
        });
      }
      // Invalidate stock
      queryClient.invalidateQueries({
        queryKey: queryKeys.materialStock.bySite(variables.site_id),
      });
    },
  });
}

/**
 * Update local purchase
 */
export function useUpdateLocalPurchase() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<LocalPurchaseFormData>;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { items, ...purchaseData } = data;

      const { data: purchase, error } = await (supabase as any)
        .from("local_purchases")
        .update({
          ...purchaseData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Update items if provided
      if (items !== undefined) {
        // Delete existing items
        await (supabase as any)
          .from("local_purchase_items")
          .delete()
          .eq("local_purchase_id", id);

        // Insert new items
        if (items.length > 0) {
          const itemsData = items.map((item) => ({
            local_purchase_id: id,
            material_id: item.material_id || null,
            custom_material_name: item.custom_material_name || null,
            brand_id: item.brand_id || null,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            save_to_vendor_inventory: item.save_to_vendor_inventory ?? true,
            save_to_price_history: item.save_to_price_history ?? true,
            notes: item.notes || null,
          }));

          await (supabase as any).from("local_purchase_items").insert(itemsData);
        }
      }

      return purchase as LocalPurchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.localPurchases.all,
      });
    },
  });
}

/**
 * Cancel a local purchase
 */
export function useCancelLocalPurchase() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { error } = await (supabase as any)
        .from("local_purchases")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.localPurchases.all,
      });
    },
  });
}

/**
 * Create reimbursement for a local purchase
 */
export function useCreateLocalPurchaseReimbursement() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      purchaseId,
      userId,
    }: {
      purchaseId: string;
      userId: string;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      // Get purchase details
      const { data: purchase, error: fetchError } = await (supabase as any)
        .from("local_purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();

      if (fetchError) throw fetchError;

      // Update purchase with reimbursement info
      const { error: updateError } = await (supabase as any)
        .from("local_purchases")
        .update({
          reimbursement_status: "processed",
          reimbursed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.localPurchases.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.localPurchases.pendingReimbursement(),
      });
    },
  });
}

/**
 * Get local purchase statistics for a site/engineer
 */
export function useLocalPurchaseStats(
  siteId?: string,
  engineerId?: string,
  fromDate?: string,
  toDate?: string
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["local-purchase-stats", siteId, engineerId, fromDate, toDate],
    queryFn: async () => {
      let query = (supabase as any)
        .from("local_purchases")
        .select("total_amount, payment_mode, status, needs_reimbursement")
        .eq("status", "completed");

      if (siteId) {
        query = query.eq("site_id", siteId);
      }

      if (engineerId) {
        query = query.eq("engineer_id", engineerId);
      }

      if (fromDate) {
        query = query.gte("purchase_date", fromDate);
      }

      if (toDate) {
        query = query.lte("purchase_date", toDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Type the data
      const typedData = (data || []) as Array<{
        total_amount: number | null;
        payment_mode: string | null;
        status: string | null;
        needs_reimbursement: boolean | null;
      }>;

      // Calculate stats
      const total = typedData.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const count = typedData.length;
      const pendingReimbursement = typedData
        .filter((p) => p.needs_reimbursement)
        .reduce((sum, p) => sum + (p.total_amount || 0), 0);

      const byPaymentMode = typedData.reduce(
        (acc, p) => {
          const mode = p.payment_mode || "cash";
          acc[mode] = (acc[mode] || 0) + (p.total_amount || 0);
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        total,
        count,
        pendingReimbursement,
        byPaymentMode,
      };
    },
    enabled: !!siteId || !!engineerId,
  });
}
