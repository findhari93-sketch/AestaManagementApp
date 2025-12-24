/**
 * Engineer Wallet Types
 * Types for batch-based money tracking in engineer wallets
 */

import type { PayerSource } from "./settlement.types";
import type { PaymentMode, SiteEngineerTransaction } from "./database.types";

// ============================================
// Batch Code Prefixes
// ============================================

/** Maps payer source to batch code prefix */
export const PAYER_SOURCE_PREFIX: Record<PayerSource, string> = {
  trust_account: "TRUST",
  amma_money: "AMMA",
  mothers_money: "AMMA", // Legacy support
  client_money: "CLIENT",
  own_money: "OWN",
  other_site_money: "SITE",
  custom: "OTHER",
};

// ============================================
// Transaction Types
// ============================================

/** Extended transaction type with batch info */
export interface EngineerWalletTransaction extends SiteEngineerTransaction {
  // Batch tracking (for deposits)
  payer_source: PayerSource | null;
  payer_name: string | null;
  batch_code: string | null;
  site_restricted: boolean;
  remaining_balance: number;

  // Joined data
  user_name?: string;
  site_name?: string;

  // Batch usage (for spending transactions)
  batch_usages?: BatchUsageRecord[];

  // Reimbursement info (for own_money expenses)
  reimbursement?: EngineerReimbursement | null;
}

/** Transaction with display-ready data */
export interface TransactionWithDetails extends EngineerWalletTransaction {
  user_name: string;
  site_name: string;
}

// ============================================
// Batch Selection Types
// ============================================

/** Available batch option for spending */
export interface BatchOption {
  id: string;
  batch_code: string;
  payer_source: PayerSource;
  payer_name: string | null;
  remaining_balance: number;
  original_amount: number;
  site_id: string | null;
  site_name: string | null;
  site_restricted: boolean;
  created_at: string;
  transaction_date: string;
}

/** Record of amount used from a specific batch */
export interface BatchUsageRecord {
  batch_transaction_id: string;
  batch_code: string;
  payer_source: PayerSource;
  payer_name?: string | null;
  amount_used: number;
}

/** Batch allocation for spending transaction */
export interface BatchAllocation {
  batchId: string;
  batchCode: string;
  payerSource: PayerSource;
  payerName?: string;
  amount: number;
}

// ============================================
// Reimbursement Types
// ============================================

/** Reimbursement record for own_money expenses */
export interface EngineerReimbursement {
  id: string;
  expense_transaction_id: string;
  engineer_id: string;
  amount: number;
  payer_source: PayerSource;
  payer_name: string | null;
  payment_mode: string;
  proof_url: string | null;
  settled_date: string;
  settled_by_user_id: string | null;
  settled_by_name: string | null;
  notes: string | null;
  created_at: string;
}

/** Pending reimbursement (own money expense not yet settled) */
export interface PendingReimbursement {
  transaction_id: string;
  engineer_id: string;
  engineer_name: string;
  amount: number;
  description: string | null;
  site_id: string | null;
  site_name: string | null;
  transaction_date: string;
  created_at: string;
}

// ============================================
// Wallet Summary Types
// ============================================

/** Engineer wallet summary with two-balance display */
export interface EngineerWalletSummary {
  engineer_id: string;
  engineer_name: string;

  /** Company money currently in engineer's hands */
  wallet_balance: number;

  /** Own money spent, pending reimbursement */
  owed_to_engineer: number;

  // Detailed breakdown
  total_received: number;
  total_spent_from_wallet: number;
  total_returned: number;
  total_own_money_used: number;
  total_reimbursed: number;

  // Available batches with remaining balance
  available_batches: BatchOption[];

  // Pending reimbursements
  pending_reimbursements: PendingReimbursement[];

  // Breakdown by payer source
  by_source: SourceBreakdown[];

  // Breakdown by site
  by_site: SiteBreakdown[];
}

/** Breakdown by payer source */
export interface SourceBreakdown {
  source: PayerSource;
  source_label: string;
  total_received: number;
  total_spent: number;
  remaining: number;
}

/** Breakdown by site */
export interface SiteBreakdown {
  site_id: string;
  site_name: string;
  spent: number;
  own_money: number;
}

// ============================================
// Form Types
// ============================================

/** Money source selection for expense recording */
export type ExpenseMoneySource = "wallet" | "own_money";

/** Add Money to Wallet form state */
export interface AddMoneyFormState {
  user_id: string;
  payer_source: PayerSource;
  payer_name: string;
  amount: number;
  transaction_date: string;
  payment_mode: PaymentMode;
  proof_file: File | null;
  proof_url: string | null;
  site_id: string;
  site_restricted: boolean;
  related_subcontract_id: string | null;
  notes: string;
}

/** Record Expense form state */
export interface RecordExpenseFormState {
  user_id: string;
  money_source: ExpenseMoneySource;
  amount: number;
  transaction_date: string;
  site_id: string;
  recipient_type: string;
  payment_mode: PaymentMode;
  description: string;
  notes: string;
  related_subcontract_id: string | null;

  // For wallet spending
  selected_batches: BatchAllocation[];

  // For proof upload
  proof_file: File | null;
  proof_url: string | null;
}

/** Return Money form state */
export interface ReturnMoneyFormState {
  user_id: string;
  amount: number;
  transaction_date: string;
  payment_mode: PaymentMode;
  notes: string;

  // Which batch(es) to return from
  selected_batches: BatchAllocation[];
}

/** Settle Reimbursement form state */
export interface SettleReimbursementFormState {
  // Pending expenses to reimburse
  selected_expenses: string[];
  total_amount: number;

  // Who is paying back
  payer_source: PayerSource;
  payer_name: string;

  // Payment details
  payment_mode: PaymentMode;
  proof_file: File | null;
  proof_url: string | null;
  settled_date: string;
  notes: string;
}

// ============================================
// Service Types
// ============================================

/** Config for recording a deposit */
export interface RecordDepositConfig {
  engineerId: string;
  amount: number;
  payerSource: PayerSource;
  payerName?: string;
  paymentMode: PaymentMode;
  proofUrl?: string;
  siteId?: string;
  siteRestricted?: boolean;
  subcontractId?: string;
  notes?: string;
  transactionDate?: string;
  userName: string;
  userId: string;
}

/** Config for recording spending */
export interface RecordSpendingConfig {
  engineerId: string;
  amount: number;
  siteId: string;
  description: string;
  recipientType: string;
  paymentMode: PaymentMode;
  moneySource: ExpenseMoneySource;
  batchAllocations?: BatchAllocation[];
  subcontractId?: string;
  proofUrl?: string;
  notes?: string;
  transactionDate?: string;
  userName: string;
  userId: string;
  // Settlement linking
  settlementReference?: string;
  settlementGroupId?: string;
}

/** Config for recording return */
export interface RecordReturnConfig {
  engineerId: string;
  amount: number;
  paymentMode: PaymentMode;
  batchAllocations: BatchAllocation[];
  notes?: string;
  transactionDate?: string;
  userName: string;
  userId: string;
}

/** Config for settling reimbursement */
export interface SettleReimbursementConfig {
  expenseTransactionIds: string[];
  engineerId: string;
  totalAmount: number;
  payerSource: PayerSource;
  payerName?: string;
  paymentMode: PaymentMode;
  proofUrl?: string;
  notes?: string;
  settledDate?: string;
  userName: string;
  userId: string;
}

/** Result from wallet operations */
export interface WalletOperationResult {
  success: boolean;
  transactionId?: string;
  batchCode?: string;
  error?: string;
}

// ============================================
// Validation Types
// ============================================

/** Batch selection validation result */
export interface BatchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// Unified Settlement Types
// ============================================

/** Source of settlement record - legacy table or new settlement_groups */
export type SettlementRecordSource = "legacy" | "settlement_group";

/** Unified settlement record for displaying both old and new settlements */
export interface UnifiedSettlementRecord {
  id: string;
  source: SettlementRecordSource;
  settlement_reference: string | null;
  settlement_date: string;
  total_amount: number;
  laborer_count: number;
  payment_mode: string | null;
  payer_source: PayerSource | null;
  payer_name: string | null;
  proof_url: string | null;
  notes: string | null;
  site_id: string | null;
  site_name: string | null;
  engineer_id: string | null;
  engineer_name: string | null;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  created_at: string;
  created_by_name: string | null;
  // Legacy-specific fields
  settlement_type?: "company_to_engineer" | "engineer_to_company";
  // New settlement-specific fields
  payment_channel?: "direct" | "engineer_wallet";
  subcontract_id?: string | null;
}

/** Helper to get display text for payment source via engineer */
export function getPaymentSourceViaEngineer(
  payerSource: PayerSource,
  payerName: string | null,
  engineerName: string
): string {
  const sourceLabels: Record<PayerSource, string> = {
    trust_account: "Trust Account",
    amma_money: "Amma Money",
    mothers_money: "Amma Money",
    client_money: "Client Money",
    own_money: "Own Money",
    other_site_money: payerName || "Other Site",
    custom: payerName || "Other",
  };

  const sourceLabel = sourceLabels[payerSource] || payerSource;
  return `${sourceLabel} via ${engineerName}`;
}
