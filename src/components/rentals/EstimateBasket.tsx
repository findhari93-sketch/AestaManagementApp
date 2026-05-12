// src/components/rentals/EstimateBasket.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { EstimateBasketItem } from "@/types/rental.types";

const STORAGE_KEY = "rental_estimate_basket";

interface EstimateBasketContextValue {
  items: EstimateBasketItem[];
  addItem: (item: Omit<EstimateBasketItem, "id">) => void;
  updateItem: (id: string, patch: Partial<Pick<EstimateBasketItem, "quantity" | "days" | "size_label">>) => void;
  removeItem: (id: string) => void;
  clearBasket: () => void;
  itemCount: number;
}

const EstimateBasketContext = createContext<EstimateBasketContextValue | null>(null);

export function EstimateBasketProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<EstimateBasketItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<EstimateBasketItem, "id">) => {
    setItems((prev) => {
      // Replace if same item+size already in basket
      const existing = prev.findIndex(
        (i) => i.rental_item_id === item.rental_item_id && i.size_label === item.size_label
      );
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], ...item };
        return next;
      }
      return [...prev, { ...item, id: crypto.randomUUID() }];
    });
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<Pick<EstimateBasketItem, "quantity" | "days" | "size_label">>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearBasket = useCallback(() => setItems([]), []);

  return (
    <EstimateBasketContext.Provider
      value={{ items, addItem, updateItem, removeItem, clearBasket, itemCount: items.length }}
    >
      {children}
    </EstimateBasketContext.Provider>
  );
}

export function useEstimateBasket() {
  const ctx = useContext(EstimateBasketContext);
  if (!ctx) throw new Error("useEstimateBasket must be used inside EstimateBasketProvider");
  return ctx;
}
