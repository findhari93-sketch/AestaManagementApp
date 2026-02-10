/**
 * Chat Assistant Constants
 * Intent keywords, quick actions, and date patterns
 */

import type { IntentKeywords, QuickAction } from "./types";

// ============================================================================
// Intent Keywords
// Maps intent names to arrays of trigger keywords (including Tamil)
// ============================================================================

export const INTENT_KEYWORDS: IntentKeywords = {
  // Salary related
  total_salary: [
    "salary",
    "wages",
    "pay",
    "earning",
    "payable",
    "net payable",
    "gross",
    "சம்பளம்",
    "ஊதியம்",
  ],
  total_salary_paid: [
    "salary paid",
    "wages paid",
    "paid salary",
    "payment made",
    "amount paid",
    "disbursed",
  ],
  salary_pending: [
    "pending salary",
    "unpaid salary",
    "due salary",
    "balance due",
    "salary balance",
    "outstanding salary",
  ],

  // Attendance related
  attendance_count: [
    "attendance",
    "present",
    "came",
    "working",
    "workers today",
    "how many workers",
    "வருகை",
    "present count",
  ],
  attendance_summary: [
    "attendance summary",
    "attendance breakdown",
    "daily attendance",
    "attendance report",
    "attendance list",
  ],

  // Spending & Expenses
  total_spending: [
    "spending",
    "spent",
    "total cost",
    "expenditure",
    "total expenditure",
    "overall cost",
    "செலவு",
  ],
  expense_total: [
    "expense",
    "expenses",
    "costs",
    "expense amount",
    "how much expense",
    "total expense",
    "all expenses",
  ],
  expense_by_category: [
    "expense breakdown",
    "category wise expense",
    "expense category",
    "expense by category",
    "expense split",
  ],
  // Material specific
  material_expenses: [
    "material expense",
    "material expenses",
    "material cost",
    "material purchase",
    "material purchases",
    "material spending",
    "materials cost",
  ],
  // Labor specific
  labor_expenses: [
    "labor expense",
    "labor expenses",
    "labor cost",
    "labour expense",
    "labour expenses",
    "labour cost",
    "salary expense",
    "wage expense",
  ],
  // Machinery specific
  machinery_expenses: [
    "machinery expense",
    "machinery expenses",
    "machinery cost",
    "equipment expense",
    "equipment expenses",
    "equipment cost",
    "rental expense",
  ],

  // Advances
  advance_total: [
    "advance",
    "advances given",
    "total advance",
    "advance amount",
    "முன்பணம்",
  ],
  advance_pending: [
    "pending advance",
    "unpaid advance",
    "advance balance",
    "advance due",
    "outstanding advance",
  ],

  // Contracts
  contract_summary: [
    "contract",
    "subcontract",
    "active contract",
    "contract status",
    "contract list",
    "mesthri contract",
  ],
  contract_payments_total: [
    "contract payment",
    "settlement",
    "milestone",
    "contract settlement",
    "contract paid",
  ],

  // Laborers
  laborer_count: [
    "worker count",
    "laborer count",
    "how many workers",
    "active workers",
    "total workers",
    "workforce",
  ],
  laborer_by_category: [
    "category wise worker",
    "mason count",
    "helper count",
    "worker by category",
    "role wise",
  ],
  laborer_earnings: [
    "top earning",
    "worker earnings",
    "who earned",
    "highest earner",
    "most earning",
    "earning workers",
  ],

  // Tea Shop
  tea_shop_balance: [
    "tea",
    "tea shop",
    "snacks",
    "tea balance",
    "tea pending",
    "டீ",
    "டீக்கடை",
  ],

  // Teams
  team_summary: [
    "team",
    "mesthri",
    "team wise",
    "team summary",
    "team earnings",
  ],

  // Daily Cost
  daily_cost: [
    "today cost",
    "daily cost",
    "day cost",
    "today's expense",
    "daily expense",
  ],

  // Holidays
  holiday_list: ["holiday", "holidays", "site holiday", "holiday list", "off day"],

  // Work Days Summary (Overtime)
  work_days_summary: [
    "overtime",
    "1.5 days",
    "2 days",
    "extra work",
    "double shift",
    "overtime workers",
  ],
};

// ============================================================================
// Quick Actions
// Pre-built query chips for common questions
// ============================================================================

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Today's Attendance", query: "How many workers came today?" },
  { label: "This Week's Salary", query: "Total salary this week" },
  { label: "Pending Advances", query: "Pending advances" },
  { label: "Monthly Expenses", query: "Total expenses this month" },
  { label: "Active Workers", query: "How many active laborers" },
  { label: "Contract Payments", query: "Contract payments this month" },
  { label: "Tea Shop Balance", query: "Tea shop balance" },
  { label: "Top Earners", query: "Top 5 earning workers this week" },
];

// ============================================================================
// Date Patterns
// Regex patterns for extracting dates from natural language
// ============================================================================

export const DATE_PATTERNS = {
  // Relative dates
  today: /\b(today|இன்று)\b/i,
  yesterday: /\b(yesterday|நேற்று)\b/i,
  thisWeek: /\b(this week|current week|இந்த வாரம்)\b/i,
  lastWeek: /\b(last week|previous week|கடந்த வாரம்)\b/i,
  thisMonth: /\b(this month|current month|இந்த மாதம்)\b/i,
  lastMonth: /\b(last month|previous month|கடந்த மாதம்)\b/i,
  thisYear: /\b(this year|current year)\b/i,

  // Month names (English)
  january: /\b(january|jan)\b/i,
  february: /\b(february|feb)\b/i,
  march: /\b(march|mar)\b/i,
  april: /\b(april|apr)\b/i,
  may: /\b(may)\b/i,
  june: /\b(june|jun)\b/i,
  july: /\b(july|jul)\b/i,
  august: /\b(august|aug)\b/i,
  september: /\b(september|sep|sept)\b/i,
  october: /\b(october|oct)\b/i,
  november: /\b(november|nov)\b/i,
  december: /\b(december|dec)\b/i,

  // Date ranges
  dateRange: /(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-)\s*(\d{1,2})(?:st|nd|rd|th)?/i,
  isoRange: /(\d{4}-\d{2}-\d{2})\s*(?:to|-)\s*(\d{4}-\d{2}-\d{2})/i,
  specificDate: /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/,
};

// ============================================================================
// Month Number Mapping
// ============================================================================

export const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

// ============================================================================
// Labor Categories
// Common labor category keywords for entity extraction
// ============================================================================

export const LABOR_CATEGORIES = [
  "mason",
  "helper",
  "centring",
  "carpenter",
  "plumber",
  "electrician",
  "painter",
  "welder",
  "fitter",
  "operator",
  "driver",
  "supervisor",
  "foreman",
];

// ============================================================================
// Intent Confidence Thresholds
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.6, // Execute query directly
  LOW: 0.3, // Ask for confirmation
  UNKNOWN: 0.3, // Below this, show suggestions
};

// ============================================================================
// Welcome Message
// ============================================================================

export const WELCOME_MESSAGE =
  "Hi! I'm your AESTA Assistant. Ask me about attendance, salary, expenses, or contracts. Use the quick actions below to get started!";
