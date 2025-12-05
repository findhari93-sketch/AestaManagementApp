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

// Core Tables
export interface User {
  id: string;
  auth_id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  assigned_sites: string[] | null;
  status: UserStatus;
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
  contract_id: string | null;
  entered_by: string;
  is_deleted: boolean;
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

// Contracts
export interface Contract {
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

export interface ContractMilestone {
  id: string;
  contract_id: string;
  name: string;
  amount: number;
  percentage: number | null;
  due_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

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
  contract_id: string | null;
  vendor_name: string | null;
  description: string | null;
  payment_mode: PaymentMode;
  is_recurring: boolean;
  week_ending: string | null;
  is_cleared: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeaShopAccount {
  id: string;
  shop_name: string;
  owner_name: string;
  contact_phone: string;
  site_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeaShopEntry {
  id: string;
  tea_shop_id: string;
  date: string;
  amount: number;
  num_people: number | null;
  num_rounds: number | null;
  created_at: string;
}

export interface TeaShopClearance {
  id: string;
  tea_shop_id: string;
  week_start: string;
  week_end: string;
  total_amount: number;
  amount_paid: number;
  payment_date: string;
  payment_mode: PaymentMode;
  created_at: string;
}

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

export interface ContractPayment {
  id: string;
  contract_id: string;
  milestone_id: string | null;
  payment_type: PaymentType;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  paid_by: string;
  notes: string | null;
  created_at: string;
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

export interface VContractSummary extends Contract {
  total_paid: number;
  balance_due: number;
  payment_percentage: number;
}

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
      contracts: {
        Row: Contract;
        Insert: Omit<Contract, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Contract, "id" | "created_at" | "updated_at">>;
      };
      contract_milestones: {
        Row: ContractMilestone;
        Insert: Omit<ContractMilestone, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<ContractMilestone, "id" | "created_at" | "updated_at">
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
      tea_shop_clearances: {
        Row: TeaShopClearance;
        Insert: Omit<TeaShopClearance, "id" | "created_at">;
        Update: Partial<Omit<TeaShopClearance, "id" | "created_at">>;
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
      contract_payments: {
        Row: ContractPayment;
        Insert: Omit<ContractPayment, "id" | "created_at">;
        Update: Partial<Omit<ContractPayment, "id" | "created_at">>;
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
      v_contract_summary: {
        Row: VContractSummary;
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
