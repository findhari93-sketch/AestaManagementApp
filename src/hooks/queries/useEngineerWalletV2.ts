/**
 * Engineer Wallet v2 — React Query hooks.
 *
 * Read hooks: balance, infinite ledger, wallet-enabled engineer list.
 * Cross-tab invalidation: BroadcastChannel("engineer-wallet-changed") fires after any wallet
 * mutation (deposit / spend / return / cancel) so other open tabs refresh.
 */

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { wrapQueryFn } from "@/lib/utils/timeout";
import {
  getWalletBalance,
  getWalletEnabledEngineers,
  getWalletLedger,
} from "@/lib/services/engineerWalletV2";
import type {
  WalletBalance,
  WalletEnabledEngineer,
  WalletLedgerFilters,
  WalletLedgerPage,
} from "@/types/engineer-wallet-v2.types";

export const ENGINEER_WALLET_KEYS = {
  all: ["engineer-wallet"] as const,
  balance: (userId: string) => ["engineer-wallet", "balance", userId] as const,
  ledger: (userId: string, filters: WalletLedgerFilters) =>
    ["engineer-wallet", "ledger", userId, filters] as const,
  enabledEngineers: (companyId: string) =>
    ["engineer-wallet", "enabled-engineers", companyId] as const,
};

export const ENGINEER_WALLET_BROADCAST = "engineer-wallet-changed";

function useCrossTabInvalidate(): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(ENGINEER_WALLET_BROADCAST);
    bc.onmessage = () => {
      qc.invalidateQueries({ queryKey: ENGINEER_WALLET_KEYS.all });
    };
    return () => bc.close();
  }, [qc]);
}

/**
 * Live balance + activity counters for an engineer. Returns 0 / nulls
 * when the user has no ledger rows yet (rather than 404-ing).
 */
export function useEngineerWalletBalance(userId: string | undefined) {
  useCrossTabInvalidate();
  const supabase = createClient();
  return useQuery<WalletBalance>({
    queryKey: userId ? ENGINEER_WALLET_KEYS.balance(userId) : ["engineer-wallet", "balance", "_disabled"],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: wrapQueryFn(
      () => getWalletBalance(supabase, userId as string),
      { operationName: "useEngineerWalletBalance" }
    ),
  });
}

/**
 * Cursor-paginated transaction history. Use with the standard
 * useInfiniteQuery render pattern: data.pages.flatMap(p => p.rows).
 */
export function useEngineerWalletLedger(
  userId: string | undefined,
  filters: Omit<WalletLedgerFilters, "cursor"> = {}
) {
  useCrossTabInvalidate();
  const supabase = createClient();
  return useInfiniteQuery<WalletLedgerPage, Error, InfiniteData<WalletLedgerPage>>({
    queryKey: userId ? ENGINEER_WALLET_KEYS.ledger(userId, filters) : ["engineer-wallet", "ledger", "_disabled"],
    enabled: Boolean(userId),
    staleTime: 30_000,
    initialPageParam: null as WalletLedgerPage["next_cursor"],
    queryFn: ({ pageParam }) =>
      getWalletLedger(supabase, userId as string, {
        ...filters,
        cursor: pageParam as WalletLedgerPage["next_cursor"],
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}

/**
 * List of wallet-enabled members for the company-wallet overview page
 * and the EngineerWalletPicker autocomplete in settlement dialogs.
 */
export function useWalletEnabledEngineers(companyId: string | undefined) {
  useCrossTabInvalidate();
  const supabase = createClient();
  return useQuery<WalletEnabledEngineer[]>({
    queryKey: companyId
      ? ENGINEER_WALLET_KEYS.enabledEngineers(companyId)
      : ["engineer-wallet", "enabled-engineers", "_disabled"],
    enabled: Boolean(companyId),
    staleTime: 5 * 60_000,
    queryFn: wrapQueryFn(
      () => getWalletEnabledEngineers(supabase, companyId as string),
      { operationName: "useWalletEnabledEngineers" }
    ),
  });
}

/** Notifies other tabs to refetch wallet data. Call after any successful mutation. */
export function broadcastWalletChange(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const bc = new BroadcastChannel(ENGINEER_WALLET_BROADCAST);
  bc.postMessage({ at: Date.now() });
  bc.close();
}
