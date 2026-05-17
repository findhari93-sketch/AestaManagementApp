"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { wrapQueryFn } from "@/lib/utils/timeout";
import type { VendorQuote } from "@/lib/category-calculator-templates";

/**
 * Fetches vendor prices for a given material + optional brand combination,
 * formatted as calculator-ready VendorQuote[].
 *
 * @param materialId - The material to fetch prices for. Pass null to disable the query.
 * @param brandId    - Optional brand_id from material_brands. Pass null to fetch all brands for the material.
 */
export function useCalculatorVendorQuotes(
  materialId: string | null,
  brandId: string | null,
): { quotes: VendorQuote[]; isLoading: boolean; error: Error | null } {
  const supabase = createClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["calculatorQuotes", materialId, brandId],
    enabled: materialId !== null,
    queryFn: wrapQueryFn(
      async () => {
        let query = supabase
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
          .order("current_price", { ascending: true });

        if (brandId !== null) {
          query = query.eq("brand_id", brandId);
        }

        const { data: rows, error: queryError } = await query;

        if (queryError) throw new Error(queryError.message);

        return (rows ?? [])
          .filter((row) => row.current_price !== null)
          .map((row): VendorQuote => {
            const vendorData = row.vendors as { name: string } | null;
            return {
              vendorId: row.vendor_id,
              vendorName: vendorData?.name ?? "Unknown Vendor",
              unitPrice: row.current_price as number,
              updatedAt: row.last_price_update ?? row.updated_at ?? null,
              priceIncludesGst: row.price_includes_gst ?? false,
            };
          });
      },
      { operationName: "useCalculatorVendorQuotes" },
    ),
    staleTime: 5 * 60 * 1000, // 5 minutes — prices don't change frequently
  });

  return {
    quotes: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
