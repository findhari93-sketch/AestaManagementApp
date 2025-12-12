"use client";

import { useEffect, useCallback, useRef } from "react";
import type { WorkUpdates } from "@/types/work-updates.types";

// Storage keys
const STORAGE_PREFIX = "attendance_drawer_";
const KEYS = {
  open: `${STORAGE_PREFIX}open`,
  mode: `${STORAGE_PREFIX}mode`,
  date: `${STORAGE_PREFIX}date`,
  siteId: `${STORAGE_PREFIX}site_id`,
  workUpdates: `${STORAGE_PREFIX}work_updates`,
  dirty: `${STORAGE_PREFIX}dirty`,
  timestamp: `${STORAGE_PREFIX}timestamp`,
};

// How long to keep persisted state (30 minutes)
const EXPIRY_MS = 30 * 60 * 1000;

export interface PersistedDrawerState {
  open: boolean;
  mode: "morning" | "evening" | "full";
  date: string;
  siteId: string;
  workUpdates: WorkUpdates | null;
  dirty: boolean;
}

// Helper to safely access sessionStorage
function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = sessionStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

function setStorageItem(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

// Check if persisted state is still valid (not expired)
function isStateValid(): boolean {
  const timestamp = getStorageItem<number>(KEYS.timestamp, 0);
  if (!timestamp) return false;
  return Date.now() - timestamp < EXPIRY_MS;
}

// Get full persisted state
export function getPersistedDrawerState(): PersistedDrawerState | null {
  if (!isStateValid()) {
    clearPersistedDrawerState();
    return null;
  }

  const open = getStorageItem<boolean>(KEYS.open, false);
  if (!open) return null;

  return {
    open: true,
    mode: getStorageItem<"morning" | "evening" | "full">(KEYS.mode, "full"),
    date: getStorageItem<string>(KEYS.date, ""),
    siteId: getStorageItem<string>(KEYS.siteId, ""),
    workUpdates: getStorageItem<WorkUpdates | null>(KEYS.workUpdates, null),
    dirty: getStorageItem<boolean>(KEYS.dirty, false),
  };
}

// Clear all persisted state
export function clearPersistedDrawerState(): void {
  Object.values(KEYS).forEach(removeStorageItem);
}

// Hook for managing drawer state persistence
export function useDrawerPersistence(
  open: boolean,
  mode: "morning" | "evening" | "full",
  date: string,
  siteId: string,
  workUpdates: WorkUpdates | null,
  isDirty: boolean
) {
  const previousOpenRef = useRef(open);

  // Persist state when drawer is open
  useEffect(() => {
    if (open) {
      setStorageItem(KEYS.open, true);
      setStorageItem(KEYS.mode, mode);
      setStorageItem(KEYS.date, date);
      setStorageItem(KEYS.siteId, siteId);
      setStorageItem(KEYS.timestamp, Date.now());
    }
  }, [open, mode, date, siteId]);

  // Persist work updates (debounced - only when they actually change)
  useEffect(() => {
    if (open && workUpdates) {
      setStorageItem(KEYS.workUpdates, workUpdates);
      setStorageItem(KEYS.timestamp, Date.now());
    }
  }, [open, workUpdates]);

  // Persist dirty state
  useEffect(() => {
    if (open) {
      setStorageItem(KEYS.dirty, isDirty);
    }
  }, [open, isDirty]);

  // Clear state when drawer closes normally (not on page refresh)
  useEffect(() => {
    if (previousOpenRef.current && !open) {
      // Drawer was closed by user, clear persisted state
      clearPersistedDrawerState();
    }
    previousOpenRef.current = open;
  }, [open]);

  // Add beforeunload warning if dirty
  useEffect(() => {
    if (!open || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [open, isDirty]);

  // Function to manually clear state (call after successful save)
  const clearState = useCallback(() => {
    clearPersistedDrawerState();
  }, []);

  return { clearState };
}
