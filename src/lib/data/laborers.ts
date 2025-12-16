import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

type Laborer = Tables<"laborers">;
type LaborCategory = Tables<"labor_categories">;
type LaborRole = Tables<"labor_roles">;
type Team = Tables<"teams">;

export type LaborerWithDetails = Laborer & {
  category_name: string;
  role_name: string;
  team_name: string | null;
  associated_team_name?: string | null;
};

export interface LaborersPageData {
  laborers: LaborerWithDetails[];
  categories: LaborCategory[];
  roles: LaborRole[];
  teams: Team[];
}

/**
 * Fetch all laborers page data on the server.
 * Note: Laborers are company-wide, not site-specific.
 */
export async function getLaborersPageData(): Promise<LaborersPageData> {
  const supabase = await createClient();

  // Fetch all data in parallel
  const [laborersResult, categoriesResult, rolesResult, teamsResult] =
    await Promise.all([
      supabase
        .from("laborers")
        .select(
          `*, category:labor_categories(name), role:labor_roles(name), team:teams!laborers_team_id_fkey(name), associated_team:teams!laborers_associated_team_id_fkey(name)`
        )
        .order("name"),
      supabase.from("labor_categories").select("*").order("name"),
      supabase.from("labor_roles").select("*").order("name"),
      supabase.from("teams").select("*").eq("status", "active").order("name"),
    ]);

  // Transform laborers to include flattened relation names
  const laborers: LaborerWithDetails[] = (laborersResult.data || []).map(
    (l: any) => ({
      ...l,
      category_name: l.category?.name || "",
      role_name: l.role?.name || "",
      team_name: l.team?.name || null,
      associated_team_name: l.associated_team?.name || null,
    })
  );

  return {
    laborers,
    categories: (categoriesResult.data || []) as LaborCategory[],
    roles: (rolesResult.data || []) as LaborRole[],
    teams: (teamsResult.data || []) as Team[],
  };
}
