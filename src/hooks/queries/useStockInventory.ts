"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  StockInventory,
  StockInventoryWithDetails,
  StockLocation,
  StockTransaction,
  StockAdjustmentFormData,
  LowStockAlert,
} from "@/types/material.types";

// ============================================
// STOCK LOCATIONS
// ============================================

/**
 * Fetch stock locations for a site
 */
export function useStockLocations(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? ["stock-locations", siteId]
      : ["stock-locations", "unknown"],
    queryFn: async () => {
      if (!siteId) return [];

      const { data, error } = await supabase
        .from("stock_locations")
        .select("*")
        .eq("site_id", siteId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as StockLocation[];
    },
    enabled: !!siteId,
  });
}

/**
 * Create a stock location
 */
export function useCreateStockLocation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: Partial<StockLocation>) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { data: result, error } = await (
        supabase.from("stock_locations") as any
      )
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as StockLocation;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["stock-locations", variables.site_id],
      });
    },
  });
}

// ============================================
// STOCK INVENTORY
// ============================================

/**
 * Extended stock type that includes shared/group stock information and pricing mode
 */
export type ExtendedStockInventory = StockInventoryWithDetails & {
  is_shared: boolean;
  is_dedicated?: boolean;
  paid_by_site_id?: string | null;
  paid_by_site_name?: string | null;
  batch_code?: string | null;
  pricing_mode?: "per_piece" | "per_kg";
  total_weight?: number | null;
};

/**
 * Fetch site stock inventory with material details
 * Determines is_shared based on batch_code:
 * - Items WITH batch_code = from group purchase = is_shared: true
 * - Items WITHOUT batch_code = own site purchase = is_shared: false
 */
export function useSiteStock(
  siteId: string | undefined,
  options?: {
    locationId?: string;
    siteGroupId?: string | null;
  }
) {
  const supabase = createClient();
  const locationId = options?.locationId;

  return useQuery({
    queryKey: siteId
      ? locationId
        ? [...queryKeys.materialStock.bySite(siteId), locationId]
        : queryKeys.materialStock.bySite(siteId)
      : ["site-stock", "unknown"],
    queryFn: async () => {
      if (!siteId) return [];

      // Query stock_inventory for this site
      // is_shared is determined by whether batch_code exists (group purchase) or not (own site)
      let query = supabase
        .from("stock_inventory")
        .select(
          `
          *,
          pricing_mode,
          total_weight,
          material:materials(id, name, code, unit, category_id, reorder_level, weight_per_unit, length_per_piece),
          brand:material_brands(id, brand_name),
          location:stock_locations(id, name)
        `
        )
        .eq("site_id", siteId)
        .gt("current_qty", 0);

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data: stockData, error } = await query.order("material(name)");
      if (error) throw error;

      // Map stock items with is_shared based on batch_code
      // batch_code indicates the item came from a group purchase
      const stockWithFlags: ExtendedStockInventory[] = ((stockData || []) as any[]).map(
        (item) => {
          // Check for non-empty batch_code (handles null, undefined, empty string)
          const hasBatchCode = item.batch_code && item.batch_code.trim().length > 0;

          return {
            ...item,
            // Items with batch_code are from group purchases (shared)
            // Items without batch_code are own site purchases (not shared)
            is_shared: hasBatchCode,
            is_dedicated: false,
            paid_by_site_id: siteId,
            paid_by_site_name: null,
            batch_code: item.batch_code || null,
            pricing_mode: item.pricing_mode || "per_piece",
            total_weight: item.total_weight ? Number(item.total_weight) : null,
          };
        }
      );

      return stockWithFlags;
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch all stock for a site (including zero stock)
 */
export function useSiteStockAll(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.materialStock.bySite(siteId), "all"]
      : ["site-stock", "all"],
    queryFn: async () => {
      if (!siteId) return [];

      const { data, error } = await supabase
        .from("stock_inventory")
        .select(
          `
          *,
          material:materials(id, name, code, unit, category_id, reorder_level),
          brand:material_brands(id, brand_name),
          location:stock_locations(id, name)
        `
        )
        .eq("site_id", siteId)
        .order("material(name)");

      if (error) throw error;
      return (data as unknown) as StockInventoryWithDetails[];
    },
    enabled: !!siteId,
  });
}

/**
 * Completed stock type for historical view
 */
export interface CompletedStockItem {
  id: string;
  material_id: string;
  material_name: string;
  material_code?: string;
  brand_name?: string;
  original_qty: number;
  unit: string;
  total_value: number;
  avg_unit_cost: number;
  completion_date: string | null;
  last_received_date: string | null;
  is_shared: boolean;
  batch_code?: string | null;
  po_reference?: string | null;
}

/**
 * Fetch completed/consumed stocks for a site (current_qty = 0)
 * Shows historical view of materials that were fully used
 */
export function useCompletedStock(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.materialStock.bySite(siteId), "completed"]
      : ["site-stock", "completed"],
    queryFn: async () => {
      if (!siteId) return [] as CompletedStockItem[];

      // Get completed site stock (qty = 0 but has history)
      const { data: completedStock, error } = await supabase
        .from("stock_inventory")
        .select(
          `
          id,
          material_id,
          brand_id,
          current_qty,
          avg_unit_cost,
          last_received_date,
          last_issued_date,
          batch_code,
          material:materials(id, name, code, unit),
          brand:material_brands(brand_name)
        `
        )
        .eq("site_id", siteId)
        .eq("current_qty", 0)
        .order("last_issued_date", { ascending: false });

      if (error) throw error;

      // Transform to CompletedStockItem format
      const completedItems: CompletedStockItem[] = ((completedStock || []) as any[]).map((item) => ({
        id: item.id,
        material_id: item.material_id,
        material_name: item.material?.name || "Unknown Material",
        material_code: item.material?.code,
        brand_name: item.brand?.brand_name,
        original_qty: 0, // Will be calculated from transactions if needed
        unit: item.material?.unit || "nos",
        total_value: 0, // Will be calculated from transactions if needed
        avg_unit_cost: item.avg_unit_cost || 0,
        completion_date: item.last_issued_date,
        last_received_date: item.last_received_date,
        is_shared: false,
        batch_code: item.batch_code,
        po_reference: null, // Would need to join with PO data
      }));

      return completedItems;
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch low stock alerts for a site
 */
export function useLowStockAlerts(siteId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? queryKeys.materialStock.lowStock(siteId)
      : ["material-stock", "low"],
    queryFn: async () => {
      if (!siteId) return [];

      const { data, error } = await supabase
        .from("v_low_stock_alerts")
        .select("*")
        .eq("site_id", siteId);

      if (error) throw error;
      return data as LowStockAlert[];
    },
    enabled: !!siteId,
  });
}

/**
 * Fetch stock summary across all sites
 */
export function useStockSummary() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.materialStock.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_site_stock_summary")
        .select("*")
        .order("site_name");

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Manual stock adjustment
 */
export function useStockAdjustment() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    retry: false, // Not idempotent - modifies stock quantity
    mutationFn: async (data: StockAdjustmentFormData) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const { inventory_id, adjustment_qty, adjustment_type, notes } = data;

      // Get current inventory
      const { data: inventory, error: fetchError } = await supabase
        .from("stock_inventory")
        .select("*, material:materials(name)")
        .eq("id", inventory_id)
        .single();

      if (fetchError) throw fetchError;

      const newQty = inventory.current_qty + adjustment_qty;
      if (newQty < 0) {
        throw new Error("Cannot reduce stock below zero");
      }

      // Update inventory
      const { error: updateError } = await supabase
        .from("stock_inventory")
        .update({
          current_qty: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inventory_id);

      if (updateError) throw updateError;

      // Create transaction record
      const { error: txError } = await supabase
        .from("stock_transactions")
        .insert({
          site_id: inventory.site_id,
          inventory_id: inventory_id,
          transaction_type: adjustment_type,
          transaction_date: new Date().toISOString().split("T")[0],
          quantity: adjustment_qty,
          unit_cost: inventory.avg_unit_cost,
          total_cost: Math.abs(adjustment_qty) * (inventory.avg_unit_cost || 0),
          notes,
        });

      if (txError) console.error("Failed to create transaction:", txError);

      return { success: true, newQty, siteId: inventory.site_id };
    },
    onSuccess: (result) => {
      const siteKey = result.siteId
        ? queryKeys.materialStock.bySite(result.siteId)
        : ["site-stock"];

      queryClient.invalidateQueries({ queryKey: siteKey });
      if (result.siteId) {
        queryClient.invalidateQueries({ queryKey: [...siteKey, "all"] });
        queryClient.invalidateQueries({
          queryKey: queryKeys.materialStock.lowStock(result.siteId),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.materialStock.all });
    },
  });
}

// ============================================
// STOCK TRANSACTIONS
// ============================================

/**
 * Fetch stock transactions for a site
 */
export function useStockTransactions(
  siteId: string | undefined,
  options?: {
    startDate?: string;
    endDate?: string;
    materialId?: string;
    transactionType?: string;
    limit?: number;
  }
) {
  const supabase = createClient();

  return useQuery({
    queryKey: siteId
      ? [...queryKeys.materialStock.bySite(siteId), "transactions", options]
      : ["stock-transactions", "unknown"],
    queryFn: async () => {
      if (!siteId) return [];

      let query = supabase
        .from("stock_transactions")
        .select(
          `
          *,
          inventory:stock_inventory(
            material:materials(id, name, code, unit),
            brand:material_brands(brand_name)
          ),
          section:building_sections(name)
        `
        )
        .eq("site_id", siteId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (options?.startDate) {
        query = query.gte("transaction_date", options.startDate);
      }
      if (options?.endDate) {
        query = query.lte("transaction_date", options.endDate);
      }
      if (options?.transactionType) {
        query = query.eq("transaction_type", options.transactionType as any);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });
}

// ============================================
// INITIAL STOCK ENTRY
// ============================================

/**
 * Add initial stock to a site
 */
export function useAddInitialStock() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      site_id: string;
      location_id?: string;
      material_id: string;
      brand_id?: string;
      quantity: number;
      unit_cost: number;
    }) => {
      // Ensure fresh session before mutation
      await ensureFreshSession();

      const {
        site_id,
        location_id,
        material_id,
        brand_id,
        quantity,
        unit_cost,
      } = data;

      // Check if inventory record exists
      let query = supabase
        .from("stock_inventory")
        .select("id, current_qty, avg_unit_cost")
        .eq("site_id", site_id)
        .eq("material_id", material_id);

      if (location_id) {
        query = query.eq("location_id", location_id);
      } else {
        query = query.is("location_id", null);
      }

      if (brand_id) {
        query = query.eq("brand_id", brand_id);
      } else {
        query = query.is("brand_id", null);
      }

      const { data: existing } = await query.maybeSingle();

      let inventoryId: string;

      if (existing) {
        // Update existing
        const newQty = existing.current_qty + quantity;
        const newAvgCost =
          (existing.current_qty * (existing.avg_unit_cost || 0) +
            quantity * unit_cost) /
          newQty;

        const { error } = await supabase
          .from("stock_inventory")
          .update({
            current_qty: newQty,
            avg_unit_cost: newAvgCost,
            last_received_date: new Date().toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
        inventoryId = existing.id;
      } else {
        // Create new
        const { data: newInv, error } = await supabase
          .from("stock_inventory")
          .insert({
            site_id,
            location_id,
            material_id,
            brand_id,
            current_qty: quantity,
            avg_unit_cost: unit_cost,
            last_received_date: new Date().toISOString().split("T")[0],
          })
          .select()
          .single();

        if (error) throw error;
        inventoryId = newInv.id;
      }

      // Create transaction
      await supabase.from("stock_transactions").insert({
        site_id,
        inventory_id: inventoryId,
        transaction_type: "initial",
        transaction_date: new Date().toISOString().split("T")[0],
        quantity,
        unit_cost,
        total_cost: quantity * unit_cost,
        notes: "Initial stock entry",
      });

      return { success: true };
    },
    onSuccess: (_result, variables) => {
      const siteKey = queryKeys.materialStock.bySite(variables.site_id);
      queryClient.invalidateQueries({ queryKey: siteKey });
      queryClient.invalidateQueries({ queryKey: [...siteKey, "all"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.materialStock.all });
    },
  });
}
