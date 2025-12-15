"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  SiteGroup,
  SiteGroupWithSites,
  SiteGroupFormData,
  GroupStockInventory,
  GroupStockInventoryWithDetails,
  GroupStockTransaction,
  GroupStockTransactionWithDetails,
} from "@/types/material.types";

// ============================================
// SITE GROUPS
// Note: Using type assertions because site_groups table
// may not be in generated types until regeneration
// ============================================

/**
 * Fetch all site groups
 */
export function useSiteGroups() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.siteGroups.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_groups")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data || []) as SiteGroup[];
    },
  });
}

/**
 * Fetch a single site group with its sites
 */
export function useSiteGroup(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: id ? queryKeys.siteGroups.byId(id) : ["site-groups", "detail"],
    queryFn: async () => {
      if (!id) return null;

      const { data: group, error: groupError } = await (supabase as any)
        .from("site_groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;

      // Get sites in this group
      const { data: sites, error: sitesError } = await (supabase as any)
        .from("sites")
        .select("id, name")
        .eq("site_group_id", id)
        .eq("is_active", true);

      if (sitesError) throw sitesError;

      return {
        ...group,
        sites: sites || [],
      } as SiteGroupWithSites;
    },
    enabled: !!id,
  });
}

/**
 * Fetch sites for a site group
 */
export function useSiteGroupSites(groupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? queryKeys.siteGroups.sites(groupId)
      : ["site-groups", "sites"],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await (supabase as any)
        .from("sites")
        .select("id, name, address, city")
        .eq("site_group_id", groupId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId,
  });
}

/**
 * Create a new site group
 */
export function useCreateSiteGroup() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: SiteGroupFormData) => {
      const { data: group, error } = await (supabase as any)
        .from("site_groups")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return group as SiteGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteGroups.list() });
    },
  });
}

/**
 * Update a site group
 */
export function useUpdateSiteGroup() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SiteGroupFormData>;
    }) => {
      const { data: group, error } = await (supabase as any)
        .from("site_groups")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return group as SiteGroup;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteGroups.list() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.siteGroups.byId(variables.id),
      });
    },
  });
}

/**
 * Add a site to a group
 */
export function useAddSiteToGroup() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      groupId,
    }: {
      siteId: string;
      groupId: string;
    }) => {
      const { error } = await (supabase as any)
        .from("sites")
        .update({ site_group_id: groupId })
        .eq("id", siteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.siteGroups.byId(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.siteGroups.sites(variables.groupId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.list() });
    },
  });
}

/**
 * Remove a site from its group
 */
export function useRemoveSiteFromGroup() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      groupId,
    }: {
      siteId: string;
      groupId: string;
    }) => {
      const { error } = await (supabase as any)
        .from("sites")
        .update({ site_group_id: null })
        .eq("id", siteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.siteGroups.byId(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.siteGroups.sites(variables.groupId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.list() });
    },
  });
}

// ============================================
// GROUP STOCK INVENTORY
// ============================================

/**
 * Fetch group stock inventory for a site group
 */
export function useGroupStockInventory(groupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? queryKeys.groupStock.byGroup(groupId)
      : ["group-stock", "inventory"],
    queryFn: async () => {
      if (!groupId) return [] as GroupStockInventoryWithDetails[];

      const { data, error } = await (supabase as any)
        .from("group_stock_inventory")
        .select(
          `
          *,
          material:materials(id, name, code, unit, category_id),
          brand:material_brands(id, brand_name),
          site_group:site_groups(id, name)
        `
        )
        .eq("site_group_id", groupId)
        .gt("current_qty", 0)
        .order("material_id");

      if (error) throw error;
      return (data || []) as GroupStockInventoryWithDetails[];
    },
    enabled: !!groupId,
  });
}

/**
 * Fetch group stock summary (aggregated view)
 */
export function useGroupStockSummary(groupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? queryKeys.groupStock.summary(groupId)
      : ["group-stock", "summary"],
    queryFn: async () => {
      if (!groupId) return null;

      // Query from the actual table with aggregation since view may not exist
      const { data, error } = await (supabase as any)
        .from("group_stock_inventory")
        .select("*")
        .eq("site_group_id", groupId);

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });
}

// ============================================
// GROUP STOCK TRANSACTIONS
// ============================================

/**
 * Fetch group stock transactions
 */
export function useGroupStockTransactions(
  groupId: string | undefined,
  options?: {
    limit?: number;
    transactionType?: string;
    usageSiteId?: string;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? [...queryKeys.groupStock.transactions(groupId), options]
      : ["group-stock", "transactions"],
    queryFn: async () => {
      if (!groupId) return [] as GroupStockTransactionWithDetails[];

      let query = (supabase as any)
        .from("group_stock_transactions")
        .select(
          `
          *,
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name),
          site_group:site_groups(id, name),
          usage_site:sites(id, name),
          payment_source_site:sites(id, name)
        `
        )
        .eq("site_group_id", groupId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (options?.transactionType) {
        query = query.eq("transaction_type", options.transactionType);
      }

      if (options?.usageSiteId) {
        query = query.eq("usage_site_id", options.usageSiteId);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as GroupStockTransactionWithDetails[];
    },
    enabled: !!groupId,
  });
}

/**
 * Fetch usage by site for a group (expense allocation view)
 */
export function useGroupUsageBySite(groupId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: groupId
      ? queryKeys.groupStock.usageBySite(groupId)
      : ["group-stock", "usage-by-site"],
    queryFn: async () => {
      if (!groupId) return [];

      // Query from transactions table with aggregation since view may not exist
      const { data, error } = await (supabase as any)
        .from("group_stock_transactions")
        .select(`
          *,
          usage_site:sites(id, name)
        `)
        .eq("site_group_id", groupId)
        .eq("transaction_type", "usage")
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId,
  });
}

/**
 * Add purchase to group stock
 */
export function useAddGroupStockPurchase() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      groupId: string;
      materialId: string;
      brandId?: string;
      quantity: number;
      unitCost: number;
      paymentSource: string;
      paymentSiteId?: string;
      referenceType?: string;
      referenceId?: string;
      userId?: string;
    }) => {
      // Insert transaction record directly
      const totalCost = data.quantity * data.unitCost;

      const { data: transaction, error: txError } = await (supabase as any)
        .from("group_stock_transactions")
        .insert({
          site_group_id: data.groupId,
          material_id: data.materialId,
          brand_id: data.brandId || null,
          transaction_type: "purchase",
          transaction_date: new Date().toISOString().split("T")[0],
          quantity: data.quantity,
          unit_cost: data.unitCost,
          total_cost: totalCost,
          payment_source: data.paymentSource,
          payment_source_site_id: data.paymentSiteId || null,
          reference_type: data.referenceType || "manual",
          reference_id: data.referenceId || null,
          created_by: data.userId || null,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update or insert inventory record
      const { data: existingInventory } = await (supabase as any)
        .from("group_stock_inventory")
        .select("*")
        .eq("site_group_id", data.groupId)
        .eq("material_id", data.materialId)
        .eq("brand_id", data.brandId || null)
        .maybeSingle();

      if (existingInventory) {
        // Update with weighted average
        const newQty = (existingInventory.current_qty || 0) + data.quantity;
        const existingValue = (existingInventory.current_qty || 0) * (existingInventory.avg_unit_cost || 0);
        const newAvgCost = (existingValue + totalCost) / newQty;

        await (supabase as any)
          .from("group_stock_inventory")
          .update({
            current_qty: newQty,
            avg_unit_cost: newAvgCost,
            last_received_date: new Date().toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingInventory.id);
      } else {
        // Insert new inventory record
        await (supabase as any)
          .from("group_stock_inventory")
          .insert({
            site_group_id: data.groupId,
            material_id: data.materialId,
            brand_id: data.brandId || null,
            current_qty: data.quantity,
            avg_unit_cost: data.unitCost,
            last_received_date: new Date().toISOString().split("T")[0],
          });
      }

      return transaction;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupStock.byGroup(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupStock.transactions(variables.groupId),
      });
    },
  });
}

/**
 * Record usage from group stock
 */
export function useRecordGroupStockUsage() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      groupId: string;
      materialId: string;
      brandId?: string;
      quantity: number;
      usageSiteId: string;
      workDescription?: string;
      referenceType?: string;
      referenceId?: string;
      userId?: string;
    }) => {
      // Get current inventory to calculate cost
      const { data: inventory, error: invError } = await (supabase as any)
        .from("group_stock_inventory")
        .select("*")
        .eq("site_group_id", data.groupId)
        .eq("material_id", data.materialId)
        .eq("brand_id", data.brandId || null)
        .single();

      if (invError) throw new Error("Material not found in group stock");
      if (inventory.current_qty < data.quantity) {
        throw new Error("Insufficient stock");
      }

      const unitCost = inventory.avg_unit_cost || 0;
      const totalCost = data.quantity * unitCost;

      // Insert usage transaction
      const { data: transaction, error: txError } = await (supabase as any)
        .from("group_stock_transactions")
        .insert({
          site_group_id: data.groupId,
          material_id: data.materialId,
          brand_id: data.brandId || null,
          transaction_type: "usage",
          transaction_date: new Date().toISOString().split("T")[0],
          quantity: -data.quantity, // Negative for usage
          unit_cost: unitCost,
          total_cost: -totalCost,
          usage_site_id: data.usageSiteId,
          work_description: data.workDescription || null,
          reference_type: data.referenceType || "manual",
          reference_id: data.referenceId || null,
          created_by: data.userId || null,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update inventory
      await (supabase as any)
        .from("group_stock_inventory")
        .update({
          current_qty: inventory.current_qty - data.quantity,
          last_used_date: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", inventory.id);

      return transaction;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupStock.byGroup(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupStock.transactions(variables.groupId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.groupStock.usageBySite(variables.groupId),
      });
    },
  });
}
