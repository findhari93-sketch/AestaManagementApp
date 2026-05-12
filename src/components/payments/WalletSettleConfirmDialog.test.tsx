import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WalletSettleConfirmDialog from "./WalletSettleConfirmDialog";
import type { DailyPaymentRecord } from "@/types/payment.types";

vi.mock("@/hooks/queries/useEngineerWalletV2", () => ({
  useEngineerWalletBalance: vi.fn(),
  useLatestDepositSource: vi.fn(),
}));
vi.mock("@/hooks/queries/usePayerSources", () => ({
  usePayerSources: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/services/settlementService", () => ({
  processSettlement: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    userProfile: { id: "eng-1", name: "Ajith Kumar", role: "site_engineer" },
  })),
}));
vi.mock("@/contexts/ToastContext", () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  })),
}));

import {
  useEngineerWalletBalance,
  useLatestDepositSource,
} from "@/hooks/queries/useEngineerWalletV2";
import { usePayerSources } from "@/hooks/queries/usePayerSources";
import { processSettlement } from "@/lib/services/settlementService";

const mockRecord: DailyPaymentRecord = {
  id: "att-1",
  sourceType: "daily",
  sourceId: "da-1",
  date: "2026-05-09",
  laborerId: "lab-1",
  laborerName: "Worker A",
  laborerType: "daily",
  amount: 800,
  isPaid: false,
  paidVia: null,
  paymentDate: null,
  paymentMode: null,
  engineerTransactionId: null,
  engineerUserId: null,
  proofUrl: null,
  paymentNotes: null,
  settlementStatus: null,
  companyProofUrl: null,
  engineerProofUrl: null,
  transactionDate: null,
  settledDate: null,
  confirmedAt: null,
  settlementMode: null,
  cashReason: null,
  moneySource: null,
  moneySourceName: null,
  subcontractId: null,
  subcontractTitle: null,
  expenseId: null,
  settlementGroupId: null,
  settlementReference: null,
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  date: "2026-05-09",
  dateLabel: "09 May",
  dailyRecords: [mockRecord],
  siteId: "site-1",
  engineerId: "eng-1",
};

describe("WalletSettleConfirmDialog", () => {
  beforeEach(() => {
    vi.mocked(useEngineerWalletBalance).mockReturnValue({
      data: { balance: 5000 },
      isLoading: false,
    } as any);
    vi.mocked(useLatestDepositSource).mockReturnValue({
      data: { payer_source: "amma_money", transaction_date: "2026-05-01" },
      isLoading: false,
    } as any);
    vi.mocked(usePayerSources).mockReturnValue({
      data: [
        { key: "amma_money", label: "Amma Money", icon: "Person", requires_name: false },
      ],
      isLoading: false,
    } as any);
  });

  it("shows pending amount and wallet balance", () => {
    render(<WalletSettleConfirmDialog {...defaultProps} />);
    expect(screen.getByText("₹800")).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it("shows LIFO payer source label", () => {
    render(<WalletSettleConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/Amma Money/i)).toBeInTheDocument();
  });

  it("disables Confirm when balance < pending amount", () => {
    vi.mocked(useEngineerWalletBalance).mockReturnValue({
      data: { balance: 500 },
      isLoading: false,
    } as any);
    render(<WalletSettleConfirmDialog {...defaultProps} />);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });

  it("shows insufficient balance message when balance < amount", () => {
    vi.mocked(useEngineerWalletBalance).mockReturnValue({
      data: { balance: 500 },
      isLoading: false,
    } as any);
    render(<WalletSettleConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/insufficient wallet balance/i)).toBeInTheDocument();
  });

  it("calls processSettlement with engineer_wallet channel on Confirm", async () => {
    vi.mocked(processSettlement).mockResolvedValue({
      success: true,
      settlementReference: "SET-001",
      settlementGroupId: "sg-1",
    } as any);
    render(<WalletSettleConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => {
      expect(processSettlement).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          paymentChannel: "engineer_wallet",
          payerSource: "amma_money",
          engineerId: "eng-1",
          totalAmount: 800,
        })
      );
    });
  });

  it("calls onSuccess after successful settlement", async () => {
    const onSuccess = vi.fn();
    vi.mocked(processSettlement).mockResolvedValue({ success: true } as any);
    render(<WalletSettleConfirmDialog {...defaultProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
