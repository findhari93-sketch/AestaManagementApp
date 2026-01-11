"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createClient, ensureFreshSession } from "@/lib/supabase/client";
import type {
  RentalItem,
  RentalItemWithDetails,
  RentalItemFormData,
  RentalItemCategory,
  RentalOrder,
  RentalOrderWithDetails,
  RentalOrderFormData,
  RentalOrderFilterState,
  RentalStoreInventory,
  RentalStoreInventoryWithDetails,
  RentalStoreInventoryFormData,
  RentalReturnFormData,
  RentalAdvanceFormData,
  RentalSettlementFormData,
  RentalCostCalculation,
  RentalItemCostBreakdown,
  RentalPriceComparisonResult,
  RentalPriceHistory,
  RentalSummary,
  RentalType,
} from "@/types/rental.types";

// ============================================
// QUERY KEYS
// ============================================

export const rentalQueryKeys = {
  all: ["rentals"] as const,
  items: {
    all: ["rentals", "items"] as const,
    list: () => [...rentalQueryKeys.items.all, "list"] as const,
    byId: (id: string) => [...rentalQueryKeys.items.all, id] as const,
    byCategory: (categoryId: string) =>
      [...rentalQueryKeys.items.all, "category", categoryId] as const,
    search: (term: string) =>
      [...rentalQueryKeys.items.all, "search", term] as const,
  },
  categories: {
    all: ["rentals", "categories"] as const,
    tree: ["rentals", "categories", "tree"] as const,
  },
  orders: {
    all: ["rentals", "orders"] as const,
    list: () => [...rentalQueryKeys.orders.all, "list"] as const,
    byId: (id: string) => [...rentalQueryKeys.orders.all, id] as const,
    bySite: (siteId: string) =>
      [...rentalQueryKeys.orders.all, "site", siteId] as const,
    ongoing: (siteId: string) =>
      [...rentalQueryKeys.orders.all, "ongoing", siteId] as const,
    overdue: (siteId: string) =>
      [...rentalQueryKeys.orders.all, "overdue", siteId] as const,
  },
  storeInventory: {
    all: ["rentals", "storeInventory"] as const,
    byVendor: (vendorId: string) =>
      [...rentalQueryKeys.storeInventory.all, "vendor", vendorId] as const,
    byItem: (itemId: string) =>
      [...rentalQueryKeys.storeInventory.all, "item", itemId] as const,
  },
  priceComparison: (itemId: string) =>
    ["rentals", "priceComparison", itemId] as const,
  priceHistory: (itemId: string, vendorId?: string) =>
    ["rentals", "priceHistory", itemId, vendorId] as const,
  summary: (siteId: string) => ["rentals", "summary", siteId] as const,
};

// ============================================
// RENTAL ITEM CATEGORIES
// ============================================

export function useRentalCategories() {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.categories.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_item_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as RentalItemCategory[];
    },
  });
}

export function useCreateRentalCategory() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: Partial<RentalItemCategory>) => {
      await ensureFreshSession();

      const { data: result, error } = await supabase
        .from("rental_item_categories")
        .insert(data as never)
        .select()
        .single();

      if (error) throw error;
      return result as RentalItemCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.categories.all });
    },
  });
}

// ============================================
// RENTAL ITEMS
// ============================================

export function useRentalItems(categoryId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: categoryId
      ? rentalQueryKeys.items.byCategory(categoryId)
      : rentalQueryKeys.items.list(),
    queryFn: async () => {
      let query = supabase
        .from("rental_items")
        .select(
          `
          *,
          category:rental_item_categories(id, name, code)
        `
        )
        .eq("is_active", true)
        .order("name");

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RentalItemWithDetails[];
    },
  });
}

/**
 * Pagination parameters
 */
export interface RentalPaginationParams {
  pageIndex: number;
  pageSize: number;
}

/**
 * Paginated result
 */
export interface RentalPaginatedResult<T> {
  data: T[];
  totalCount: number;
  pageCount: number;
}

/**
 * Fetch rental items with server-side pagination
 */
export function usePaginatedRentalItems(
  pagination: RentalPaginationParams,
  rentalType?: RentalType | "all" | null,
  searchTerm?: string,
  sortBy: "alphabetical" | "recently_added" | "by_rate" = "alphabetical"
) {
  const supabase = createClient();
  const { pageIndex, pageSize } = pagination;
  const offset = pageIndex * pageSize;

  return useQuery({
    queryKey: ["rentals", "items", "paginated", { pageIndex, pageSize, rentalType, searchTerm, sortBy }],
    queryFn: async (): Promise<RentalPaginatedResult<RentalItemWithDetails>> => {
      // Get total count
      let countQuery = supabase
        .from("rental_items")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (rentalType && rentalType !== "all") {
        countQuery = countQuery.eq("rental_type", rentalType);
      }

      if (searchTerm && searchTerm.length >= 2) {
        countQuery = countQuery.or(
          `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,local_name.ilike.%${searchTerm}%`
        );
      }

      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw countError;

      // Get paginated data
      let dataQuery = supabase
        .from("rental_items")
        .select(
          `
          *,
          category:rental_item_categories(id, name, code)
        `
        )
        .eq("is_active", true);

      // Apply sorting
      switch (sortBy) {
        case "recently_added":
          dataQuery = dataQuery.order("created_at", { ascending: false });
          break;
        case "by_rate":
          dataQuery = dataQuery.order("daily_rate", { ascending: true });
          break;
        default:
          dataQuery = dataQuery.order("name", { ascending: true });
      }

      dataQuery = dataQuery.range(offset, offset + pageSize - 1);

      if (rentalType && rentalType !== "all") {
        dataQuery = dataQuery.eq("rental_type", rentalType);
      }

      if (searchTerm && searchTerm.length >= 2) {
        dataQuery = dataQuery.or(
          `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,local_name.ilike.%${searchTerm}%`
        );
      }

      const { data, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      return {
        data: data as RentalItemWithDetails[],
        totalCount: totalCount || 0,
        pageCount: Math.ceil((totalCount || 0) / pageSize),
      };
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useRentalItem(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.items.byId(id || ""),
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("rental_items")
        .select(
          `
          *,
          category:rental_item_categories(id, name, code)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as RentalItemWithDetails;
    },
    enabled: !!id,
  });
}

export function useRentalItemSearch(searchTerm: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.items.search(searchTerm),
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from("rental_items")
        .select(
          `
          *,
          category:rental_item_categories(id, name, code)
        `
        )
        .eq("is_active", true)
        .or(
          `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,local_name.ilike.%${searchTerm}%`
        )
        .order("name")
        .limit(20);

      if (error) throw error;
      return data as RentalItemWithDetails[];
    },
    enabled: searchTerm.length >= 2,
  });
}

export function useCreateRentalItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: RentalItemFormData) => {
      await ensureFreshSession();

      // Generate code if not provided
      if (!data.code) {
        const prefix =
          data.rental_type === "equipment"
            ? "EQP"
            : data.rental_type === "scaffolding"
              ? "SCF"
              : data.rental_type === "shuttering"
                ? "SHT"
                : "OTH";

        const { count } = await supabase
          .from("rental_items")
          .select("*", { count: "exact", head: true })
          .ilike("code", `${prefix}-%`);

        data.code = `${prefix}-${String((count || 0) + 1).padStart(4, "0")}`;
      }

      const { data: result, error } = await supabase
        .from("rental_items")
        .insert(data as never)
        .select()
        .single();

      if (error) throw error;
      return result as RentalItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.items.all });
    },
  });
}

export function useUpdateRentalItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<RentalItemFormData>;
    }) => {
      await ensureFreshSession();

      const { data: result, error } = await supabase
        .from("rental_items")
        .update(data as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as RentalItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.items.all });
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.items.byId(variables.id),
      });
    },
  });
}

export function useDeleteRentalItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await ensureFreshSession();

      // Soft delete
      const { error } = await supabase
        .from("rental_items")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.items.all });
    },
  });
}

// ============================================
// RENTAL ORDERS
// ============================================

export function useRentalOrders(
  siteId: string,
  filters?: RentalOrderFilterState
) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...rentalQueryKeys.orders.bySite(siteId), filters],
    queryFn: async () => {
      let query = supabase
        .from("rental_orders")
        .select(
          `
          *,
          vendor:vendors(id, name, phone, address, shop_name),
          site:sites(id, name),
          items:rental_order_items(
            *,
            rental_item:rental_items(id, name, code, rental_type, unit)
          ),
          advances:rental_advances(*),
          settlement:rental_settlements(*)
        `
        )
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.vendorId) {
        query = query.eq("vendor_id", filters.vendorId);
      }
      if (filters?.dateFrom) {
        query = query.gte("start_date", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("start_date", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate accrued costs and overdue status
      return (data || []).map((order) => {
        const now = new Date();
        const startDate = new Date(order.start_date);
        const daysSinceStart = Math.max(
          0,
          Math.ceil(
            (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        const expectedReturnDate = order.expected_return_date
          ? new Date(order.expected_return_date)
          : null;
        const isOverdue = expectedReturnDate
          ? now > expectedReturnDate && order.status !== "completed"
          : false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accruedRentalCost = (order.items || []).reduce(
          (sum: number, item: any) => {
            const itemDays = item.item_start_date
              ? Math.max(
                  1,
                  Math.ceil(
                    (now.getTime() - new Date(item.item_start_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                )
              : daysSinceStart || 1;
            return (
              sum + (item.quantity_outstanding || 0) * item.daily_rate_actual * itemDays
            );
          },
          0
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalAdvancePaid = (order.advances || []).reduce(
          (sum: number, adv: any) => sum + adv.amount,
          0
        );

        return {
          ...order,
          accrued_rental_cost: accruedRentalCost,
          total_advance_paid: totalAdvancePaid,
          days_since_start: daysSinceStart,
          is_overdue: isOverdue,
        } as RentalOrderWithDetails;
      });
    },
    enabled: !!siteId,
  });
}

export function useOngoingRentals(siteId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.orders.ongoing(siteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_orders")
        .select(
          `
          *,
          vendor:vendors(id, name, phone, shop_name),
          items:rental_order_items(
            *,
            rental_item:rental_items(id, name, unit)
          ),
          advances:rental_advances(amount)
        `
        )
        .eq("site_id", siteId)
        .in("status", ["confirmed", "active", "partially_returned"])
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Calculate costs for each order
      const now = new Date();
      return (data || []).map((order) => {
        const startDate = new Date(order.start_date);
        const daysSinceStart = Math.max(
          1,
          Math.ceil(
            (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        const expectedReturnDate = order.expected_return_date
          ? new Date(order.expected_return_date)
          : null;
        const isOverdue = expectedReturnDate ? now > expectedReturnDate : false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accruedRentalCost = (order.items || []).reduce(
          (sum: number, item: any) => {
            const itemDays = item.item_start_date
              ? Math.max(
                  1,
                  Math.ceil(
                    (now.getTime() - new Date(item.item_start_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                )
              : daysSinceStart;
            return (
              sum + (item.quantity_outstanding || 0) * item.daily_rate_actual * itemDays
            );
          },
          0
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalAdvancePaid = (order.advances || []).reduce(
          (sum: number, adv: any) => sum + (adv.amount || 0),
          0
        );

        return {
          ...order,
          accrued_rental_cost: accruedRentalCost,
          total_advance_paid: totalAdvancePaid,
          days_since_start: daysSinceStart,
          is_overdue: isOverdue,
        } as RentalOrderWithDetails;
      });
    },
    enabled: !!siteId,
  });
}

export function useOverdueRentals(siteId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: rentalQueryKeys.orders.overdue(siteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_orders")
        .select(
          `
          *,
          vendor:vendors(id, name, phone, shop_name),
          items:rental_order_items(*),
          advances:rental_advances(amount)
        `
        )
        .eq("site_id", siteId)
        .in("status", ["confirmed", "active", "partially_returned"])
        .lt("expected_return_date", today)
        .order("expected_return_date", { ascending: true });

      if (error) throw error;
      return data as RentalOrderWithDetails[];
    },
    enabled: !!siteId,
  });
}

export function useRentalOrder(id: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.orders.byId(id || ""),
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("rental_orders")
        .select(
          `
          *,
          vendor:vendors(id, name, phone, address, email, shop_name),
          site:sites(id, name),
          items:rental_order_items(
            *,
            rental_item:rental_items(*)
          ),
          advances:rental_advances(*),
          returns:rental_returns(*),
          settlement:rental_settlements(*)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      // Calculate costs
      const now = new Date();
      const startDate = new Date(data.start_date);
      const daysSinceStart = Math.max(
        1,
        Math.ceil(
          (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      const expectedReturnDate = data.expected_return_date
        ? new Date(data.expected_return_date)
        : null;
      const isOverdue = expectedReturnDate
        ? now > expectedReturnDate && data.status !== "completed"
        : false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accruedRentalCost = (data.items || []).reduce(
        (sum: number, item: any) => {
          const itemDays = item.item_start_date
            ? Math.max(
                1,
                Math.ceil(
                  (now.getTime() - new Date(item.item_start_date).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              )
            : daysSinceStart;
          return (
            sum + (item.quantity_outstanding || 0) * item.daily_rate_actual * itemDays
          );
        },
        0
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalAdvancePaid = (data.advances || []).reduce(
        (sum: number, adv: any) => sum + (adv.amount || 0),
        0
      );

      return {
        ...data,
        accrued_rental_cost: accruedRentalCost,
        total_advance_paid: totalAdvancePaid,
        days_since_start: daysSinceStart,
        is_overdue: isOverdue,
      } as RentalOrderWithDetails;
    },
    enabled: !!id,
  });
}

export function useCreateRentalOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: RentalOrderFormData) => {
      await ensureFreshSession();

      // Generate order number
      const { data: orderNumber, error: numError } = await supabase.rpc(
        "generate_rental_order_number",
        {
          p_site_id: data.site_id,
        }
      );

      if (numError) throw numError;

      const { items, ...orderData } = data;

      // Calculate estimated total
      const estimatedTotal = items.reduce((sum, item) => {
        const days = data.expected_return_date
          ? Math.max(
              1,
              Math.ceil(
                (new Date(data.expected_return_date).getTime() -
                  new Date(data.start_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 30;
        return sum + item.quantity * item.daily_rate_actual * days;
      }, 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("rental_orders")
        .insert({
          ...orderData,
          rental_order_number: orderNumber,
          status: "draft",
          estimated_total: estimatedTotal,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create items
      if (items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          ...item,
          rental_order_id: order.id,
        }));

        const { error: itemsError } = await supabase
          .from("rental_order_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return order as RentalOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.orders.all });
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.orders.bySite(data.site_id),
      });
    },
  });
}

export function useUpdateRentalOrderStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: RentalOrder["status"];
    }) => {
      await ensureFreshSession();

      const { data, error } = await supabase
        .from("rental_orders")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as RentalOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.orders.byId(data.id),
      });
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.orders.all });
    },
  });
}

export function useCancelRentalOrder() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      reason,
    }: {
      id: string;
      reason: string;
    }) => {
      await ensureFreshSession();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("rental_orders")
        .update({
          status: "cancelled",
          cancelled_by: user?.id,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as RentalOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.orders.byId(data.id),
      });
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.orders.all });
    },
  });
}

// ============================================
// RENTAL RETURNS
// ============================================

export function useRecordRentalReturn() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: RentalReturnFormData) => {
      await ensureFreshSession();

      // Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from("rental_returns")
        .insert(data)
        .select()
        .single();

      if (returnError) throw returnError;

      // Get current item
      const { data: item } = await supabase
        .from("rental_order_items")
        .select("quantity, quantity_returned")
        .eq("id", data.rental_order_item_id)
        .single();

      if (item) {
        const newQuantityReturned =
          (item.quantity_returned || 0) + data.quantity_returned;
        const newStatus =
          newQuantityReturned >= item.quantity
            ? "returned"
            : "partially_returned";

        await supabase
          .from("rental_order_items")
          .update({
            quantity_returned: newQuantityReturned,
            status: newStatus,
          })
          .eq("id", data.rental_order_item_id);
      }

      // Update order status if all items returned
      const { data: orderItems } = await supabase
        .from("rental_order_items")
        .select("quantity, quantity_returned")
        .eq("rental_order_id", data.rental_order_id);

      if (orderItems) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allReturned = orderItems.every(
          (i: any) => (i.quantity_returned || 0) >= i.quantity
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partiallyReturned = orderItems.some(
          (i: any) => (i.quantity_returned || 0) > 0
        );

        let newOrderStatus: RentalOrder["status"] = "active";
        if (allReturned) {
          newOrderStatus = "completed";
        } else if (partiallyReturned) {
          newOrderStatus = "partially_returned";
        }

        await supabase
          .from("rental_orders")
          .update({ status: newOrderStatus })
          .eq("id", data.rental_order_id);
      }

      return returnRecord;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.orders.byId(variables.rental_order_id),
      });
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.orders.all });
    },
  });
}

// ============================================
// RENTAL ADVANCES
// ============================================

export function useRecordRentalAdvance() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: RentalAdvanceFormData) => {
      await ensureFreshSession();

      const { data: advance, error } = await supabase
        .from("rental_advances")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return advance;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.orders.byId(variables.rental_order_id),
      });
    },
  });
}

// ============================================
// RENTAL SETTLEMENTS
// ============================================

export function useSettleRental() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: RentalSettlementFormData) => {
      await ensureFreshSession();

      // Get site_id for reference generation
      const { data: order } = await supabase
        .from("rental_orders")
        .select("site_id")
        .eq("id", data.rental_order_id)
        .single();

      // Generate settlement reference
      const { data: settRef } = await supabase.rpc(
        "generate_rental_settlement_reference",
        {
          p_site_id: order?.site_id || "",
        }
      );

      const { data: settlement, error } = await supabase
        .from("rental_settlements")
        .insert({
          ...data,
          settlement_reference: settRef,
        })
        .select()
        .single();

      if (error) throw error;

      // Update order status to completed
      await supabase
        .from("rental_orders")
        .update({
          status: "completed",
          actual_total:
            data.negotiated_final_amount || data.total_rental_amount,
          actual_return_date: data.settlement_date,
        })
        .eq("id", data.rental_order_id);

      return settlement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.orders.byId(variables.rental_order_id),
      });
      queryClient.invalidateQueries({ queryKey: rentalQueryKeys.orders.all });
    },
  });
}

// ============================================
// STORE INVENTORY & PRICE COMPARISON
// ============================================

export function useRentalStoreInventory(vendorId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.storeInventory.byVendor(vendorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_store_inventory")
        .select(
          `
          *,
          rental_item:rental_items(*)
        `
        )
        .eq("vendor_id", vendorId)
        .order("created_at");

      if (error) throw error;
      return data as RentalStoreInventoryWithDetails[];
    },
    enabled: !!vendorId,
  });
}

export function useRentalStoresForItem(rentalItemId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.storeInventory.byItem(rentalItemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_store_inventory")
        .select(
          `
          *,
          vendor:vendors(id, name, phone, rating, shop_name)
        `
        )
        .eq("rental_item_id", rentalItemId)
        .order("daily_rate", { ascending: true });

      if (error) throw error;
      return data as RentalStoreInventoryWithDetails[];
    },
    enabled: !!rentalItemId,
  });
}

export function useAddRentalStoreInventory() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: RentalStoreInventoryFormData) => {
      await ensureFreshSession();

      const { data: result, error } = await supabase
        .from("rental_store_inventory")
        .upsert(data, {
          onConflict: "vendor_id,rental_item_id",
        })
        .select()
        .single();

      if (error) throw error;
      return result as RentalStoreInventory;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.storeInventory.byVendor(variables.vendor_id),
      });
      queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.storeInventory.byItem(
          variables.rental_item_id
        ),
      });
    },
  });
}

export function useRentalPriceComparison(rentalItemId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.priceComparison(rentalItemId),
    queryFn: async () => {
      // Get item details
      const { data: item } = await supabase
        .from("rental_items")
        .select("id, name")
        .eq("id", rentalItemId)
        .single();

      // Get store inventory
      const { data: inventory, error } = await supabase
        .from("rental_store_inventory")
        .select(
          `
          *,
          vendor:vendors(id, name, phone, rating, shop_name)
        `
        )
        .eq("rental_item_id", rentalItemId)
        .order("daily_rate", { ascending: true });

      if (error) throw error;

      // Get latest price history for each vendor
      const { data: priceHistory } = await supabase
        .from("rental_price_history")
        .select("vendor_id, daily_rate, recorded_date")
        .eq("rental_item_id", rentalItemId)
        .order("recorded_date", { ascending: false });

      // Build comparison result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vendors = (inventory || []).map((inv: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastHistory = (priceHistory || []).find(
          (ph: any) => ph.vendor_id === inv.vendor_id
        );

        return {
          vendorId: inv.vendor.id,
          vendorName: inv.vendor.name,
          shopName: inv.vendor.shop_name,
          dailyRate: inv.daily_rate,
          weeklyRate: inv.weekly_rate,
          monthlyRate: inv.monthly_rate,
          transportCost: inv.transport_cost || 0,
          rating: inv.vendor.rating,
          lastRentalDate: lastHistory?.recorded_date || null,
        };
      });

      return {
        rentalItemId,
        rentalItemName: item?.name || "",
        vendors,
      } as RentalPriceComparisonResult;
    },
    enabled: !!rentalItemId,
  });
}

export function useRentalPriceHistory(
  rentalItemId: string,
  vendorId?: string
) {
  const supabase = createClient();

  return useQuery({
    queryKey: rentalQueryKeys.priceHistory(rentalItemId, vendorId),
    queryFn: async () => {
      let query = supabase
        .from("rental_price_history")
        .select(
          `
          *,
          vendor:vendors(id, name, shop_name)
        `
        )
        .eq("rental_item_id", rentalItemId)
        .order("recorded_date", { ascending: false })
        .limit(50);

      if (vendorId) {
        query = query.eq("vendor_id", vendorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (RentalPriceHistory & {
        vendor: { id: string; name: string; shop_name: string | null };
      })[];
    },
    enabled: !!rentalItemId,
  });
}

// ============================================
// RENTAL SUMMARY
// ============================================

export function useRentalSummary(siteId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: rentalQueryKeys.summary(siteId),
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("rental_orders")
        .select(
          `
          id,
          status,
          start_date,
          expected_return_date,
          items:rental_order_items(quantity_outstanding, daily_rate_actual, item_start_date),
          advances:rental_advances(amount)
        `
        )
        .eq("site_id", siteId)
        .in("status", ["confirmed", "active", "partially_returned"]);

      if (error) throw error;

      let ongoingCount = 0;
      let overdueCount = 0;
      let totalAccruedCost = 0;
      let totalAdvancesPaid = 0;

      const now = new Date();

      for (const order of orders || []) {
        ongoingCount++;

        if (order.expected_return_date && order.expected_return_date < today) {
          overdueCount++;
        }

        // Sum advances
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        totalAdvancesPaid += (order.advances || []).reduce(
          (sum: number, adv: any) => sum + (adv.amount || 0),
          0
        );

        // Calculate accrued cost
        const startDate = new Date(order.start_date);
        const daysSinceStart = Math.max(
          1,
          Math.ceil(
            (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        totalAccruedCost += (order.items || []).reduce(
          (sum: number, item: any) => {
            const itemDays = item.item_start_date
              ? Math.max(
                  1,
                  Math.ceil(
                    (now.getTime() - new Date(item.item_start_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                )
              : daysSinceStart;
            return (
              sum + (item.quantity_outstanding || 0) * (item.daily_rate_actual || 0) * itemDays
            );
          },
          0
        );
      }

      return {
        ongoingCount,
        overdueCount,
        totalAccruedCost,
        totalAdvancesPaid,
        totalDue: totalAccruedCost - totalAdvancesPaid,
      } as RentalSummary;
    },
    enabled: !!siteId,
  });
}

// ============================================
// COST CALCULATION HOOK
// ============================================

export function useRentalCostCalculation(
  orderId: string | undefined
): RentalCostCalculation | null {
  const { data: order } = useRentalOrder(orderId);

  return useMemo(() => {
    if (!order) return null;

    const now = new Date();
    const startDate = new Date(order.start_date);
    const expectedReturnDate = order.expected_return_date
      ? new Date(order.expected_return_date)
      : null;

    const daysElapsed = Math.max(
      1,
      Math.ceil(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    const expectedTotalDays = expectedReturnDate
      ? Math.ceil(
          (expectedReturnDate.getTime() - startDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : daysElapsed;

    const itemsCost: RentalItemCostBreakdown[] = (order.items || []).map(
      (item) => {
        const itemStartDate = item.item_start_date
          ? new Date(item.item_start_date)
          : startDate;
        const daysRented = Math.max(
          1,
          Math.ceil(
            (now.getTime() - itemStartDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        return {
          itemId: item.id,
          itemName: item.rental_item?.name || "Unknown",
          quantity: item.quantity,
          quantityReturned: item.quantity_returned,
          quantityOutstanding: item.quantity_outstanding,
          dailyRate: item.daily_rate_actual,
          daysRented,
          subtotal: item.quantity_outstanding * item.daily_rate_actual * daysRented,
        };
      }
    );

    const subtotal = itemsCost.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount =
      (subtotal * order.negotiated_discount_percentage) / 100;

    const transportCostOutward =
      order.transport_cost_outward +
      order.loading_cost_outward +
      order.unloading_cost_outward;
    const transportCostReturn =
      order.transport_cost_return +
      order.loading_cost_return +
      order.unloading_cost_return;
    const totalTransportCost = transportCostOutward + transportCostReturn;

    const damagesCost = (order.returns || []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, ret: any) => sum + (ret.damage_cost || 0),
      0
    );

    const grossTotal =
      subtotal - discountAmount + totalTransportCost + damagesCost;
    const advancesPaid = (order.advances || []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, adv: any) => sum + adv.amount,
      0
    );
    const balanceDue = grossTotal - advancesPaid;

    const isOverdue = expectedReturnDate ? now > expectedReturnDate : false;
    const daysOverdue =
      isOverdue && expectedReturnDate
        ? Math.ceil(
            (now.getTime() - expectedReturnDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

    return {
      orderId: order.id,
      startDate: order.start_date,
      currentDate: now.toISOString().split("T")[0],
      expectedReturnDate: order.expected_return_date,
      daysElapsed,
      expectedTotalDays,
      itemsCost,
      subtotal,
      discountAmount,
      transportCostOutward,
      transportCostReturn,
      totalTransportCost,
      damagesCost,
      grossTotal,
      advancesPaid,
      balanceDue,
      isOverdue,
      daysOverdue,
    } as RentalCostCalculation;
  }, [order]);
}

// ============================================
// RENTAL STORES (Vendors filtered by type)
// ============================================

export function useRentalStores() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["vendors", "rental_stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("vendor_type", "rental_store")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}
