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
          brands:material_brands(id, brand_name, is_preferred, quality_rating, is_active)
        `
        )
        .eq("is_active", true)
        .order("name");

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MaterialWithDetails[];
    },
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
          brands:material_brands(id, brand_name, is_preferred, quality_rating, notes, is_active)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as MaterialWithDetails;
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
export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: MaterialFormData) => {
      const { data: result, error } = await (supabase.from("materials") as any)
        .insert(data)
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
      const { data: result, error } = await (supabase.from("materials") as any)
        .update({ ...data, updated_at: new Date().toISOString() })
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
