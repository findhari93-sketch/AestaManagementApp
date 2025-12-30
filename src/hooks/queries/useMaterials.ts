"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  Material,
  MaterialWithDetails,
  MaterialFormData,
  MaterialCategory,
  MaterialCategoryWithChildren,
  MaterialBrand,
  MaterialBrandFormData,
} from "@/types/material.types";

// ============================================
// MATERIAL CATEGORIES
// ============================================

/**
 * Fetch all material categories
 */
export function useMaterialCategories() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.materials.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as MaterialCategory[];
    },
  });
}

/**
 * Fetch material categories as a tree structure
 */
export function useMaterialCategoryTree() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["materials", "categories", "tree"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;

      // Build tree structure
      const categories = data as MaterialCategory[];
      const categoryMap = new Map<string, MaterialCategoryWithChildren>();
      const rootCategories: MaterialCategoryWithChildren[] = [];

      // First pass: create map
      categories.forEach((cat) => {
        categoryMap.set(cat.id, { ...cat, children: [] });
      });

      // Second pass: build tree
      categories.forEach((cat) => {
        const catWithChildren = categoryMap.get(cat.id)!;
        if (cat.parent_id && categoryMap.has(cat.parent_id)) {
          categoryMap.get(cat.parent_id)!.children!.push(catWithChildren);
        } else {
          rootCategories.push(catWithChildren);
        }
      });

      return rootCategories;
    },
  });
}

/**
 * Create a new material category
 */
export function useCreateMaterialCategory() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: Partial<MaterialCategory>) => {
      const { data: result, error } = await (
        supabase.from("material_categories") as any
      )
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials.all });
      queryClient.invalidateQueries({
        queryKey: ["materials", "categories", "tree"],
      });
    },
  });
}

// ============================================
// MATERIALS
// ============================================

/**
 * Fetch all materials with optional category filter
 * Includes parent material info for variants
 */
export function useMaterials(categoryId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: categoryId
      ? [...queryKeys.materials.list(), categoryId]
      : queryKeys.materials.list(),
    queryFn: async () => {
      let query = supabase
        .from("materials")
        .select(
          `
          *,
          category:material_categories(id, name, code),
          brands:material_brands(id, brand_name, is_preferred, quality_rating, is_active),
          parent_material:materials!materials_parent_id_fkey(id, name, code)
        `
        )
        .eq("is_active", true)
        .order("name");

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as MaterialWithDetails[];
    },
  });
}

/**
 * Fetch materials grouped by parent (for hierarchical display)
 * Returns parent materials with variant_count and parent-first sorting
 */
export function useMaterialsGrouped(categoryId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: categoryId
      ? ["materials", "grouped", categoryId]
      : ["materials", "grouped"],
    queryFn: async () => {
      let query = supabase
        .from("materials")
        .select(
          `
          *,
          category:material_categories(id, name, code),
          brands:material_brands(id, brand_name, is_preferred, quality_rating, is_active),
          parent_material:materials!materials_parent_id_fkey(id, name, code)
        `
        )
        .eq("is_active", true);

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const materials = data as unknown as MaterialWithDetails[];

      // Group variants under their parents
      const parentMaterialsMap = new Map<string, MaterialWithDetails>();
      const standalones: MaterialWithDetails[] = [];
      const variantsByParent = new Map<string, MaterialWithDetails[]>();

      // First pass: identify parents and variants
      for (const material of materials) {
        if (material.parent_id) {
          // This is a variant
          const variants = variantsByParent.get(material.parent_id) || [];
          variants.push(material);
          variantsByParent.set(material.parent_id, variants);
        } else {
          // This is a parent or standalone
          parentMaterialsMap.set(material.id, material);
        }
      }

      // Second pass: attach variants to parents and identify standalones
      for (const [id, material] of parentMaterialsMap) {
        const variants = variantsByParent.get(id);
        if (variants && variants.length > 0) {
          // This is a parent with variants
          material.variants = variants.sort((a, b) => a.name.localeCompare(b.name));
          material.variant_count = variants.length;
        }
        standalones.push(material);
      }

      // Sort: parents with variants first, then standalones, alphabetically
      return standalones.sort((a, b) => {
        // Sort by whether they have variants (parents with variants first)
        const aHasVariants = (a.variant_count || 0) > 0;
        const bHasVariants = (b.variant_count || 0) > 0;
        if (aHasVariants !== bHasVariants) {
          return aHasVariants ? -1 : 1;
        }
        // Then by name
        return a.name.localeCompare(b.name);
      });
    },
  });
}

/**
 * Fetch parent materials (materials that can have variants)
 * Excludes materials that are already variants
 */
export function useParentMaterials() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["materials", "parents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, name, code, unit, category_id")
        .eq("is_active", true)
        .is("parent_id", null) // Only materials that are not variants
        .order("name");

      if (error) throw error;
      return data as Pick<Material, "id" | "name" | "code" | "unit" | "category_id">[];
    },
  });
}

/**
 * Pagination parameters for server-side pagination
 */
export interface PaginationParams {
  pageIndex: number;
  pageSize: number;
}

/**
 * Paginated result with total count
 */
export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  pageCount: number;
}

/**
 * Fetch materials with server-side pagination
 * Use this for large datasets where client-side pagination is not efficient
 */
export function usePaginatedMaterials(
  pagination: PaginationParams,
  categoryId?: string | null,
  searchTerm?: string
) {
  const supabase = createClient();
  const { pageIndex, pageSize } = pagination;
  const offset = pageIndex * pageSize;

  return useQuery({
    queryKey: ["materials", "paginated", { pageIndex, pageSize, categoryId, searchTerm }],
    queryFn: async (): Promise<PaginatedResult<MaterialWithDetails>> => {
      // First, get total count
      let countQuery = supabase
        .from("materials")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (categoryId) {
        countQuery = countQuery.eq("category_id", categoryId);
      }

      if (searchTerm && searchTerm.length >= 2) {
        countQuery = countQuery.or(
          `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,local_name.ilike.%${searchTerm}%`
        );
      }

      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw countError;

      // Then, get paginated data
      let dataQuery = supabase
        .from("materials")
        .select(
          `
          *,
          category:material_categories(id, name, code),
          brands:material_brands(id, brand_name, is_preferred, quality_rating, is_active)
        `
        )
        .eq("is_active", true)
        .order("name")
        .range(offset, offset + pageSize - 1);

      if (categoryId) {
        dataQuery = dataQuery.eq("category_id", categoryId);
      }

      if (searchTerm && searchTerm.length >= 2) {
        dataQuery = dataQuery.or(
          `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,local_name.ilike.%${searchTerm}%`
        );
      }

      const { data, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      return {
        data: data as MaterialWithDetails[],
        totalCount: totalCount || 0,
        pageCount: Math.ceil((totalCount || 0) / pageSize),
      };
    },
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}

/**
 * Fetch a single material by ID
 */
export function useMaterial(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: id
      ? queryKeys.materials.byId(id)
      : [...queryKeys.materials.all, "unknown"],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("materials")
        .select(
          `
          *,
          category:material_categories(id, name, code),
          brands:material_brands(id, brand_name, is_preferred, quality_rating, notes, is_active),
          parent_material:materials!materials_parent_id_fkey(id, name, code)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as MaterialWithDetails;
    },
    enabled: !!id,
  });
}

/**
 * Search materials by name or code
 */
export function useMaterialSearch(searchTerm: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["materials", "search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from("materials")
        .select(
          `
          id, name, code, unit, reorder_level,
          category:material_categories(id, name)
        `
        )
        .eq("is_active", true)
        .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: searchTerm.length >= 2,
  });
}

/**
 * Create a new material
 */
/**
 * Generate a material code from the name
 * Format: First 3 letters (uppercase) + 4-digit sequence
 * Example: CEM-0001 for Cement, STL-0001 for Steel
 */
async function generateMaterialCode(
  supabase: ReturnType<typeof createClient>,
  name: string
): Promise<string> {
  // Get prefix from name (first 3 letters, uppercase)
  const prefix = name
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  // Get count of materials with same prefix
  const { count } = await (supabase as any)
    .from("materials")
    .select("*", { count: "exact", head: true })
    .ilike("code", `${prefix}-%`);

  const sequence = ((count || 0) + 1).toString().padStart(4, "0");
  return `${prefix}-${sequence}`;
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: MaterialFormData) => {
      // Auto-generate code if not provided
      let code = data.code?.trim() || null;
      if (!code) {
        code = await generateMaterialCode(supabase, data.name);
      }

      // Clean data: convert empty strings to null for UUID fields
      const cleanData = {
        ...data,
        code,
        local_name: data.local_name?.trim() || null,
        category_id: data.category_id?.trim() || null,
        parent_id: data.parent_id?.trim() || null,
        description: data.description?.trim() || null,
        hsn_code: data.hsn_code?.trim() || null,
      };

      const { data: result, error } = await (supabase.from("materials") as any)
        .insert(cleanData)
        .select()
        .single();

      if (error) throw error;
      return result as Material;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

/**
 * Update an existing material
 */
export function useUpdateMaterial() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<MaterialFormData>;
    }) => {
      // Clean data: convert empty strings to null for UUID/optional fields
      const cleanData: Record<string, unknown> = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      // Only clean fields that are present in the update
      if ("code" in data) cleanData.code = data.code?.trim() || null;
      if ("local_name" in data) cleanData.local_name = data.local_name?.trim() || null;
      if ("category_id" in data) cleanData.category_id = data.category_id?.trim() || null;
      if ("parent_id" in data) cleanData.parent_id = data.parent_id?.trim() || null;
      if ("description" in data) cleanData.description = data.description?.trim() || null;
      if ("hsn_code" in data) cleanData.hsn_code = data.hsn_code?.trim() || null;

      const { data: result, error } = await (supabase.from("materials") as any)
        .update(cleanData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as Material;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["material", variables.id] });
    },
  });
}

/**
 * Delete (soft delete) a material
 */
export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("materials")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

// ============================================
// MATERIAL BRANDS
// ============================================

/**
 * Fetch brands for a material
 */
export function useMaterialBrands(materialId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["materialBrands", materialId],
    queryFn: async () => {
      if (!materialId) return [];

      const { data, error } = await supabase
        .from("material_brands")
        .select("*")
        .eq("material_id", materialId)
        .eq("is_active", true)
        .order("brand_name");

      if (error) throw error;
      return data as MaterialBrand[];
    },
    enabled: !!materialId,
  });
}

/**
 * Create a new material brand
 */
export function useCreateMaterialBrand() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: MaterialBrandFormData) => {
      const { data: result, error } = await supabase
        .from("material_brands")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as MaterialBrand;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["materialBrands", variables.material_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["material", variables.material_id],
      });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

/**
 * Update a material brand
 */
export function useUpdateMaterialBrand() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<MaterialBrandFormData>;
    }) => {
      const { data: result, error } = await supabase
        .from("material_brands")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as MaterialBrand;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["materialBrands", result.material_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["material", result.material_id],
      });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

/**
 * Delete a material brand
 */
export function useDeleteMaterialBrand() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      materialId,
    }: {
      id: string;
      materialId: string;
    }) => {
      const { error } = await supabase
        .from("material_brands")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      return { id, materialId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["materialBrands", result.materialId],
      });
      queryClient.invalidateQueries({
        queryKey: ["material", result.materialId],
      });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}
