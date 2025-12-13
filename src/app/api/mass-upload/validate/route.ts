import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canPerformMassUpload } from "@/lib/permissions";
import {
  MassUploadTableName,
  ValidateRequest,
  ValidateResponse,
  ParsedRow,
  ValidationError,
  LookupCache,
} from "@/types/mass-upload.types";
import { getTableConfig } from "@/lib/mass-upload/tableConfigs";
import { validateField } from "@/lib/mass-upload/validators";

/**
 * Verify mass upload access
 */
async function verifyMassUploadAccess(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      error: "You must be logged in to perform this action.",
      user: null,
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("auth_id", user.id)
    .single();

  const userProfile = profile as { role: string; name: string } | null;

  if (!userProfile || !canPerformMassUpload(userProfile.role)) {
    return {
      authorized: false,
      error: "Only Admin and Office staff can perform mass uploads.",
      user: null,
    };
  }

  return { authorized: true, error: null, user, userProfile };
}

/**
 * Build lookup cache for resolving names to UUIDs
 */
async function buildLookupCache(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string
): Promise<LookupCache> {
  const cache: LookupCache = {
    laborers: new Map(),
    categories: new Map(),
    roles: new Map(),
    sections: new Map(),
    teams: new Map(),
    teaShops: new Map(),
    expenseCategories: new Map(),
  };

  // Fetch laborers (active ones, optionally filtered by site assignments)
  const { data: laborers } = await supabase
    .from("laborers")
    .select("id, name, phone")
    .eq("status", "active");

  if (laborers) {
    laborers.forEach((l) => {
      // Index by name (lowercase for case-insensitive matching)
      if (l.name) {
        cache.laborers.set(l.name.toLowerCase(), {
          id: l.id,
          name: l.name,
          phone: l.phone,
        });
      }
      // Also index by phone if available
      if (l.phone) {
        cache.laborers.set(l.phone, {
          id: l.id,
          name: l.name,
          phone: l.phone,
        });
      }
    });
  }

  // Fetch labor categories
  const { data: categories } = await supabase
    .from("labor_categories")
    .select("id, name")
    .eq("is_active", true);

  if (categories) {
    categories.forEach((c) => {
      if (c.name) {
        cache.categories.set(c.name.toLowerCase(), { id: c.id, name: c.name });
      }
    });
  }

  // Fetch labor roles
  const { data: roles } = await supabase
    .from("labor_roles")
    .select("id, name")
    .eq("is_active", true);

  if (roles) {
    roles.forEach((r) => {
      if (r.name) {
        cache.roles.set(r.name.toLowerCase(), { id: r.id, name: r.name });
      }
    });
  }

  // Fetch building sections for the site
  const { data: sections } = await supabase
    .from("building_sections")
    .select("id, name")
    .eq("site_id", siteId);

  if (sections) {
    sections.forEach((s) => {
      if (s.name) {
        cache.sections.set(s.name.toLowerCase(), { id: s.id, name: s.name });
      }
    });
  }

  // Fetch teams
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("status", "active");

  if (teams) {
    teams.forEach((t) => {
      if (t.name) {
        cache.teams.set(t.name.toLowerCase(), { id: t.id, name: t.name });
      }
    });
  }

  // Fetch tea shops for the site
  const { data: teaShops } = await supabase
    .from("tea_shop_accounts")
    .select("id, shop_name")
    .eq("site_id", siteId)
    .eq("is_active", true);

  if (teaShops) {
    teaShops.forEach((ts) => {
      if (ts.shop_name) {
        cache.teaShops.set(ts.shop_name.toLowerCase(), {
          id: ts.id,
          name: ts.shop_name,
        });
      }
    });
  }

  // Fetch expense categories
  const { data: expenseCategories } = await supabase
    .from("expense_categories")
    .select("id, name")
    .eq("is_active", true);

  if (expenseCategories) {
    expenseCategories.forEach((ec) => {
      if (ec.name) {
        cache.expenseCategories.set(ec.name.toLowerCase(), {
          id: ec.id,
          name: ec.name,
        });
      }
    });
  }

  return cache;
}

/**
 * Resolve lookup field to UUID
 */
function resolveLookup(
  value: string,
  lookupTable: string,
  cache: LookupCache
): { id: string | null; suggestion?: string } {
  if (!value) return { id: null };

  const lowerValue = value.toLowerCase();

  switch (lookupTable) {
    case "laborers":
      const laborer = cache.laborers.get(lowerValue);
      if (laborer) return { id: laborer.id };
      // Try fuzzy match for suggestions
      const laborerSuggestion = findSimilar(lowerValue, cache.laborers);
      return { id: null, suggestion: laborerSuggestion };

    case "labor_categories":
      const category = cache.categories.get(lowerValue);
      if (category) return { id: category.id };
      return { id: null, suggestion: findSimilar(lowerValue, cache.categories) };

    case "labor_roles":
      const role = cache.roles.get(lowerValue);
      if (role) return { id: role.id };
      return { id: null, suggestion: findSimilar(lowerValue, cache.roles) };

    case "building_sections":
      const section = cache.sections.get(lowerValue);
      if (section) return { id: section.id };
      return { id: null, suggestion: findSimilar(lowerValue, cache.sections) };

    case "teams":
      const team = cache.teams.get(lowerValue);
      if (team) return { id: team.id };
      return { id: null, suggestion: findSimilar(lowerValue, cache.teams) };

    case "tea_shop_accounts":
      const teaShop = cache.teaShops.get(lowerValue);
      if (teaShop) return { id: teaShop.id };
      return { id: null, suggestion: findSimilar(lowerValue, cache.teaShops) };

    case "expense_categories":
      const expCat = cache.expenseCategories.get(lowerValue);
      if (expCat) return { id: expCat.id };
      return { id: null, suggestion: findSimilar(lowerValue, cache.expenseCategories) };

    default:
      return { id: null };
  }
}

/**
 * Find similar value from cache for suggestions
 */
function findSimilar(
  value: string,
  cache: Map<string, { id: string; name: string }>
): string | undefined {
  // Simple substring match for suggestions
  for (const [key, entry] of cache.entries()) {
    if (key.includes(value) || value.includes(key)) {
      return entry.name;
    }
  }
  return undefined;
}

/**
 * POST /api/mass-upload/validate
 * Validates CSV data including server-side lookups
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify access
    const { authorized, error: authError } = await verifyMassUploadAccess(supabase);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: authError },
        { status: 403 }
      );
    }

    const body: ValidateRequest = await request.json();
    const { tableName, siteId, rows } = body;

    if (!tableName || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { success: false, error: "Table name and rows are required" },
        { status: 400 }
      );
    }

    const config = getTableConfig(tableName);
    if (!config || config.fields.length === 0) {
      return NextResponse.json(
        { success: false, error: `No configuration found for table: ${tableName}` },
        { status: 400 }
      );
    }

    // Build lookup cache
    const cache = await buildLookupCache(supabase, siteId || "");

    // Validate each row with server-side lookups
    const parsedRows: ParsedRow[] = [];
    const lookupErrors: ValidationError[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];
      const transformedData: Record<string, unknown> = {};

      config.fields.forEach((fieldConfig) => {
        const csvValue = row[fieldConfig.csvHeader];
        const trimmedValue = csvValue?.trim() || "";

        // First, do client-side validation
        const clientValidation = validateField(trimmedValue, fieldConfig, rowNumber);

        if (clientValidation.error) {
          errors.push(clientValidation.error);
        }

        // For lookup fields, resolve to UUID
        if (fieldConfig.type === "uuid_lookup" && trimmedValue) {
          const lookupResult = resolveLookup(
            trimmedValue,
            fieldConfig.lookupTable || "",
            cache
          );

          if (!lookupResult.id) {
            const error: ValidationError = {
              rowNumber,
              field: fieldConfig.dbField,
              csvHeader: fieldConfig.csvHeader,
              value: trimmedValue,
              errorType: "lookup",
              message: `${fieldConfig.lookupDisplayField || fieldConfig.csvHeader} not found: "${trimmedValue}"`,
              suggestion: lookupResult.suggestion
                ? `Did you mean "${lookupResult.suggestion}"?`
                : undefined,
            };
            errors.push(error);
            lookupErrors.push(error);
            transformedData[fieldConfig.dbField] = null;
          } else {
            transformedData[fieldConfig.dbField] = lookupResult.id;
          }
        } else {
          transformedData[fieldConfig.dbField] = clientValidation.transformedValue;
        }
      });

      // Determine row status
      let status: "valid" | "warning" | "error" = "valid";
      if (errors.length > 0) {
        status = "error";
      } else if (warnings.length > 0) {
        status = "warning";
      }

      parsedRows.push({
        rowNumber,
        originalData: row,
        transformedData,
        errors,
        warnings,
        status,
      });
    });

    const response: ValidateResponse = {
      success: true,
      parsedRows,
      lookupErrors,
      summary: {
        total: parsedRows.length,
        valid: parsedRows.filter((r) => r.status === "valid").length,
        warnings: parsedRows.filter((r) => r.status === "warning").length,
        errors: parsedRows.filter((r) => r.status === "error").length,
      },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Validation error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
