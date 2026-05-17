"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type EstimateItem = {
  id: string; // local UUID (crypto.randomUUID())
  materialId: string | null; // null for ad-hoc items not in catalog
  materialName: string;
  categoryCode: string;
  inputs: Record<string, number>;
  units: Record<string, string>;
  computedOutput: number; // e.g. 4.375 (cft)
  outputUnit: string; // e.g. 'cft'
  outputLabel: string; // e.g. 'Gana adi (cft)'
  pricingDimensionValue: string | null; // e.g. '2nd Quality' or brand name
  vendorQuotes: {
    vendorId: string;
    vendorName: string;
    unitPrice: number;
    subtotal: number;
  }[];
  selectedVendorId: string | null;
};

interface EstimateBasketContextType {
  items: EstimateItem[];
  addItem: (item: Omit<EstimateItem, "id">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<EstimateItem>) => void;
  clearBasket: () => void;
  totalItems: number;
}

const EstimateBasketContext = createContext<
  EstimateBasketContextType | undefined
>(undefined);

export function EstimateBasketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<EstimateItem[]>([]);

  const addItem = useCallback((item: Omit<EstimateItem, "id">) => {
    const newItem: EstimateItem = {
      ...item,
      id: crypto.randomUUID(),
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<EstimateItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const clearBasket = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<EstimateBasketContextType>(
    () => ({
      items,
      addItem,
      removeItem,
      updateItem,
      clearBasket,
      totalItems: items.length,
    }),
    [items, addItem, removeItem, updateItem, clearBasket]
  );

  return (
    <EstimateBasketContext.Provider value={value}>
      {children}
    </EstimateBasketContext.Provider>
  );
}

export function useEstimateBasket(): EstimateBasketContextType {
  const ctx = useContext(EstimateBasketContext);
  if (ctx === undefined) {
    throw new Error(
      "useEstimateBasket must be used within an EstimateBasketProvider"
    );
  }
  return ctx;
}
