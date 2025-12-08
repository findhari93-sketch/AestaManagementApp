// Database Types for Aesta Construction Manager
// Generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Enums
export type UserRole = "admin" | "office" | "site_engineer";
export type UserStatus = "active" | "inactive";
export type SiteType = "single_client" | "multi_client";
export type SiteStatus = "planning" | "active" | "on_hold" | "completed";
export type SectionStatus = "not_started" | "in_progress" | "completed";
export type EmploymentType = "daily_wage" | "contract" | "specialist";
export type LaborerStatus = "active" | "inactive";
export type WorkVariance = "overtime" | "standard" | "undertime";
export type ContractType = "mesthri" | "specialist";
export type MeasurementUnit = "sqft" | "rft" | "nos" | "lumpsum";
export type ContractStatus = "draft" | "active" | "completed" | "cancelled";
export type MilestoneStatus = "pending" | "in_progress" | "completed" | "paid";
export type TransactionType = "advance" | "extra";
export type DeductionStatus =
  | "pending"
  | "partial"
  | "deducted"
  | "written_off";
export type PaymentMode = "cash" | "upi" | "bank_transfer" | "cheque";
export type ExpenseModule = "labor" | "material" | "machinery" | "general";
export type SalaryStatus = "draft" | "calculated" | "partial" | "paid";
export type PaymentType =
  | "weekly_advance"
  | "milestone"
  | "part_payment"
  | "final_settlement";
export type DeletionRequestStatus = "pending" | "approved" | "rejected";
export type AuditAction = "insert" | "update" | "delete";

// Payment Ecosystem Enums
export type LaborerType = "contract" | "daily_market";
export type PaymentChannel = "via_site_engineer" | "mesthri_at_office" | "at_office" | "company_direct_online";
export type SiteEngineerTransactionType = "received_from_company" | "spent_on_behalf" | "used_own_money" | "returned_to_company";
export type SettlementType = "company_to_engineer" | "engineer_to_company";
export type RecipientType = "laborer" | "mesthri" | "vendor" | "other";

// Theme preference type
export type ThemePreference = "light" | "dark";

// Core Tables
export interface User {
  id: string;
  auth_id: string;
  email: string;
  name: string;
  display_name: string | null;
  phone: string | null;
  role: UserRole;
  assigned_sites: string[] | null;
  status: UserStatus;
  avatar_url: string | null;
  job_title: string | null;
  timezone: string | null;
  date_format: string | null;
  last_login_at: string | null;
  theme_preference: ThemePreference;
  email_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  site_type: SiteType;
  status: SiteStatus;
  start_date: string | null;
  target_completion_date: string | null;
  nearby_tea_shop_name: string | null;
  // Client Contract Fields
  client_name: string | null;
  client_contact: string | null;
  client_email: string | null;
  project_contract_value: number | null;
  contract_document_url: string | null;
  payment_segments: number | null;
  // Payment Tracking
  total_amount_received: number;
  last_payment_amount: number | null;
  last_payment_date: string | null;
  construction_phase_id: string | null;
  construction_phase: string | null;
  // Location
  location_lat: number | null;
  location_lng: number | null;
  location_google_maps_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SitePaymentMilestone {
  id: string;
  site_id: string;
  milestone_name: string;
  milestone_description: string | null;
  percentage: number;
  amount: number;
  expected_date: string | null;
  actual_payment_date: string | null;
  status: "pending" | "paid" | "overdue";
  sequence_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ===============================================
// CLIENT PAYMENT TRACKING TABLES
// ===============================================

export interface ClientPaymentPlan {
  id: string;
  site_id: string;
  plan_name: string;
  total_contract_amount: number;
  description: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentPhase {
  id: string;
  payment_plan_id: string;
  phase_name: string;
  description: string | null;
  percentage: number;
  amount: number;
  expected_date: string | null;
  sequence_order: number;
  is_milestone: boolean;
  construction_phase_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPayment {
  id: string;
  site_id: string;
  payment_phase_id: string | null;
  payment_date: string;
  payment_mode: PaymentMode;
  amount: number;
  transaction_reference: string | null;
  notes: string | null;
  receipt_url: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentDispute {
  id: string;
  site_id: string;
  client_payment_id: string | null;
  dispute_type:
    | "wrong_amount"
    | "duplicate"
    | "refund_request"
    | "bounced_cheque";
  status: "open" | "in_review" | "resolved" | "rejected";
  description: string;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ===============================================
// VIEW TYPES FOR QUERIES
// ===============================================

export interface PaymentPlanSummary {
  id: string;
  site_id: string;
  plan_name: string;
  total_contract_amount: number;
  total_amount_paid: number;
  balance_amount: number;
  payment_percentage: number;
  total_payments_received: number;
  last_payment_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PaymentPhaseStatus {
  id: string;
  payment_plan_id: string;
  phase_name: string;
  percentage: number;
  amount: number;
  expected_date: string | null;
  sequence_order: number;
  amount_paid: number;
  amount_pending: number;
  status: "paid" | "partial" | "pending" | "overdue";
  last_payment_date: string | null;
  payment_count: number;
}

export interface ConstructionPhase {
  id: string;
  name: string;
  description: string | null;
  sequence_order: number;
  default_payment_percentage: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConstructionSubphase {
  id: string;
  phase_id: string;
  name: string;
  description: string | null;
  sequence_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuildingSection {
  id: string;
  site_id: string;
  name: string;
  sequence_order: number;
  status: SectionStatus;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

// Labor Tables
export interface LaborCategory {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface LaborRole {
  id: string;
  category_id: string;
  name: string;
  default_daily_rate: number;
  display_order: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  leader_name: string;
  leader_phone: string;
  status: LaborerStatus;
  created_at: string;
  updated_at: string;
}

export interface Laborer {
  id: string;
  name: string;
  phone: string | null;
  category_id: string;
  role_id: string;
  employment_type: EmploymentType;
  daily_rate: number;
  team_id: string | null;
  status: LaborerStatus;
  joining_date: string;
  deactivation_date: string | null;
  deactivation_reason: string | null;
  // Payment ecosystem fields
  laborer_type?: LaborerType; // contract = Mesthri's team, daily_market = hired separately
  associated_team_id?: string | null; // Which Mesthri's team (optional)
  created_at: string;
  updated_at: string;
}

// Attendance & Work Tracking
export interface DailyAttendance {
  id: string;
  date: string;
  laborer_id: string;
  site_id: string;
  section_id: string | null;
  start_time: string | null;
  end_time: string | null;
  hours_worked: number | null;
  work_days: number;
  work_variance: WorkVariance | null;
  daily_rate_applied: number;
  daily_earnings: number;
  team_id: string | null;
  subcontract_id: string | null; // Renamed from contract_id
  entered_by: string;
  is_deleted: boolean;
  // Payment tracking fields (added for payment ecosystem)
  is_paid?: boolean;
  payment_id?: string | null;
  synced_to_expense?: boolean;
  recorded_by?: string;
  recorded_by_user_id?: string | null;
  // Time tracking fields (attendance redesign)
  in_time?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  out_time?: string | null;
  work_hours?: number | null;
  break_hours?: number | null;
  total_hours?: number | null;
  day_units?: number;
  // Snacks tracking
  snacks_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface SiteHoliday {
  id: string;
  site_id: string;
  date: string;
  reason: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  site_id: string;
  date: string;
  weather: string | null;
  is_holiday: boolean;
  general_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Subcontracts (Company ↔ Mesthri/Subcontractors)
// Note: Renamed from "contracts" to "subcontracts" for clarity
// "Contract" = Company ↔ Client (client pays company) - stored in clients table
// "Subcontract" = Company ↔ Mesthri/Subcontractors (company pays them)
export interface Subcontract {
  id: string;
  contract_type: ContractType;
  team_id: string | null;
  laborer_id: string | null;
  site_id: string;
  title: string;
  description: string | null;
  scope_of_work: string | null;
  total_value: number;
  measurement_unit: MeasurementUnit | null;
  rate_per_unit: number | null;
  total_units: number | null;
  weekly_advance_rate: number | null;
  start_date: string;
  expected_end_date: string | null;
  status: ContractStatus;
  is_rate_based: boolean;
  created_at: string;
  updated_at: string;
}

// Backwards compatibility alias
export type Contract = Subcontract;

export interface SubcontractMilestone {
  id: string;
  subcontract_id: string;
  name: string;
  amount: number;
  percentage: number | null;
  due_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

// Backwards compatibility alias
export type ContractMilestone = SubcontractMilestone;

// Financial Tables
export interface Advance {
  id: string;
  laborer_id: string;
  date: string;
  amount: number;
  transaction_type: TransactionType;
  payment_mode: PaymentMode;
  reason: string | null;
  given_by: string;
  deduction_status: DeductionStatus;
  deducted_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategory {
  id: string;
  module: ExpenseModule;
  name: string;
  is_recurring: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  module: ExpenseModule;
  category_id: string;
  date: string;
  amount: number;
  site_id: string | null;
  section_id: string | null;
  team_id: string | null;
  subcontract_id: string | null; // Renamed from contract_id
  vendor_name: string | null;
  description: string | null;
  payment_mode: PaymentMode;
  is_recurring: boolean;
  week_ending: string | null;
  is_cleared: boolean;
  entered_by: string | null;
  entered_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Tea Shop & Snacks Tracking System
// =====================================================

// Tea Shop Account (per-site shop management)
export interface TeaShopAccount {
  id: string;
  site_id: string;
  shop_name: string;
  owner_name: string | null;
  contact_phone: string | null;
  address: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Snack Item for JSON storage
export interface SnackItem {
  name: string;
  quantity: number;
  rate: number;
  total: number;
}

// Tea Shop Entry (daily tea/snacks purchase)
export interface TeaShopEntry {
  id: string;
  tea_shop_id: string;
  site_id: string;
  date: string;
  // Tea details
  tea_rounds: number;
  tea_people_count: number;
  tea_rate_per_round: number;
  tea_total: number;
  // Snacks details
  snacks_items: SnackItem[];
  snacks_total: number;
  // Total
  total_amount: number;
  // Market laborers consumption (anonymous group total)
  market_laborer_count?: number;
  market_laborer_tea_amount?: number;
  market_laborer_snacks_amount?: number;
  market_laborer_total?: number;
  // Non-working laborers (on leave but consumed)
  nonworking_laborer_count?: number;
  nonworking_laborer_total?: number;
  // Working laborers consumption
  working_laborer_count?: number;
  working_laborer_total?: number;
  // Audit fields
  notes: string | null;
  entered_by: string | null;
  created_at: string;
  updated_at?: string;
}

// Per-person consumption (optional detailed tracking)
export interface TeaShopConsumptionDetail {
  id: string;
  entry_id: string;
  laborer_id: string | null;
  laborer_name: string | null;
  laborer_type: string | null;
  tea_rounds: number;
  tea_amount: number;
  snacks_items: Record<string, number>;  // {vada: 2, bajji: 1}
  snacks_amount: number;
  total_amount: number;
  is_working: boolean;  // true = laborer was working that day, false = on leave but consumed
  created_at: string;
  updated_at?: string;
}

// Tea Shop Settlement (payment to shop)
export type TeaShopPayerType = 'site_engineer' | 'company_direct';

export interface TeaShopSettlement {
  id: string;
  tea_shop_id: string;
  // Period covered
  period_start: string;
  period_end: string;
  // Amounts
  entries_total: number;      // Total from entries in this period
  previous_balance: number;   // Carried forward from previous
  total_due: number;          // entries_total + previous_balance
  amount_paid: number;        // Amount paid in this settlement
  balance_remaining: number;  // Carries to next settlement
  // Payment details
  payment_date: string;
  payment_mode: PaymentMode;
  // Who paid
  payer_type: TeaShopPayerType;
  site_engineer_id: string | null;
  site_engineer_transaction_id: string | null;
  is_engineer_settled: boolean;
  // Link to subcontract (optional)
  subcontract_id: string | null;
  // Status
  status: string;  // completed, partial
  // Audit
  notes: string | null;
  recorded_by: string | null;
  recorded_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy alias for backwards compatibility
export type TeaShopClearance = TeaShopSettlement;

export interface SalaryPeriod {
  id: string;
  laborer_id: string;
  week_ending: string;
  week_start: string;
  total_days_worked: number;
  gross_earnings: number;
  advance_deductions: number;
  extras: number;
  net_payable: number;
  amount_paid: number;
  balance_due: number;
  status: SalaryStatus;
  site_breakdown: Json | null;
  calculated_by: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryPayment {
  id: string;
  salary_period_id: string;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  paid_by: string;
  is_team_payment: boolean;
  team_id: string | null;
  created_at: string;
}

export interface SubcontractPayment {
  id: string;
  subcontract_id: string; // Renamed from contract_id
  milestone_id: string | null;
  payment_type: PaymentType;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  paid_by: string;
  notes: string | null;
  // New payment ecosystem fields
  payment_channel?: "via_site_engineer" | "mesthri_at_office" | "company_direct_online";
  paid_by_user_id?: string | null;
  period_from_date?: string | null;
  period_to_date?: string | null;
  total_salary_for_period?: number | null;
  balance_after_payment?: number | null;
  site_engineer_transaction_id?: string | null;
  recorded_by?: string;
  recorded_by_user_id?: string | null;
  created_at: string;
}

// Backwards compatibility alias
export type ContractPayment = SubcontractPayment;

// ===============================================
// PAYMENT ECOSYSTEM TABLES
// ===============================================

// Site Engineer Wallet System (Company Level)
export interface SiteEngineerTransaction {
  id: string;
  user_id: string;
  transaction_type: SiteEngineerTransactionType;
  amount: number;
  transaction_date: string;
  site_id: string | null; // NULL for received/returned, REQUIRED for spent/own_money
  description: string | null;
  recipient_type: RecipientType | null;
  recipient_id: string | null;
  payment_mode: PaymentMode;
  proof_url: string | null;
  related_attendance_id: string | null;
  related_subcontract_id: string | null;
  is_settled: boolean;
  settled_date: string | null;
  settled_by: string | null;
  notes: string | null;
  recorded_by: string;
  recorded_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Site Engineer Settlements (Reimbursements)
export interface SiteEngineerSettlement {
  id: string;
  site_engineer_id: string;
  settlement_date: string;
  amount: number;
  settlement_type: SettlementType;
  payment_mode: PaymentMode;
  proof_url: string | null;
  transactions_covered: string[]; // Array of transaction IDs being settled
  notes: string | null;
  recorded_by: string;
  recorded_by_user_id: string | null;
  created_at: string;
}

// Individual Labor Payments (for daily market laborers paid directly)
export interface LaborPayment {
  id: string;
  laborer_id: string;
  site_id: string;
  subcontract_id: string | null; // NULL if general work
  amount: number;
  payment_date: string;
  payment_for_date: string; // Which work day this covers
  payment_mode: PaymentMode;
  payment_channel: PaymentChannel;
  paid_by: string;
  paid_by_user_id: string | null;
  site_engineer_transaction_id: string | null;
  proof_url: string | null;
  is_under_contract: boolean;
  attendance_id: string | null;
  recorded_by: string;
  recorded_by_user_id: string | null;
  created_at: string;
}

// Attendance to Expense Sync Tracking
export interface AttendanceExpenseSync {
  id: string;
  attendance_date: string;
  site_id: string;
  expense_id: string | null; // Link to created expense
  total_laborers: number;
  total_work_days: number;
  total_amount: number;
  synced_by: string;
  synced_by_user_id: string | null;
  synced_at: string;
}

// Market Laborer Attendance (aggregate tracking for anonymous daily workers)
// Used when we can't track individual laborers from the market - just counts by role
export interface MarketLaborerAttendance {
  id: string;
  site_id: string;
  section_id: string | null;
  date: string;
  role_id: string; // References labor_roles (Male Helper, Female Helper, etc.)
  count: number; // Number of workers in this role
  work_days: number; // 1, 0.5, 1.5, 2 etc.
  rate_per_person: number; // Daily rate for this role
  total_cost: number; // count × rate × work_days
  notes: string | null;
  entered_by: string;
  entered_by_user_id: string | null;
  // Time tracking fields (group-level for anonymous workers)
  in_time?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  out_time?: string | null;
  work_hours?: number | null;
  break_hours?: number | null;
  total_hours?: number | null;
  day_units?: number;
  // Snacks tracking
  snacks_per_person?: number;
  total_snacks?: number;
  created_at: string;
  updated_at: string;
}

// Daily Work Summary (per site per date - work description, status, comments)
export interface DailyWorkSummary {
  id: string;
  site_id: string;
  date: string;
  // Work description fields (same for all laborers on this day)
  work_description: string | null;
  work_status: string | null;
  comments: string | null;
  // Aggregated time info (earliest in, latest out)
  first_in_time: string | null;
  last_out_time: string | null;
  // Aggregated laborer counts by type
  daily_laborer_count: number;
  contract_laborer_count: number;
  market_laborer_count: number;
  total_laborer_count: number;
  // Aggregated amounts
  total_salary: number;
  total_snacks: number;
  total_expense: number;
  // Default snacks amount per person for this day
  default_snacks_per_person: number;
  // Audit fields
  entered_by: string | null;
  entered_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// System Tables
export interface DeletionRequest {
  id: string;
  table_name: string;
  record_id: string;
  record_summary: string;
  reason: string | null;
  requested_by: string;
  status: DeletionRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_data: Json | null;
  new_data: Json | null;
  changed_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface ImportLog {
  id: string;
  import_type: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  error_details: Json | null;
  imported_by: string;
  created_at: string;
}

// View Types
export interface VActiveAttendance extends DailyAttendance {
  laborer_name: string;
  laborer_phone: string | null;
  category_name: string;
  role_name: string;
  team_name: string | null;
  site_name: string;
  section_name: string | null;
}

export interface VSiteDailySummary {
  site_id: string;
  site_name: string;
  date: string;
  total_laborers: number;
  total_work_days: number;
  total_cost: number;
}

export interface VSiteDailyByCategory {
  site_id: string;
  site_name: string;
  date: string;
  category_name: string;
  laborer_count: number;
  total_work_days: number;
  total_cost: number;
}

export interface VSectionCostSummary {
  site_id: string;
  site_name: string;
  section_id: string;
  section_name: string;
  total_work_days: number;
  total_cost: number;
}

export interface VTeamWeeklySummary {
  team_id: string;
  team_name: string;
  week_ending: string;
  total_members: number;
  total_work_days: number;
  gross_earnings: number;
}

export interface VPendingAdvances {
  laborer_id: string;
  laborer_name: string;
  total_advances: number;
  total_deducted: number;
  pending_amount: number;
}

export interface VSalaryPeriodsDetailed extends SalaryPeriod {
  laborer_name: string;
  laborer_phone: string | null;
  team_name: string | null;
}

export interface VSubcontractSummary extends Subcontract {
  total_paid: number;
  balance_due: number;
  payment_percentage: number;
}

// Backwards compatibility alias
export type VContractSummary = VSubcontractSummary;

// Database interface
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>;
      };
      sites: {
        Row: Site;
        Insert: Omit<Site, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Site, "id" | "created_at" | "updated_at">>;
      };
      building_sections: {
        Row: BuildingSection;
        Insert: Omit<BuildingSection, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<BuildingSection, "id" | "created_at" | "updated_at">
        >;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Client, "id" | "created_at" | "updated_at">>;
      };
      labor_categories: {
        Row: LaborCategory;
        Insert: Omit<LaborCategory, "id" | "created_at">;
        Update: Partial<Omit<LaborCategory, "id" | "created_at">>;
      };
      labor_roles: {
        Row: LaborRole;
        Insert: Omit<LaborRole, "id" | "created_at">;
        Update: Partial<Omit<LaborRole, "id" | "created_at">>;
      };
      teams: {
        Row: Team;
        Insert: Omit<Team, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Team, "id" | "created_at" | "updated_at">>;
      };
      laborers: {
        Row: Laborer;
        Insert: Omit<Laborer, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Laborer, "id" | "created_at" | "updated_at">>;
      };
      daily_attendance: {
        Row: DailyAttendance;
        Insert: Omit<DailyAttendance, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<DailyAttendance, "id" | "created_at" | "updated_at">
        >;
      };
      site_holidays: {
        Row: SiteHoliday;
        Insert: Omit<SiteHoliday, "id" | "created_at">;
        Update: Partial<Omit<SiteHoliday, "id" | "created_at">>;
      };
      daily_logs: {
        Row: DailyLog;
        Insert: Omit<DailyLog, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<DailyLog, "id" | "created_at" | "updated_at">>;
      };
      // Renamed from 'contracts' to 'subcontracts'
      subcontracts: {
        Row: Subcontract;
        Insert: Omit<Subcontract, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Subcontract, "id" | "created_at" | "updated_at">>;
      };
      // Renamed from 'contract_milestones' to 'subcontract_milestones'
      subcontract_milestones: {
        Row: SubcontractMilestone;
        Insert: Omit<SubcontractMilestone, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<SubcontractMilestone, "id" | "created_at" | "updated_at">
        >;
      };
      advances: {
        Row: Advance;
        Insert: Omit<Advance, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Advance, "id" | "created_at" | "updated_at">>;
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: Omit<ExpenseCategory, "id" | "created_at">;
        Update: Partial<Omit<ExpenseCategory, "id" | "created_at">>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Expense, "id" | "created_at" | "updated_at">>;
      };
      tea_shop_accounts: {
        Row: TeaShopAccount;
        Insert: Omit<TeaShopAccount, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<TeaShopAccount, "id" | "created_at" | "updated_at">
        >;
      };
      tea_shop_entries: {
        Row: TeaShopEntry;
        Insert: Omit<TeaShopEntry, "id" | "created_at">;
        Update: Partial<Omit<TeaShopEntry, "id" | "created_at">>;
      };
      tea_shop_consumption_details: {
        Row: TeaShopConsumptionDetail;
        Insert: Omit<TeaShopConsumptionDetail, "id" | "created_at">;
        Update: Partial<Omit<TeaShopConsumptionDetail, "id" | "created_at">>;
      };
      tea_shop_settlements: {
        Row: TeaShopSettlement;
        Insert: Omit<TeaShopSettlement, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<TeaShopSettlement, "id" | "created_at" | "updated_at">>;
      };
      // Legacy alias
      tea_shop_clearances: {
        Row: TeaShopClearance;
        Insert: Omit<TeaShopClearance, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<TeaShopClearance, "id" | "created_at" | "updated_at">>;
      };
      salary_periods: {
        Row: SalaryPeriod;
        Insert: Omit<SalaryPeriod, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SalaryPeriod, "id" | "created_at" | "updated_at">>;
      };
      salary_payments: {
        Row: SalaryPayment;
        Insert: Omit<SalaryPayment, "id" | "created_at">;
        Update: Partial<Omit<SalaryPayment, "id" | "created_at">>;
      };
      // Renamed from 'contract_payments' to 'subcontract_payments'
      subcontract_payments: {
        Row: SubcontractPayment;
        Insert: Omit<SubcontractPayment, "id" | "created_at">;
        Update: Partial<Omit<SubcontractPayment, "id" | "created_at">>;
      };
      // Payment Ecosystem Tables
      site_engineer_transactions: {
        Row: SiteEngineerTransaction;
        Insert: Omit<SiteEngineerTransaction, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SiteEngineerTransaction, "id" | "created_at" | "updated_at">>;
      };
      site_engineer_settlements: {
        Row: SiteEngineerSettlement;
        Insert: Omit<SiteEngineerSettlement, "id" | "created_at">;
        Update: Partial<Omit<SiteEngineerSettlement, "id" | "created_at">>;
      };
      labor_payments: {
        Row: LaborPayment;
        Insert: Omit<LaborPayment, "id" | "created_at">;
        Update: Partial<Omit<LaborPayment, "id" | "created_at">>;
      };
      attendance_expense_sync: {
        Row: AttendanceExpenseSync;
        Insert: Omit<AttendanceExpenseSync, "id" | "synced_at">;
        Update: Partial<Omit<AttendanceExpenseSync, "id" | "synced_at">>;
      };
      market_laborer_attendance: {
        Row: MarketLaborerAttendance;
        Insert: Omit<MarketLaborerAttendance, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<MarketLaborerAttendance, "id" | "created_at" | "updated_at">>;
      };
      daily_work_summary: {
        Row: DailyWorkSummary;
        Insert: Omit<DailyWorkSummary, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<DailyWorkSummary, "id" | "created_at" | "updated_at">>;
      };
      deletion_requests: {
        Row: DeletionRequest;
        Insert: Omit<DeletionRequest, "id" | "created_at">;
        Update: Partial<Omit<DeletionRequest, "id" | "created_at">>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at">;
        Update: Partial<Omit<AuditLog, "id" | "created_at">>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at">;
        Update: Partial<Omit<Notification, "id" | "created_at">>;
      };
      import_logs: {
        Row: ImportLog;
        Insert: Omit<ImportLog, "id" | "created_at">;
        Update: Partial<Omit<ImportLog, "id" | "created_at">>;
      };
    };
    Views: {
      v_active_attendance: {
        Row: VActiveAttendance;
      };
      v_site_daily_summary: {
        Row: VSiteDailySummary;
      };
      v_site_daily_by_category: {
        Row: VSiteDailyByCategory;
      };
      v_section_cost_summary: {
        Row: VSectionCostSummary;
      };
      v_team_weekly_summary: {
        Row: VTeamWeeklySummary;
      };
      v_pending_advances: {
        Row: VPendingAdvances;
      };
      v_salary_periods_detailed: {
        Row: VSalaryPeriodsDetailed;
      };
      // Renamed from 'v_contract_summary' to 'v_subcontract_summary'
      v_subcontract_summary: {
        Row: VSubcontractSummary;
      };
    };
    Functions: {
      calculate_salary_period: {
        Args: {
          p_laborer_id: string;
          p_week_ending: string;
          p_calculated_by: string;
        };
        Returns: string;
      };
      get_site_dashboard: {
        Args: {
          p_site_id: string;
          p_date: string;
        };
        Returns: Json;
      };
      get_site_dashboard_detailed: {
        Args: {
          p_site_id: string;
          p_date: string;
        };
        Returns: Json;
      };
      get_week_attendance_summary: {
        Args: {
          p_site_id: string;
          p_week_ending: string;
        };
        Returns: any[];
      };
      get_team_weekly_summary: {
        Args: {
          p_team_id: string;
          p_week_ending: string;
        };
        Returns: Json;
      };
      get_monthly_report: {
        Args: {
          p_site_id: string;
          p_year: number;
          p_month: number;
        };
        Returns: Json;
      };
      request_deletion: {
        Args: {
          p_table_name: string;
          p_record_id: string;
          p_requested_by: string;
          p_reason: string;
        };
        Returns: string;
      };
      approve_deletion: {
        Args: {
          p_request_id: string;
          p_reviewed_by: string;
          p_notes: string | null;
        };
        Returns: boolean;
      };
      reject_deletion: {
        Args: {
          p_request_id: string;
          p_reviewed_by: string;
          p_notes: string | null;
        };
        Returns: boolean;
      };
    };
  };
}
