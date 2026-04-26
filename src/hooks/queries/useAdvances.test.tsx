import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAdvances } from "./useAdvances";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: mockRpc }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useAdvances", () => {
  beforeEach(() => mockRpc.mockReset());

  it("filters get_payments_ledger to subtype=advance and maps to AdvanceRow", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "p:abc",
          settlement_ref: "SET-260403-001",
          row_type: "weekly",
          subtype: "advance",
          date_or_week_start: "2026-04-03",
          week_end: "2026-04-05",
          for_label: "Krishnan · advance",
          amount: "15000",
          is_paid: true,
          is_pending: false,
          laborer_id: "lab-1",
        },
        {
          id: "p:xyz",
          settlement_ref: "SET-260411-001",
          row_type: "weekly",
          subtype: "salary-waterfall",
          date_or_week_start: "2026-04-11",
          week_end: "2026-04-12",
          for_label: "Krishnan",
          amount: "12000",
          is_paid: true,
          is_pending: false,
          laborer_id: "lab-1",
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useAdvances({ siteId: "site-1", dateFrom: null, dateTo: null }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toEqual({
      id: "p:abc",
      settlementRef: "SET-260403-001",
      date: "2026-04-03",
      forLabel: "Krishnan · advance",
      amount: 15000,
      laborerId: "lab-1",
    });
  });

  it("is disabled when siteId is undefined", () => {
    const { result } = renderHook(
      () => useAdvances({ siteId: undefined, dateFrom: null, dateTo: null }),
      { wrapper }
    );
    expect(result.current.fetchStatus).toBe("idle");
  });
});
