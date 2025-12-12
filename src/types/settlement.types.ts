// Settlement notification types

export type SettlementStatus =
  | "pending_settlement"
  | "pending_confirmation"
  | "confirmed"
  | "disputed";

export type SettlementMode = "upi" | "cash";

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
