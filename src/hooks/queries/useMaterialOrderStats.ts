"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Material order statistics - frequency of orders for each material
 */
export interface MaterialOrderStats {
  material_id: string;
  order_count: number;
  total_qty_ordered: number;
  last_ordered: string | null;
}

/**
 * Best price info for a material from vendor inventory
 */
export interface MaterialBestPrice {
  material_id: string;
  vendor_id: string;
  vendor_name: string;
  unit_price: number;
  price_includes_gst: boolean;
}

/**
 * Fetch order statistics for all materials
 * Used for sorting by frequency (frequently ordered materials first)
 */
export function useMaterialOrderStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["materials", "order-stats"],
    queryFn: async () => {
      // Get order stats from purchase_order_items joined with purchase_orders
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select(`
          material_id,
          quantity,
          purchase_orders!inner(
            id,
            status,
            created_at
          )
        `)
        .not("purchase_orders.status", "in", '("cancelled","draft")');

      if (error) {
        // If table doesn't exist or query fails, return empty map
        console.warn("Could not fetch order stats:", error.message);
        return new Map<string, MaterialOrderStats>();
      }

      // Aggregate by material_id
      const statsMap = new Map<string, MaterialOrderStats>();

      for (const item of data || []) {
        const materialId = item.material_id;
        const existing = statsMap.get(materialId);
        const po = item.purchase_orders as { id: string; status: string; created_at: string };

        if (existing) {
          existing.order_count += 1;
          existing.total_qty_ordered += item.quantity || 0;
          if (!existing.last_ordered || po.created_at > existing.last_ordered) {
            existing.last_ordered = po.created_at;
          }
        } else {
          statsMap.set(materialId, {
            material_id: materialId,
            order_count: 1,
            total_qty_ordered: item.quantity || 0,
            last_ordered: po.created_at,
          });
        }
      }

      return statsMap;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch best prices for all materials from vendor inventory
 */
export function useMaterialBestPrices() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["materials", "best-prices"],
    queryFn: async () => {
      // Get vendor inventory with vendor names
      const { data, error } = await supabase
        .from("vendor_inventory")
        .select(`
          material_id,
          vendor_id,
          current_price,
          price_includes_gst,
          vendors(name)
        `)
        .eq("is_available", true)
        .not("material_id", "is", null)
        .order("current_price", { ascending: true });

      if (error) {
        console.warn("Could not fetch best prices:", error.message);
        return new Map<string, MaterialBestPrice>();
      }

      // Get best (lowest) price per material
      const priceMap = new Map<string, MaterialBestPrice>();

      for (const item of data || []) {
        if (!item.material_id) continue;

        // Only store if this is the first (lowest price) for this material
        if (!priceMap.has(item.material_id)) {
          const vendorData = item.vendors as { name: string } | null;
          priceMap.set(item.material_id, {
            material_id: item.material_id,
            vendor_id: item.vendor_id,
            vendor_name: vendorData?.name || "Unknown",
            unit_price: item.current_price || 0,
            price_includes_gst: item.price_includes_gst || false,
          });
        }
      }

      return priceMap;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch audit info for materials (created_by, updated_by user names)
 */
export function useMaterialAuditInfo() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["materials", "audit-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select(`
          id,
          created_at,
          updated_at,
          created_by
        `)
        .eq("is_active", true);

      if (error) {
        console.warn("Could not fetch audit info:", error.message);
        return new Map<string, { created_at: string; updated_at: string; created_by_name: string | null }>();
      }

      // Get unique user IDs
      const userIds = [...new Set((data || []).map(m => m.created_by).filter(Boolean))] as string[];

      // Fetch user names
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name")
          .in("id", userIds);

        userMap = new Map((users || []).map(u => [u.id, u.name]));
      }

      // Create audit info map
      const auditMap = new Map<string, { created_at: string; updated_at: string; created_by_name: string | null }>();

      for (const material of data || []) {
        auditMap.set(material.id, {
          created_at: material.created_at || "",
          updated_at: material.updated_at || "",
          created_by_name: material.created_by ? userMap.get(material.created_by) || null : null,
        });
      }

      return auditMap;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
