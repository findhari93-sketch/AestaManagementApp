"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { wrapQueryFn } from "@/lib/utils/timeout";
import type { VendorQuote } from "@/lib/category-calculator-templates";

/**
 * Fetches vendor prices for a given material, deduplicated to one row per vendor
 * (lowest price wins). Optionally filters by brand and/or unit when supplied —
 * needed for teak where the same material has multiple (type × quality) brand
 * rows priced in different units (cft for Log, sqft for Palagai).
 *
 * @param materialId - Pass null to disable the query.
 * @param brandId    - Pass to filter to a specific brand row (composite type×quality).
 * @param unit       - Pass to filter vendor_inventory.unit (e.g. 'cft' or 'sqft').
 */
export function useCalculatorVendorQuotes(
  materialId: string | null,
  brandId?: string | null,
  unit?: string | null,
): { quotes: VendorQuote[]; isLoading: boolean; error: Error | null } {
  const supabase = createClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["calculatorQuotes", materialId, brandId ?? null, unit ?? null],
    enabled: materialId !== null,
    queryFn: wrapQueryFn(
      async () => {
        let q = supabase
          .from("vendor_inventory")
          .select(
            `
            vendor_id,
            current_price,
            price_includes_gst,
            last_price_update,
            updated_at,
            vendors(name)
          `,
          )
          .eq("material_id", materialId as string)
          .eq("is_available", true)
          .gt("current_price", 0)
          .order("current_price", { ascending: true });

        if (brandId) q = q.eq("brand_id", brandId);
        if (unit) q = q.eq("unit", unit);

        const { data: rows, error: queryError } = await q;

        if (queryError) throw new Error(queryError.message);

        // Deduplicate by vendor_id — keep the row with the lowest price.
        // vendor_inventory accumulates multiple price-history rows per vendor.
        const bestByVendor = new Map<string, (typeof rows)[number]>();
        for (const row of rows ?? []) {
          if (!row.vendor_id || row.current_price == null) continue;
          const existing = bestByVendor.get(row.vendor_id);
          if (!existing || row.current_price < existing.current_price!) {
            bestByVendor.set(row.vendor_id, row);
          }
        }

        return Array.from(bestByVendor.values())
          .sort((a, b) => a.current_price! - b.current_price!)
          .map((row): VendorQuote => {
            const vendorData = row.vendors as { name: string } | null;
            return {
              vendorId: row.vendor_id,
              vendorName: vendorData?.name ?? "Unknown Vendor",
              unitPrice: row.current_price!,
              updatedAt: row.last_price_update ?? row.updated_at ?? null,
              priceIncludesGst: row.price_includes_gst ?? false,
            };
          });
      },
      { operationName: "useCalculatorVendorQuotes" },
    ),
    staleTime: 5 * 60 * 1000,
  });

  return {
    quotes: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
