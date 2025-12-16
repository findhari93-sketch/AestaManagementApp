// Settlement notification types

export type SettlementStatus =
  | "pending_settlement"
  | "pending_confirmation"
  | "confirmed"
  | "disputed";

export type SettlementMode = "upi" | "cash";

// Payer source - tracks whose money was used for settlement
export type PayerSource = "own_money" | "client_money" | "mothers_money" | "custom";

export interface PayerInfo {
  source: PayerSource;
  customName?: string;
}

// Settlement context for unified dialog
export type SettlementContext = "daily_single" | "weekly";

// Settlement type selection (for weekly settlement)
export type SettlementTypeSelection = "all" | "daily" | "contract" | "market";

// Record to be settled
export interface SettlementRecord {
  id: string;
  sourceType: "daily" | "market";
  sourceId: string;
  laborerName: string;
  laborerType: "daily" | "market" | "contract";
  amount: number;
  date: string;
  isPaid: boolean;
  role?: string;
  category?: string;
  count?: number; // For market laborers
}

// Configuration for unified settlement dialog
export interface UnifiedSettlementConfig {
  context: SettlementContext;
  // Date info
  date?: string; // For single date
  dateRange?: { from: string; to: string }; // For weekly
  weekLabel?: string;
  // Records to settle
  records: SettlementRecord[];
  // Pre-computed totals
  totalAmount: number;
  pendingAmount: number;
  // By type breakdowns (pending amounts)
  dailyLaborPending: number;
  contractLaborPending: number;
  marketLaborPending: number;
  // Allow partial type settlement (for weekly)
  allowTypeSelection: boolean;
  // Optional subcontract linking
  defaultSubcontractId?: string;
}

export type PaymentSettlementNotificationType =
  | "payment_settlement_pending"
  | "payment_settlement_completed";

export interface SettlementTransaction {
  id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  settlement_status: SettlementStatus | null;
  settlement_mode: SettlementMode | null;
  settlement_proof_url: string | null;
  settlement_reason: string | null;
  user_id: string;
  site_id: string | null;
  engineer_name?: string;
  site_name?: string;
}

export interface SettlementLaborerDetail {
  id: string;
  laborer_name: string;
  amount: number;
  date: string;
  type: "daily" | "market";
}

export interface SettlementFormData {
  transactionId: string;
  settlementMode: SettlementMode;
  proofUrl?: string;
  reason?: string;
}

export interface PendingSettlement {
  id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  site_name: string | null;
  laborer_count?: number;
}

// Notification type extensions
export interface PaymentSettlementNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: PaymentSettlementNotificationType;
  is_read: boolean;
  read_at: string | null;
  related_id: string; // transaction_id
  related_table: "site_engineer_transactions";
  created_at: string;
}
