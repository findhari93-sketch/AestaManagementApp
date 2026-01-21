// Miscellaneous Expenses Types

import type { PayerSource } from "./settlement.types";
import type { Database } from "./database.types";

type PaymentMode = Database["public"]["Enums"]["payment_mode"];
import type { BatchAllocation } from "./wallet.types";

/**
 * Miscellaneous expense record from database
 */
export interface MiscExpense {
  id: string;
  site_id: string;
  reference_number: string;
  date: string;
  amount: number;
  category_id: string | null;
  description: string | null;
  vendor_name: string | null;
  payment_mode: PaymentMode | null;
  payer_source: PayerSource | null;
  payer_name: string | null;
  payer_type: "site_engineer" | "company_direct";
  site_engineer_id: string | null;
  engineer_transaction_id: string | null;
  proof_url: string | null;
  subcontract_id: string | null;
  notes: string | null;
  is_cleared: boolean;
  is_cancelled: boolean;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  updated_at: string | null;
}

/**
 * Miscellaneous expense with joined details for display
 */
export interface MiscExpenseWithDetails extends MiscExpense {
  category_name?: string;
  subcontract_title?: string;
  site_engineer_name?: string;
}

/**
 * Form data for creating/editing miscellaneous expenses
 */
export interface MiscExpenseFormData {
  date: string;
  amount: number;
  category_id: string;
  description: string;
  vendor_name: string;
  payment_mode: PaymentMode;
  payer_source: PayerSource;
  custom_payer_name: string;
  payer_type: "site_engineer" | "company_direct";
  site_engineer_id: string;
  subcontract_id: string | null;
  notes: string;
}

/**
 * Configuration for creating a miscellaneous expense
 */
export interface CreateMiscExpenseConfig {
  siteId: string;
  formData: MiscExpenseFormData;
  proofUrl?: string;
  userId: string;
  userName: string;
  batchAllocations?: BatchAllocation[];
}

/**
 * Result from misc expense operations
 */
export interface MiscExpenseResult {
  success: boolean;
  expenseId?: string;
  referenceNumber?: string;
  engineerTransactionId?: string;
  error?: string;
}

/**
 * Subcontract option for the dropdown selector
 */
export interface SubcontractOption {
  id: string;
  title: string;
  team_name?: string;
}

/**
 * Site engineer option for the dropdown selector
 */
export interface SiteEngineerOption {
  id: string;
  name: string;
  wallet_balance?: number;
}
