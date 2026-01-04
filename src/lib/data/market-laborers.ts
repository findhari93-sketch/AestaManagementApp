import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

type LaborRole = Tables<"labor_roles">;

export type MarketLaborerRole = LaborRole & {
  category_name: string;
};

export interface MarketLaborerRatesPageData {
  marketRoles: MarketLaborerRole[];
}

/**
 * Fetch market laborer roles with their categories for the rate management page.
 * Only returns roles where is_market_role = true.
 */
export async function getMarketLaborerRatesPageData(): Promise<MarketLaborerRatesPageData> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("labor_roles")
    .select(
      `
      *,
      category:labor_categories(name)
    `
    )
    .eq("is_market_role", true)
    .order("display_order");

  if (error) {
    console.error("Error fetching market laborer roles:", error);
    throw error;
  }

  // Transform to flatten category name
  const marketRoles: MarketLaborerRole[] = (data || []).map((role: any) => ({
    ...role,
    category_name: role.category?.name || "Unknown",
  }));

  return { marketRoles };
}
