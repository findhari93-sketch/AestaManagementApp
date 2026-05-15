import type { ReactNode } from "react";
import type { PayerSource } from "./settlement.types";

export interface SettleViaWalletPayload {
  amount: number;
  notes?: string;
  payerSource: PayerSource;
  customPayerName?: string;
  subcontractId?: string | null;
  proofUrl?: string | null;
  siteId: string;
  engineerId: string;
}

export interface SettleViaWalletDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;

  siteId: string;
  engineerId: string;

  amount: number;
  editableAmount?: boolean;
  maxAmount?: number;

  title?: string;
  summary?: string;
  renderSummary?: () => ReactNode;

  enablePayerSourceOverride?: boolean;
  defaultPayerSource?: PayerSource;

  enableSubcontractLink?: boolean;
  initialSubcontractId?: string | null;

  showNotes?: boolean;
  showProofUpload?: boolean;

  onConfirm: (payload: SettleViaWalletPayload) => Promise<void>;
  allowPartial?: boolean;
}

export interface WalletBalanceCardProps {
  amount: number;
  balance: number;
  isLoading: boolean;
  sourceLabel?: string;
  hasNoDeposit: boolean;
  isInsufficient: boolean;

  payerSource: PayerSource;
  customName: string;
  showOverride: boolean;
  onToggleOverride: () => void;
  onPayerSourceChange: (s: PayerSource) => void;
  onCustomNameChange: (n: string) => void;
  enableOverride?: boolean;
  siteId: string;
}
