"use client";

import { useEffect, useCallback, useRef, useState } from "react";

// Storage key prefix
const STORAGE_PREFIX = "form_draft_";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export interface FormDraftOptions<T> {
  /** Unique key for this form (e.g., "vendor_dialog", "material_dialog") */
  key: string;
  /** Initial form data (used when no draft exists or when resetting) */
  initialData: T;
  /** Whether the dialog/form is open */
  isOpen: boolean;
  /** Optional entity ID for edit mode (to differentiate drafts for different entities) */
  entityId?: string | null;
  /** Debounce delay in ms for saving (default: 500) */
  debounceMs?: number;
  /** Called when draft is restored */
  onRestore?: (data: T, metadata: DraftMetadata) => void;
}

export interface DraftMetadata {
  timestamp: number;
  entityId?: string | null;
}

interface StoredDraft<T> {
  data: T;
  metadata: DraftMetadata;
}

// Helper to safely access sessionStorage
function getStorageItem<T>(key: string): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item) as StoredDraft<T>;

    // Check expiry
    if (Date.now() - parsed.metadata.timestamp > EXPIRY_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setStorageItem<T>(
  key: string,
  data: T,
  entityId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    const stored: StoredDraft<T> = {
      data,
      metadata: {
        timestamp: Date.now(),
        entityId,
      },
    };
    sessionStorage.setItem(key, JSON.stringify(stored));
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

export interface UseFormDraftReturn<T> {
  /** Current form data */
  formData: T;
  /** Update the entire form data object */
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  /** Update a single field */
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Update multiple fields at once */
  updateFormData: (updates: Partial<T>) => void;
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** Whether a draft was restored when the dialog opened */
  hasRestoredDraft: boolean;
  /** Clear the draft (call after successful save) */
  clearDraft: () => void;
  /** Discard draft and reset to initial data */
  discardDraft: () => void;
  /** Mark as clean without clearing storage (for partial saves) */
  markClean: () => void;
}

export function useFormDraft<T extends object>({
  key,
  initialData,
  isOpen,
  entityId,
  debounceMs = 500,
  onRestore,
}: FormDraftOptions<T>): UseFormDraftReturn<T> {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [formData, setFormData] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousOpenRef = useRef(isOpen);
  const previousEntityIdRef = useRef(entityId);
  const initialDataRef = useRef(initialData);

  // Keep initialData ref updated
  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  // Store onRestore callback in ref to avoid dependency issues
  const onRestoreRef = useRef(onRestore);
  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  // Restore draft when dialog opens
  // Note: Using refs for initialData and onRestore to avoid infinite loops
  // when parent component doesn't memoize these values
  useEffect(() => {
    if (isOpen && !previousOpenRef.current) {
      // Dialog just opened
      const storedDraft = getStorageItem<T>(storageKey);

      if (storedDraft) {
        // Check if draft is for the same entity (or both are new/null)
        const draftEntityId = storedDraft.metadata.entityId;
        const isSameEntity =
          draftEntityId === entityId ||
          (draftEntityId === null && entityId === null) ||
          (draftEntityId === undefined && entityId === undefined);

        if (isSameEntity) {
          setFormData(storedDraft.data);
          setIsDirty(true);
          setHasRestoredDraft(true);
          onRestoreRef.current?.(storedDraft.data, storedDraft.metadata);
        } else {
          // Different entity - use initial data and clear old draft
          removeStorageItem(storageKey);
          setFormData(initialDataRef.current);
          setIsDirty(false);
          setHasRestoredDraft(false);
        }
      } else {
        setFormData(initialDataRef.current);
        setIsDirty(false);
        setHasRestoredDraft(false);
      }
    }
    previousOpenRef.current = isOpen;
  }, [isOpen, storageKey, entityId]);

  // Reset form when entityId changes while dialog is open (switching from edit to new, etc.)
  useEffect(() => {
    if (isOpen && previousEntityIdRef.current !== entityId) {
      // Entity changed - reset form
      removeStorageItem(storageKey);
      setFormData(initialDataRef.current);
      setIsDirty(false);
      setHasRestoredDraft(false);
    }
    previousEntityIdRef.current = entityId;
  }, [isOpen, entityId, storageKey]);

  // Debounced persistence
  useEffect(() => {
    if (!isOpen || !isDirty) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setStorageItem(storageKey, formData, entityId);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen, isDirty, formData, storageKey, debounceMs, entityId]);

  // Clear draft when dialog closes normally (without dirty state)
  useEffect(() => {
    if (previousOpenRef.current && !isOpen && !isDirty) {
      // Dialog closed and form is clean - clear draft
      removeStorageItem(storageKey);
      setHasRestoredDraft(false);
    }
  }, [isOpen, isDirty, storageKey]);

  // Warn on page unload if dirty
  useEffect(() => {
    if (!isOpen || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOpen, isDirty]);

  // Update single field
  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
    },
    []
  );

  // Bulk update
  const updateFormData = useCallback((updates: Partial<T>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  // Clear draft (call after successful save)
  const clearDraft = useCallback(() => {
    removeStorageItem(storageKey);
    setIsDirty(false);
    setHasRestoredDraft(false);
  }, [storageKey]);

  // Discard draft and reset to initial
  const discardDraft = useCallback(() => {
    removeStorageItem(storageKey);
    setFormData(initialDataRef.current);
    setIsDirty(false);
    setHasRestoredDraft(false);
  }, [storageKey]);

  // Mark as clean without clearing storage
  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  return {
    formData,
    setFormData,
    updateField,
    updateFormData,
    isDirty,
    hasRestoredDraft,
    clearDraft,
    discardDraft,
    markClean,
  };
}
