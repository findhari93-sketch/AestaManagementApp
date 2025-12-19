// Payment Types for Unified Payment Management System

// ============ COMMON TYPES ============

export type PaymentMode = "upi" | "cash" | "net_banking" | "other";

export type PaymentChannel = "direct" | "engineer_wallet";

export type PaymentSourceType = "daily" | "market";

export type PaymentStatus = "pending" | "partial" | "completed" | "advance";

export type SettlementStatus =
  | "pending_settlement"
  | "pending_confirmation"
  | "confirmed"
  | "disputed";

// ============ DAILY & MARKET PAYMENTS ============

export interface DailyPaymentRecord {
  id: string;
  sourceType: PaymentSourceType;
  sourceId: string; // daily_attendance.id or market_laborer_attendance.id
  date: string;

  // Laborer info
  laborerId: string | null;
  laborerName: string;
  laborerType: "daily" | "contract" | "market";
  category?: string;
  role?: string;
  count?: number; // For market laborers

  // Amount
  amount: number;

  // Payment status
  isPaid: boolean;
  paidVia: PaymentChannel | null;
  paymentDate: string | null;
  paymentMode: PaymentMode | null;
  engineerTransactionId: string | null;
  proofUrl: string | null;
  paymentNotes: string | null;
  settlementStatus: "pending_settlement" | "pending_confirmation" | "confirmed" | "disputed" | null;

  // Settlement tracking (from engineer transaction)
  companyProofUrl: string | null; // proof_url - Company sent to engineer
  engineerProofUrl: string | null; // settlement_proof_url - Engineer settled with laborer
  transactionDate: string | null; // When company sent money
  settledDate: string | null; // When engineer settled
  confirmedAt: string | null; // When admin confirmed
  settlementMode: "upi" | "cash" | null; // How engineer settled
  cashReason: string | null; // Reason for cash payment (notes field)

  // Subcontract linking (optional)
  subcontractId: string | null;
  subcontractTitle: string | null;

  // Expense linking (for cancellation)
  expenseId: string | null;

  // Audit
  recordedBy?: string | null;
  recordedByUserId?: string | null;
  recordedByAvatar?: string | null;
}

export interface DateGroupSummary {
  dailyCount: number;
  dailyTotal: number;
  dailyPending: number;
  dailyPaid: number;
  dailySentToEngineer: number;
  marketCount: number;
  marketTotal: number;
  marketPending: number;
  marketPaid: number;
  marketSentToEngineer: number;
}

export interface DateGroup {
  date: string;
  dateLabel: string; // "Dec 09, 2024"
  dayName: string; // "Monday"
  dailyRecords: DailyPaymentRecord[];
  marketRecords: DailyPaymentRecord[];
  summary: DateGroupSummary;
  isExpanded: boolean;
}

// ============ CONTRACT WEEKLY PAYMENTS ============

export interface DailySalaryEntry {
  date: string;
  dayName: string; // "Sun", "Mon", etc.
  attendanceId: string;
  amount: number;
  workDays: number;
}

export interface LaborerPaymentEntry {
  paymentId: string;
  amount: number;
  paymentDate: string;
  paymentMode: PaymentMode | null;
  weekStart: string; // Which week this payment was for
  paidBy: string;
  paidByUserId: string;
  paidByAvatar: string | null;
  proofUrl: string | null;
  subcontractId: string | null;
}

export interface WeeklyContractLaborer {
  laborerId: string;
  laborerName: string;
  laborerRole: string | null;
  teamId: string | null;
  teamName: string | null;
  subcontractId: string | null;
  subcontractTitle: string | null;

  // Daily breakdown for the week
  dailySalary: DailySalaryEntry[];

  // This week's values
  daysWorked: number;
  weekSalary: number; // Total salary for THIS week
  weekPaid: number; // Amount paid THIS week

  // Running balance (cumulative from contract start)
  previousBalance: number; // Carried over from previous weeks
  cumulativeSalary: number; // Total salary from start
  cumulativePaid: number; // Total paid from start
  runningBalance: number; // cumulativeSalary - cumulativePaid (positive = due, negative = advance)

  // Status indicators
  paymentProgress: number; // Percentage (0-100+, can exceed 100 if advance)
  status: PaymentStatus;

  // Payment history for this laborer (all payments, not just this week)
  payments: LaborerPaymentEntry[];
}

export interface WeekGroupSummary {
  laborerCount: number;
  totalSalary: number;
  totalPaid: number;
  totalDue: number;
  paymentProgress: number; // Percentage
  status: PaymentStatus;
}

export interface WeekGroup {
  weekStart: string; // Sunday date (YYYY-MM-DD)
  weekEnd: string; // Saturday date (YYYY-MM-DD)
  weekLabel: string; // "Dec 01 - Dec 07, 2024"
  laborers: WeeklyContractLaborer[];
  summary: WeekGroupSummary;
  isExpanded: boolean;
}

// ============ PAYMENT DIALOG PROPS ============

export interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;

  // For Daily/Market payments (bulk)
  dailyRecords?: DailyPaymentRecord[];

  // For Contract Weekly payments (single laborer)
  weeklyPayment?: {
    laborer: WeeklyContractLaborer;
    weekStart: string;
    weekEnd: string;
  };

  // Common options
  allowSubcontractLink?: boolean;
  defaultSubcontractId?: string;
  onSuccess?: () => void;
}

export interface PaymentFormState {
  paymentMode: PaymentMode;
  paymentChannel: PaymentChannel;
  selectedEngineerId: string;
  engineerReference: string; // What this payment is for
  subcontractId: string | null;
  proofFile: File | null;
  proofUrl: string | null;
  amount: number; // For partial payments
  isPartialPayment: boolean;
  notes: string;
}

// ============ SUBCONTRACT SELECTOR ============

export interface SubcontractOption {
  id: string;
  title: string;
  totalValue: number;
  totalPaid: number;
  balanceDue: number;
  status: string;
  teamName?: string;
}

// ============ ENGINEER WALLET SETTLEMENT ============

export interface EngineerTransaction {
  id: string;
  engineerId: string;
  engineerName: string;
  engineerAvatar: string | null;
  siteId: string;
  siteName: string;

  // Transaction details
  transactionType: "credit" | "debit" | "spent_on_behalf";
  amount: number;
  transactionDate: string;
  paymentMode: PaymentMode | null;
  proofUrl: string | null;

  // Reference - what this payment is for
  paymentReference: string | null;
  description: string | null;

  // Linked records
  relatedAttendanceIds: string[];
  relatedSubcontractId: string | null;

  // Settlement status
  settlementStatus: SettlementStatus;
  settlementMode: PaymentMode | null;
  settlementProofUrl: string | null;
  settledAt: string | null;

  // Admin confirmation
  confirmedBy: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  disputeNotes: string | null;

  // Audit
  createdBy: string;
  createdByUserId: string;
  createdAt: string;
}

// ============ SUMMARY CARDS ============

export interface PaymentSummaryData {
  // Daily/Market totals
  dailyMarketPending: number;
  dailyMarketPendingCount: number;
  dailyMarketSentToEngineer: number;
  dailyMarketSentToEngineerCount: number;
  dailyMarketPaid: number;
  dailyMarketPaidCount: number;

  // Contract weekly totals
  contractWeeklyDue: number;
  contractWeeklyDueLaborerCount: number;
  contractWeeklyPaid: number;

  // By subcontract
  bySubcontract: {
    subcontractId: string;
    subcontractTitle: string;
    totalPaid: number;
    totalDue: number;
  }[];

  // Unlinked (site expenses)
  unlinkedTotal: number;
  unlinkedCount: number;
}

// ============ FILTER STATE ============

export interface PaymentFilterState {
  dateFrom: string;
  dateTo: string;
  status: "all" | "pending" | "sent_to_engineer" | "paid";
  subcontractId: string | "all";
  teamId: string | "all";
}

export interface WeeklyFilterState {
  weeksToShow: number; // Default 4
  subcontractId: string | "all";
  teamId: string | "all";
  status: "all" | "pending" | "completed";
}

// ============ HELPER TYPES ============

export interface WeekBoundary {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
}

export function getPaymentStatusColor(
  status: PaymentStatus
): "error" | "warning" | "success" | "info" {
  switch (status) {
    case "pending":
      return "error";
    case "partial":
      return "warning";
    case "completed":
      return "success";
    case "advance":
      return "info";
    default:
      return "warning";
  }
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "partial":
      return "Partial";
    case "completed":
      return "Completed";
    case "advance":
      return "Advance Paid";
    default:
      return status;
  }
}

export function getPaymentModeLabel(mode: PaymentMode): string {
  switch (mode) {
    case "upi":
      return "UPI";
    case "cash":
      return "Cash";
    case "net_banking":
      return "Net Banking";
    case "other":
      return "Other";
    default:
      return mode;
  }
}
