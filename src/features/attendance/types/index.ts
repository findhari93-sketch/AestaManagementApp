/**
 * Type definitions for the Attendance feature
 * Extracted from attendance-content.tsx for better organization
 */

import type { LaborerType, DailyWorkSummary } from "@/types/database.types";
import type { WorkUpdates } from "@/types/work-updates.types";
import type { AttendancePageData } from "@/lib/data/attendance";

export interface AttendanceContentProps {
  initialData: AttendancePageData | null;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  laborer_id: string;
  laborer_name: string;
  laborer_type: LaborerType;
  category_name: string;
  role_name: string;
  team_name: string | null;
  section_name: string;
  work_days: number;
  hours_worked: number;
  daily_rate_applied: number;
  daily_earnings: number;
  is_paid: boolean;
  payment_notes?: string | null;
  subcontract_title?: string | null;
  // Payment/settlement fields
  engineer_transaction_id?: string | null;
  expense_id?: string | null;
  paid_via?: string | null;
  // Time tracking fields
  in_time?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  out_time?: string | null;
  work_hours?: number | null;
  break_hours?: number | null;
  total_hours?: number | null;
  day_units?: number;
  snacks_amount?: number;
  // Two-phase attendance fields
  attendance_status?: "morning_entry" | "confirmed" | "draft" | null;
  work_progress_percent?: number | null;
  // Audit tracking fields
  entered_by?: string | null;
  entered_by_user_id?: string | null;
  entered_by_avatar?: string | null;
  updated_by?: string | null;
  updated_by_user_id?: string | null;
  updated_by_avatar?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeaShopData {
  teaTotal: number;
  snacksTotal: number;
  total: number;
  workingCount: number;
  workingTotal: number;
  nonWorkingCount: number;
  nonWorkingTotal: number;
  marketCount: number;
  marketTotal: number;
  // Group entry tracking
  isGroupEntry?: boolean;
  entryId?: string;
}

// Expanded market laborer record (individual rows like "Mason 1", "Mason 2")
export interface MarketLaborerRecord {
  id: string;
  originalDbId: string; // The actual DB record ID from market_laborer_attendance
  roleId: string; // The role_id from the DB
  date: string;
  tempName: string; // e.g., "Mason 1", "Mason 2"
  categoryName: string;
  roleName: string;
  index: number; // 1, 2, 3 within category
  workDays: number;
  dayUnits: number;
  ratePerPerson: number;
  dailyEarnings: number;
  snacksAmount: number;
  inTime: string | null;
  outTime: string | null;
  isPaid: boolean;
  paidAmount: number;
  pendingAmount: number;
  groupCount: number; // Total count in this group (for edit reference)
  paymentNotes: string | null;
  engineerTransactionId: string | null; // For settlement tracking
  expenseId: string | null; // For direct payment tracking
}

export interface DateSummary {
  date: string;
  records: AttendanceRecord[];
  marketLaborers: MarketLaborerRecord[]; // Expanded market laborer rows
  // Laborer counts by type
  dailyLaborerCount: number;
  contractLaborerCount: number;
  marketLaborerCount: number;
  totalLaborerCount: number;
  // Times
  firstInTime: string | null;
  lastOutTime: string | null;
  // Amounts
  totalSalary: number;
  totalSnacks: number;
  totalExpense: number;
  // Amounts by laborer type
  dailyLaborerAmount: number;
  contractLaborerAmount: number;
  marketLaborerAmount: number;
  // Payment breakdown
  paidCount: number;
  pendingCount: number;
  paidAmount: number;
  pendingAmount: number;
  // Work description
  workDescription: string | null;
  workStatus: string | null;
  comments: string | null;
  // Work updates with photos
  workUpdates: WorkUpdates | null;
  // Category breakdown
  categoryBreakdown: { [key: string]: { count: number; amount: number } };
  isExpanded?: boolean;
  // Tea shop data
  teaShop: TeaShopData | null;
  // Two-phase attendance status
  attendanceStatus: "morning_entry" | "confirmed" | "mixed" | "draft";
  workProgressPercent: number;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  weekLabel: string; // "Dec 8 - Dec 14, 2024"
  totalLaborers: number;
  totalWorkDays: number;
  // Pending amounts by type
  pendingDailySalary: number;
  pendingContractSalary: number;
  pendingMarketSalary: number;
  teaShopExpenses: number;
  totalPending: number;
  // Contract laborers for weekly settlement
  contractLaborerIds: string[];
  // Flag for current/ongoing week
  isCurrentWeek: boolean;
}

// View mode type
export type ViewMode = "date-wise" | "detailed";

// Drawer mode type
export type DrawerMode = "morning" | "evening" | "full";

// Holiday dialog mode type
export type HolidayDialogMode = "add" | "edit" | "remove" | "view";
