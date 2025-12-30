"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/cache/keys";
import type {
  Vendor,
  VendorWithCategories,
  VendorFormData,
  MaterialCategory,
  VendorType,
} from "@/types/material.types";

// ============================================
// VENDORS
// ============================================

/**
 * Fetch all vendors with optional category filter
 */
export function useVendors(categoryId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: categoryId
      ? [...queryKeys.vendors.list(), categoryId]
      : queryKeys.vendors.list(),
    queryFn: async () => {
      let query = supabase
        .from("vendors")
        .select(
          `
          *,
          vendor_material_categories(
            category_id,
            is_primary,
            category:material_categories(id, name, code)
          )
        `
        )
        .eq("is_active", true)
        .order("name");

      const { data, error } = await query;
      if (error) throw error;

      // Transform to include categories array
      const vendors = data.map((v: any) => ({
        ...v,
        categories:
          v.vendor_material_categories?.map((vc: any) => vc.category) || [],
      })) as VendorWithCategories[];

      // Filter by category if specified
      if (categoryId) {
        return vendors.filter((v) =>
          v.categories?.some((c) => c?.id === categoryId)
        );
      }

      return vendors;
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
 * Fetch vendors with server-side pagination
 * Use this for large datasets where client-side pagination is not efficient
 */
export function usePaginatedVendors(
  pagination: PaginationParams,
  categoryId?: string | null,
  searchTerm?: string,
  vendorType?: VendorType
) {
  const supabase = createClient();
  const { pageIndex, pageSize } = pagination;
  const offset = pageIndex * pageSize;

  return useQuery({
    queryKey: ["vendors", "paginated", { pageIndex, pageSize, categoryId, searchTerm, vendorType }],
    queryFn: async (): Promise<PaginatedResult<VendorWithCategories>> => {
      // First, get total count
      let countQuery = supabase
        .from("vendors")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (vendorType) {
        countQuery = countQuery.eq("vendor_type", vendorType);
      }

      if (searchTerm && searchTerm.length >= 2) {
        countQuery = countQuery.or(
          `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`
        );
      }

      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw countError;

      // Then, get paginated data
      let dataQuery = supabase
        .from("vendors")
        .select(
          `
          *,
          vendor_material_categories(
            category_id,
            is_primary,
            category:material_categories(id, name, code)
          )
        `
        )
        .eq("is_active", true)
        .order("name")
        .range(offset, offset + pageSize - 1);

      if (vendorType) {
        dataQuery = dataQuery.eq("vendor_type", vendorType);
      }

      if (searchTerm && searchTerm.length >= 2) {
        dataQuery = dataQuery.or(
          `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`
        );
      }

      const { data, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      // Transform to include categories array
      let vendors = data.map((v: any) => ({
        ...v,
        categories:
          v.vendor_material_categories?.map((vc: any) => vc.category) || [],
      })) as VendorWithCategories[];

      // Filter by category if specified (done in-memory for simplicity)
      if (categoryId) {
        vendors = vendors.filter((v) =>
          v.categories?.some((c) => c?.id === categoryId)
        );
      }

      return {
        data: vendors,
        totalCount: totalCount || 0,
        pageCount: Math.ceil((totalCount || 0) / pageSize),
      };
    },
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}

/**
 * Fetch a single vendor by ID
 */
export function useVendor(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: id
      ? queryKeys.vendors.byId(id)
      : [...queryKeys.vendors.all, "detail"],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("vendors")
        .select(
          `
          *,
          vendor_material_categories(
            category_id,
            is_primary,
            category:material_categories(id, name, code)
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      return {
        ...data,
        categories:
          data.vendor_material_categories?.map((vc: any) => vc.category) || [],
      } as unknown as VendorWithCategories;
    },
    enabled: !!id,
  });
}

/**
 * Search vendors by name
 */
export function useVendorSearch(searchTerm: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["vendorSearch", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, code, phone, city")
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
 * Generate a vendor code based on vendor type
 * Format: Type prefix + 4-digit sequence
 * Example: SHP-0001 for Shop, DLR-0001 for Dealer
 */
async function generateVendorCode(
  supabase: ReturnType<typeof createClient>,
  vendorType?: string
): Promise<string> {
  // Get prefix based on vendor type
  const prefixMap: Record<string, string> = {
    shop: "SHP",
    dealer: "DLR",
    manufacturer: "MFR",
    individual: "IND",
  };
  const prefix = prefixMap[vendorType || ""] || "VEN";

  // Get count of vendors with same prefix
  const { count } = await supabase
    .from("vendors")
    .select("*", { count: "exact", head: true })
    .ilike("code", `${prefix}-%`);

  const sequence = ((count || 0) + 1).toString().padStart(4, "0");
  return `${prefix}-${sequence}`;
}

/**
 * Create a new vendor
 */
export function useCreateVendor() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: VendorFormData) => {
      const { category_ids, ...vendorData } = data;

      // Auto-generate code if not provided
      let code = vendorData.code?.trim() || null;
      if (!code) {
        code = await generateVendorCode(supabase, vendorData.vendor_type);
      }

      // Create vendor with auto-generated code
      const { data: vendor, error } = await supabase
        .from("vendors")
        .insert({ ...vendorData, code })
        .select()
        .single();

      if (error) throw error;

      // Add category associations
      if (category_ids && category_ids.length > 0) {
        const categoryAssociations = category_ids.map((catId, index) => ({
          vendor_id: vendor.id,
          category_id: catId,
          is_primary: index === 0, // First one is primary
        }));

        const { error: catError } = await supabase
          .from("vendor_material_categories")
          .insert(categoryAssociations);

        if (catError) console.error("Failed to add categories:", catError);
      }

      return vendor as Vendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.list() });
    },
  });
}

/**
 * Update an existing vendor
 */
export function useUpdateVendor() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<VendorFormData>;
    }) => {
      const { category_ids, ...vendorData } = data;

      // Update vendor
      const { data: vendor, error } = await supabase
        .from("vendors")
        .update({ ...vendorData, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Update category associations if provided
      if (category_ids !== undefined) {
        // Delete existing
        await supabase
          .from("vendor_material_categories")
          .delete()
          .eq("vendor_id", id);

        // Add new
        if (category_ids.length > 0) {
          const categoryAssociations = category_ids.map((catId, index) => ({
            vendor_id: id,
            category_id: catId,
            is_primary: index === 0,
          }));

          await supabase
            .from("vendor_material_categories")
            .insert(categoryAssociations);
        }
      }

      return vendor as Vendor;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.list() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.byId(variables.id),
      });
    },
  });
}

/**
 * Delete (soft delete) a vendor
 */
export function useDeleteVendor() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vendors")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.list() });
    },
  });
}
