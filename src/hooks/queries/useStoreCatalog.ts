"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  StoreCatalogItem,
  StoreCatalogFilter,
  LowestCompetingPrice,
  MaterialCategory,
} from "@/types/material.types";

// ============================================
// STORE CATALOG HOOKS
// For browsing vendor's product catalog with price comparison
// ============================================

/**
 * Fetch store catalog for a vendor with price comparison data
 * Returns products enriched with lowest competing price info
 */
export function useStoreCatalog(vendorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: vendorId
      ? queryKeys.storeCatalog.byVendor(vendorId)
      : ["store-catalog", "vendor"],
    queryFn: async () => {
      if (!vendorId) return [] as StoreCatalogItem[];

      // Fetch vendor inventory with full material and category details
      const { data: inventory, error: invError } = await (supabase as any)
        .from("vendor_inventory")
        .select(
          `
          *,
          vendor:vendors(id, name, vendor_type, shop_name),
          material:materials(
            id, name, code, unit, category_id, image_url, local_name,
            description, weight_per_unit, weight_unit, hsn_code, gst_rate
          ),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("vendor_id", vendorId)
        .eq("is_available", true)
        .order("material_id");

      if (invError) throw invError;

      if (!inventory || inventory.length === 0) {
        return [] as StoreCatalogItem[];
      }

      // Get unique material IDs that have materials (not custom items)
      const materialIds = (inventory as any[])
        .filter((item) => item.material_id)
        .map((item) => item.material_id);

      // Fetch all competing prices in one query
      let lowestPriceMap: Record<string, LowestCompetingPrice> = {};

      if (materialIds.length > 0) {
        const { data: allPrices, error: priceError } = await (supabase as any)
          .from("vendor_inventory")
          .select("material_id, current_price, vendor:vendors(id, name)")
          .in("material_id", materialIds)
          .eq("is_available", true)
          .neq("vendor_id", vendorId)
          .order("current_price");

        if (!priceError && allPrices) {
          // Build lowest price map for each material
          lowestPriceMap = buildLowestPriceMap(allPrices);
        }
      }

      // Fetch categories for materials
      const categoryIds = [...new Set(
        (inventory as any[])
          .filter((item) => item.material?.category_id)
          .map((item) => item.material.category_id)
      )];

      let categoryMap: Record<string, Partial<MaterialCategory>> = {};
      if (categoryIds.length > 0) {
        const { data: categories } = await supabase
          .from("material_categories")
          .select("*")
          .in("id", categoryIds);

        if (categories) {
          categoryMap = Object.fromEntries(
            categories.map((cat) => [cat.id, cat as Partial<MaterialCategory>])
          );
        }
      }

      // Enrich inventory with price comparison and category data
      return (inventory as any[]).map((item) => {
        const totalLandedCost =
          (item.current_price || 0) +
          (item.price_includes_transport ? 0 : item.transport_cost || 0) +
          (item.loading_cost || 0) +
          (item.unloading_cost || 0);

        const lowestCompeting = item.material_id
          ? lowestPriceMap[item.material_id]
          : null;

        const isBestPrice =
          !lowestCompeting || (item.current_price || 0) <= lowestCompeting.price;

        const category = item.material?.category_id
          ? categoryMap[item.material.category_id]
          : null;

        return {
          ...item,
          total_landed_cost: totalLandedCost,
          lowestCompetingPrice: lowestCompeting || null,
          isBestPrice,
          category,
        } as StoreCatalogItem;
      });
    },
    enabled: !!vendorId,
  });
}

/**
 * Build a map of material_id -> lowest competing price
 */
function buildLowestPriceMap(
  prices: Array<{
    material_id: string;
    current_price: number;
    vendor: { id: string; name: string };
  }>
): Record<string, LowestCompetingPrice> {
  const map: Record<string, LowestCompetingPrice> = {};

  // Prices are already sorted by current_price, so first occurrence is lowest
  prices.forEach((item) => {
    if (!map[item.material_id] && item.current_price && item.vendor) {
      map[item.material_id] = {
        price: item.current_price,
        vendorName: item.vendor.name,
        vendorId: item.vendor.id,
      };
    }
  });

  return map;
}

/**
 * Get category counts for store filtering
 * Returns count of products per category in the vendor's catalog
 */
export function useStoreCategoryCounts(vendorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: vendorId
      ? queryKeys.storeCatalog.categories(vendorId)
      : ["store-catalog", "categories"],
    queryFn: async () => {
      if (!vendorId) return {} as Record<string, number>;

      const { data, error } = await (supabase as any)
        .from("vendor_inventory")
        .select("material:materials(category_id)")
        .eq("vendor_id", vendorId)
        .eq("is_available", true);

      if (error) throw error;

      // Count products by category
      const counts: Record<string, number> = {};
      (data || []).forEach((item: { material: { category_id: string | null } | null }) => {
        const catId = item.material?.category_id;
        if (catId) {
          counts[catId] = (counts[catId] || 0) + 1;
        }
      });

      return counts;
    },
    enabled: !!vendorId,
  });
}

/**
 * Get categories that have products in this store
 */
export function useStoreCategoriesWithCounts(vendorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: vendorId
      ? [...queryKeys.storeCatalog.categories(vendorId), "withDetails"]
      : ["store-catalog", "categories", "withDetails"],
    queryFn: async () => {
      if (!vendorId) return [];

      // Get category counts
      const { data: inventory, error: invError } = await (supabase as any)
        .from("vendor_inventory")
        .select("material:materials(category_id)")
        .eq("vendor_id", vendorId)
        .eq("is_available", true);

      if (invError) throw invError;

      // Count products by category
      const counts: Record<string, number> = {};
      (inventory || []).forEach((item: { material: { category_id: string | null } | null }) => {
        const catId = item.material?.category_id;
        if (catId) {
          counts[catId] = (counts[catId] || 0) + 1;
        }
      });

      const categoryIds = Object.keys(counts);
      if (categoryIds.length === 0) return [];

      // Fetch category details
      const { data: categories, error: catError } = await supabase
        .from("material_categories")
        .select("*")
        .in("id", categoryIds)
        .order("display_order");

      if (catError) throw catError;

      // Combine categories with counts
      return (categories || []).map((cat) => ({
        ...cat,
        productCount: counts[cat.id] || 0,
      }));
    },
    enabled: !!vendorId,
  });
}

/**
 * Filter and sort store catalog items client-side
 * Use this with useStoreCatalog data for filtering
 */
export function filterStoreCatalog(
  items: StoreCatalogItem[],
  filter: StoreCatalogFilter
): StoreCatalogItem[] {
  let filtered = [...items];

  // Filter by category
  if (filter.categoryId) {
    filtered = filtered.filter(
      (item) => item.material?.category_id === filter.categoryId
    );
  }

  // Filter by search query
  if (filter.searchQuery && filter.searchQuery.length > 0) {
    const query = filter.searchQuery.toLowerCase();
    filtered = filtered.filter((item) => {
      const materialName = item.material?.name?.toLowerCase() || "";
      const materialCode = item.material?.code?.toLowerCase() || "";
      const localName = item.material?.local_name?.toLowerCase() || "";
      const customName = item.custom_material_name?.toLowerCase() || "";
      const brandName = item.brand?.brand_name?.toLowerCase() || "";

      return (
        materialName.includes(query) ||
        materialCode.includes(query) ||
        localName.includes(query) ||
        customName.includes(query) ||
        brandName.includes(query)
      );
    });
  }

  // Sort
  switch (filter.sortBy) {
    case "price_asc":
      filtered.sort((a, b) => (a.current_price || 0) - (b.current_price || 0));
      break;
    case "price_desc":
      filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
      break;
    case "name":
      filtered.sort((a, b) => {
        const nameA = a.material?.name || a.custom_material_name || "";
        const nameB = b.material?.name || b.custom_material_name || "";
        return nameA.localeCompare(nameB);
      });
      break;
    case "recent":
      filtered.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });
      break;
    default:
      // Default: sort by name
      filtered.sort((a, b) => {
        const nameA = a.material?.name || a.custom_material_name || "";
        const nameB = b.material?.name || b.custom_material_name || "";
        return nameA.localeCompare(nameB);
      });
  }

  return filtered;
}

/**
 * Get all vendors selling a specific material with their prices
 * For price comparison in product detail drawer
 */
export function useMaterialPriceComparison(materialId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: materialId
      ? queryKeys.storeCatalog.priceComparison(materialId)
      : ["store-catalog", "price-comparison"],
    queryFn: async () => {
      if (!materialId) return [];

      const { data, error } = await (supabase as any)
        .from("vendor_inventory")
        .select(
          `
          *,
          vendor:vendors(id, name, vendor_type, shop_name, city, phone, whatsapp_number),
          brand:material_brands(id, brand_name)
        `
        )
        .eq("material_id", materialId)
        .eq("is_available", true)
        .order("current_price");

      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        total_landed_cost:
          (item.current_price || 0) +
          (item.price_includes_transport ? 0 : item.transport_cost || 0) +
          (item.loading_cost || 0) +
          (item.unloading_cost || 0),
      }));
    },
    enabled: !!materialId,
  });
}
