"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  VendorInventory,
  VendorInventoryWithDetails,
  VendorInventoryFormData,
  PriceHistory,
  PriceHistoryWithDetails,
  PriceEntryFormData,
} from "@/types/material.types";

// ============================================
// VENDOR INVENTORY
// Note: Using type assertions because vendor_inventory and price_history tables
// may not be in generated types until regeneration
// ============================================

/**
 * Fetch vendor inventory (all materials a vendor sells)
 */
export function useVendorInventory(vendorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: vendorId
      ? queryKeys.vendorInventory.byVendor(vendorId)
      : ["vendor-inventory", "vendor"],
    queryFn: async () => {
      if (!vendorId) return [] as VendorInventoryWithDetails[];

      const { data, error } = await (supabase as any)
        .from("vendor_inventory")
        .select(
          `
          *,
          vendor:vendors(id, name, vendor_type, shop_name),
          material:materials(id, name, code, unit, category_id),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("vendor_id", vendorId)
        .eq("is_available", true)
        .order("material_id");

      if (error) throw error;

      // Calculate total landed cost for each item
      return ((data || []) as any[]).map((item) => ({
        ...item,
        total_landed_cost:
          (item.current_price || 0) +
          (item.price_includes_transport ? 0 : item.transport_cost || 0) +
          (item.loading_cost || 0) +
          (item.unloading_cost || 0),
      })) as VendorInventoryWithDetails[];
    },
    enabled: !!vendorId,
  });
}

/**
 * Fetch all vendors that sell a specific material
 */
export function useMaterialVendors(materialId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: materialId
      ? queryKeys.vendorInventory.byMaterial(materialId)
      : ["vendor-inventory", "material"],
    queryFn: async () => {
      if (!materialId) return [] as VendorInventoryWithDetails[];

      const { data, error } = await (supabase as any)
        .from("vendor_inventory")
        .select(
          `
          *,
          vendor:vendors(*),
          material:materials(id, name, code, unit, category_id),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("material_id", materialId)
        .eq("is_available", true)
        .order("current_price");

      if (error) throw error;

      // Calculate total landed cost for each item
      return ((data || []) as any[]).map((item) => ({
        ...item,
        total_landed_cost:
          (item.current_price || 0) +
          (item.price_includes_transport ? 0 : item.transport_cost || 0) +
          (item.loading_cost || 0) +
          (item.unloading_cost || 0),
      })) as VendorInventoryWithDetails[];
    },
    enabled: !!materialId,
  });
}

/**
 * Search vendor inventory across all vendors
 */
export function useVendorInventorySearch(searchTerm: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.vendorInventory.search(searchTerm),
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await (supabase as any)
        .from("vendor_inventory")
        .select(
          `
          *,
          vendor:vendors(id, name, vendor_type, shop_name),
          material:materials(id, name, code, unit, category_id),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("is_available", true)
        .order("current_price")
        .limit(50);

      if (error) throw error;

      // Filter by material name client-side since we can't use ilike on joins
      const filtered = ((data || []) as any[]).filter(
        (item) =>
          item.material?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.custom_material_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return filtered.map((item) => ({
        ...item,
        total_landed_cost:
          (item.current_price || 0) +
          (item.price_includes_transport ? 0 : item.transport_cost || 0) +
          (item.loading_cost || 0) +
          (item.unloading_cost || 0),
      }));
    },
    enabled: searchTerm.length >= 2,
  });
}

/**
 * Get vendor count for a material
 */
export function useVendorCountForMaterial(materialId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["vendor-count", "material", materialId],
    queryFn: async () => {
      if (!materialId) return 0;

      const { count, error } = await (supabase as any)
        .from("vendor_inventory")
        .select("*", { count: "exact", head: true })
        .eq("material_id", materialId)
        .eq("is_available", true);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!materialId,
  });
}

/**
 * Get material count for a vendor (shop inventory size)
 */
export function useMaterialCountForVendor(vendorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["material-count", "vendor", vendorId],
    queryFn: async () => {
      if (!vendorId) return 0;

      const { count, error } = await (supabase as any)
        .from("vendor_inventory")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", vendorId)
        .eq("is_available", true);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!vendorId,
  });
}

/**
 * Add/update vendor inventory item
 */
export function useUpsertVendorInventory() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: VendorInventoryFormData) => {
      // Check if item exists
      const { data: existing } = await (supabase as any)
        .from("vendor_inventory")
        .select("id")
        .eq("vendor_id", data.vendor_id)
        .eq("material_id", data.material_id || null)
        .eq("brand_id", data.brand_id || null)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data: result, error } = await (supabase as any)
          .from("vendor_inventory")
          .update({
            ...data,
            last_price_update: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return result as VendorInventory;
      } else {
        // Insert new
        const { data: result, error } = await (supabase as any)
          .from("vendor_inventory")
          .insert({
            ...data,
            last_price_update: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return result as VendorInventory;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendorInventory.byVendor(variables.vendor_id),
      });
      if (variables.material_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.vendorInventory.byMaterial(variables.material_id),
        });
      }
    },
  });
}

/**
 * Update vendor inventory availability
 */
export function useUpdateVendorInventoryAvailability() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      isAvailable,
    }: {
      id: string;
      isAvailable: boolean;
    }) => {
      const { error } = await (supabase as any)
        .from("vendor_inventory")
        .update({
          is_available: isAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendorInventory.all,
      });
    },
  });
}

// ============================================
// PRICE HISTORY
// ============================================

/**
 * Fetch price history for a vendor + material combination
 */
export function usePriceHistory(
  vendorId: string | undefined,
  materialId: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey:
      vendorId && materialId
        ? queryKeys.priceHistory.byVendorMaterial(vendorId, materialId)
        : ["price-history", "vendor-material"],
    queryFn: async () => {
      if (!vendorId || !materialId) return [] as PriceHistoryWithDetails[];

      const { data, error } = await (supabase as any)
        .from("price_history")
        .select(
          `
          *,
          vendor:vendors(id, name, vendor_type),
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("vendor_id", vendorId)
        .eq("material_id", materialId)
        .order("recorded_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as PriceHistoryWithDetails[];
    },
    enabled: !!vendorId && !!materialId,
  });
}

/**
 * Fetch price history for a material across all vendors
 */
export function useMaterialPriceHistory(materialId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: materialId
      ? queryKeys.priceHistory.byMaterial(materialId)
      : ["price-history", "material"],
    queryFn: async () => {
      if (!materialId) return [] as PriceHistoryWithDetails[];

      const { data, error } = await (supabase as any)
        .from("price_history")
        .select(
          `
          *,
          vendor:vendors(id, name, vendor_type),
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("material_id", materialId)
        .order("recorded_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as PriceHistoryWithDetails[];
    },
    enabled: !!materialId,
  });
}

/**
 * Fetch price history for a vendor across all materials
 */
export function useVendorPriceHistory(vendorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: vendorId
      ? queryKeys.priceHistory.byVendor(vendorId)
      : ["price-history", "vendor"],
    queryFn: async () => {
      if (!vendorId) return [] as PriceHistoryWithDetails[];

      const { data, error } = await (supabase as any)
        .from("price_history")
        .select(
          `
          *,
          vendor:vendors(id, name, vendor_type),
          material:materials(id, name, code, unit),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("vendor_id", vendorId)
        .order("recorded_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as PriceHistoryWithDetails[];
    },
    enabled: !!vendorId,
  });
}

/**
 * Record a new price entry (also updates vendor inventory)
 */
export function useRecordPriceEntry() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: PriceEntryFormData & { userId?: string }) => {
      const totalLandedCost =
        data.price +
        (data.transport_cost || 0) +
        (data.loading_cost || 0) +
        (data.unloading_cost || 0);

      // Insert price history record
      const { data: result, error } = await (supabase as any)
        .from("price_history")
        .insert({
          vendor_id: data.vendor_id,
          material_id: data.material_id,
          brand_id: data.brand_id || null,
          price: data.price,
          price_includes_gst: data.price_includes_gst || false,
          gst_rate: data.gst_rate || null,
          transport_cost: data.transport_cost || null,
          loading_cost: data.loading_cost || null,
          unloading_cost: data.unloading_cost || null,
          total_landed_cost: totalLandedCost,
          recorded_date: new Date().toISOString().split("T")[0],
          source: data.source,
          source_reference: data.source_reference || null,
          quantity: data.quantity || null,
          unit: data.unit || null,
          recorded_by: data.userId || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Also update vendor inventory current price
      const { data: existingInventory } = await (supabase as any)
        .from("vendor_inventory")
        .select("id")
        .eq("vendor_id", data.vendor_id)
        .eq("material_id", data.material_id)
        .eq("brand_id", data.brand_id || null)
        .maybeSingle();

      if (existingInventory) {
        await (supabase as any)
          .from("vendor_inventory")
          .update({
            current_price: data.price,
            price_includes_gst: data.price_includes_gst || false,
            gst_rate: data.gst_rate || null,
            transport_cost: data.transport_cost || null,
            loading_cost: data.loading_cost || null,
            unloading_cost: data.unloading_cost || null,
            last_price_update: new Date().toISOString(),
            price_source: data.source,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingInventory.id);
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.priceHistory.byVendorMaterial(
          variables.vendor_id,
          variables.material_id
        ),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.priceHistory.byMaterial(variables.material_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.priceHistory.byVendor(variables.vendor_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendorInventory.byVendor(variables.vendor_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendorInventory.byMaterial(variables.material_id),
      });
    },
  });
}

/**
 * Get the latest price for a vendor + material
 */
export function useLatestPrice(
  vendorId: string | undefined,
  materialId: string | undefined,
  brandId?: string | null
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["latest-price", vendorId, materialId, brandId],
    queryFn: async () => {
      if (!vendorId || !materialId) return null;

      let query = (supabase as any)
        .from("price_history")
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("material_id", materialId)
        .order("recorded_date", { ascending: false })
        .limit(1);

      if (brandId) {
        query = query.eq("brand_id", brandId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data?.[0] || null) as PriceHistory | null;
    },
    enabled: !!vendorId && !!materialId,
  });
}

/**
 * Get price trend for a material (average price over time)
 */
export function usePriceTrend(
  materialId: string | undefined,
  vendorId?: string | null,
  months: number = 6
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["price-trend", materialId, vendorId, months],
    queryFn: async () => {
      if (!materialId) return [];

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      let query = (supabase as any)
        .from("price_history")
        .select("recorded_date, price, total_landed_cost, vendor_id")
        .eq("material_id", materialId)
        .gte("recorded_date", startDate.toISOString().split("T")[0])
        .order("recorded_date");

      if (vendorId) {
        query = query.eq("vendor_id", vendorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!materialId,
  });
}
