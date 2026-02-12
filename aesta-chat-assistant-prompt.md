# AESTA App — Smart Chat Assistant Implementation Prompt

## Overview

Add a **Chat Assistant** feature to the AESTA Construction Labor Management App. This chat interface allows users to ask natural language questions about their construction data (labor salary, attendance, expenses, contracts, etc.) and get instant answers — without navigating to individual pages.

**The assistant queries the existing Supabase database directly. No external AI API is needed.** This is a keyword/intent-based query engine with a chat UI.

---

## Tech Stack (Must Match Existing App)

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL) — already configured in the project
- **UI Library**: Material UI (MUI)
- **Language**: TypeScript
- **State**: React hooks / context (match existing patterns in the app)

> **Important**: Read the existing project structure, Supabase client setup, auth patterns, and site-selector context before writing any code. Reuse all existing utilities, types, and Supabase client instances. Do NOT create duplicate Supabase clients or auth logic.

---

## Database Schema Reference

The app already has these tables. **Do NOT create or modify any tables.** Only read from them.

### Core Tables

```
users (id, email, name, phone, role, assigned_sites, status)
sites (id, name, location, status)
building_sections (id, site_id, name)
labor_categories (id, name) — e.g., Mason, Helper, Centring
labor_roles (id, category_id, name, default_daily_rate)
teams (id, name, leader_name, leader_phone, status)
laborers (id, name, phone, category_id, role_id, employment_type, daily_rate, team_id, status, site_id, joining_date)
```

### Attendance & Work

```
daily_attendance (id, date, laborer_id, site_id, section_id, work_days, daily_rate_applied, daily_earnings, team_id, contract_id, entered_by, is_deleted)
  — work_days: 0.5 | 1 | 1.5 | 2
  — daily_earnings = work_days × daily_rate_applied (auto-calculated)

site_holidays (id, site_id, date, reason)
daily_work_summary (id, site_id, date, summary_text)
```

### Financial

```
advances (id, laborer_id, date, amount, transaction_type, payment_mode, reason, given_by, deduction_status, deducted_amount)
  — transaction_type: 'advance' | 'extra'
  — deduction_status: 'pending' | 'partial' | 'deducted' | 'written_off'

expenses (id, site_id, category_id, amount, date, description, payment_mode, paid_by)
expense_categories (id, module, name, is_recurring)

salary_periods (id, laborer_id, week_start, week_end, gross_earnings, total_deductions, total_additions, net_payable, amount_paid, balance_due, status)
salary_payments (id, salary_period_id, amount, payment_date, payment_mode, paid_by)
```

### Contracts

```
contracts (id, contract_type, team_id, laborer_id, site_id, title, total_value, measurement_unit, rate_per_unit, total_units, weekly_advance_rate, start_date, expected_end_date, status)
  — contract_type: 'mesthri' | 'specialist'

contract_milestones (id, contract_id, name, amount, percentage, due_date, status)
contract_payments (id, contract_id, milestone_id, payment_type, amount, payment_date, payment_mode, paid_by)
  — payment_type: 'weekly_advance' | 'milestone'
```

### Tea Shop

```
tea_shop_accounts (id, site_id, shop_name, status)
tea_shop_entries (id, account_id, date, amount, description)
```

---

## Feature Requirements

### 1. Chat UI Component

Create a floating chat button (FAB) on the bottom-right corner of the app. When clicked, it opens a chat drawer/dialog.

**UI Specifications:**
- **FAB Button**: MUI Fab with a chat/assistant icon, positioned bottom-right (`position: fixed, bottom: 80px, right: 16px` — above any existing bottom nav)
- **Chat Panel**: MUI Drawer (anchor: right, width: 400px on desktop) or full-screen Dialog on mobile
- **Header**: "AESTA Assistant" with close button
- **Filter Bar** (below header):
  - Site selector dropdown (pre-filled with user's current selected site from app context)
  - Toggle: "This Site" / "All Sites"
  - Date range picker (MUI DatePicker — from/to)
- **Message Area**: Scrollable list of chat bubbles
  - User messages: right-aligned, primary color background
  - Assistant messages: left-aligned, grey background
  - Support for text, tables (simple MUI Table inside bubble), and number highlights
- **Quick Action Chips**: Scrollable row of suggested queries (MUI Chip components)
- **Input Area**: TextField with send button, supports Enter to send

**Quick Action Chips (predefined queries):**
```
"Today's Attendance Count"
"This Week's Total Salary"
"Pending Advances"
"Total Expenses This Month"
"Active Laborers Count"
"Contract Payments Summary"
"Tea Shop Balance"
"Top Earning Workers"
```

### 2. Query Engine (Intent Parser + Supabase Query Runner)

This is the core logic. **No AI API needed.** Build a pattern-matching intent parser.

#### Architecture

```
User Input (text)
    ↓
Intent Parser (keyword matching + entity extraction)
    ↓
Returns: { intent: string, filters: { site_id?, date_from?, date_to?, laborer_name?, team_name?, category? } }
    ↓
Query Builder (maps intent → Supabase query)
    ↓
Execute Query against Supabase
    ↓
Response Formatter (formats result into chat message)
    ↓
Display in chat
```

#### Supported Intents (implement all of these)

| Intent ID | Example Questions | Supabase Query |
|-----------|-------------------|----------------|
| `total_salary` | "Total salary this week", "How much salary paid this month" | `salary_periods` → SUM(net_payable) with date filters |
| `total_salary_paid` | "How much salary was actually paid" | `salary_payments` → SUM(amount) with date filters |
| `salary_pending` | "Pending salary", "Unpaid salary" | `salary_periods` WHERE status != 'paid' → SUM(balance_due) |
| `attendance_count` | "Today's attendance", "How many workers came today" | `daily_attendance` → COUNT(DISTINCT laborer_id) WHERE date & site filters |
| `attendance_summary` | "Attendance summary this week" | `daily_attendance` → GROUP BY date, COUNT workers, SUM earnings |
| `total_spending` | "Total spending from Jan to Mar", "How much spent this month" | SUM of salary_payments + expenses + contract_payments + advances with date range |
| `expense_total` | "Total expenses this month", "How much on expenses" | `expenses` → SUM(amount) with filters |
| `expense_by_category` | "Expense breakdown", "Category wise expenses" | `expenses` JOIN `expense_categories` → GROUP BY category, SUM(amount) |
| `advance_total` | "Total advances given", "Pending advances" | `advances` → SUM(amount) with transaction_type and status filters |
| `advance_pending` | "Unpaid advances", "Pending advance deductions" | `advances` WHERE deduction_status IN ('pending', 'partial') → SUM(amount - deducted_amount) |
| `contract_summary` | "Contract status", "Active contracts" | `contracts` with status filter, include total_value |
| `contract_payments_total` | "Contract payments this month", "Settlement amount" | `contract_payments` → SUM(amount) with date filters |
| `laborer_count` | "How many active laborers", "Worker count" | `laborers` → COUNT with status='active' and site filter |
| `laborer_by_category` | "Category wise worker count", "How many masons" | `laborers` → GROUP BY category, COUNT |
| `laborer_earnings` | "Top earning workers", "Worker X total earnings" | `daily_attendance` → GROUP BY laborer_id, SUM(daily_earnings) |
| `tea_shop_balance` | "Tea shop total", "Tea shop pending" | `tea_shop_entries` → SUM(amount) with site filter |
| `team_summary` | "Team wise summary", "Mesthri team details" | `teams` with laborer count and total earnings |
| `daily_cost` | "Today's cost", "Daily cost breakdown" | `daily_attendance` SUM(daily_earnings) for date + expenses for date |
| `holiday_list` | "Holidays this month", "Site holidays" | `site_holidays` with date range and site filter |
| `work_days_summary` | "Overtime workers", "Who did 1.5 or 2 days" | `daily_attendance` WHERE work_days > 1 with date filter |

#### Intent Parser Implementation Rules

```typescript
// The parser should:
// 1. Normalize input: lowercase, trim, remove extra spaces
// 2. Check for keywords to determine intent
// 3. Extract entities: dates, names, categories, amounts

// Keyword mappings (use these patterns):
const INTENT_KEYWORDS = {
  total_salary: ['salary', 'wages', 'pay', 'earning', 'சம்பளம்'],
  attendance_count: ['attendance', 'present', 'came', 'working', 'வருகை'],
  total_spending: ['spending', 'spent', 'total cost', 'expenditure', 'செலவு'],
  expense_total: ['expense', 'expenses', 'cost'],
  advance_total: ['advance', 'advances', 'முன்பணம்'],
  contract_payments_total: ['contract', 'settlement', 'milestone'],
  laborer_count: ['how many workers', 'laborer count', 'worker count', 'active workers'],
  tea_shop_balance: ['tea', 'tea shop', 'snacks', 'டீ'],
  // ... more mappings
};

// Date extraction patterns:
// "today" → today's date
// "yesterday" → yesterday's date
// "this week" → current week Mon-Sun
// "last week" → previous week
// "this month" → current month 1st to today
// "last month" → previous month
// "January", "Jan" → that month of current year
// "from 1st to 15th" → date range extraction
// "2025-01-01 to 2025-01-31" → exact date range

// Tamil keyword support (optional but nice):
// சம்பளம் = salary, வருகை = attendance, செலவு = expense, முன்பணம் = advance
```

#### Query Builder Rules

```typescript
// Every query MUST respect:
// 1. Site filter — if user selected "This Site", always add site_id filter
// 2. Date range — if user specified dates, add date filters
// 3. is_deleted — always filter out deleted records (is_deleted = false or is_deleted IS NULL)
// 4. Use the existing Supabase client from the project (don't create a new one)

// Example query for total_salary intent:
// supabase
//   .from('salary_periods')
//   .select('net_payable')
//   .gte('week_start', dateFrom)
//   .lte('week_end', dateTo)
//   .eq('site_id_via_laborer', siteId) // may need join
//   .then(data => data.reduce((sum, r) => sum + r.net_payable, 0))
```

#### Response Formatter Rules

```typescript
// Format responses in a user-friendly way:
// - Always include the time period in the response
// - Always include the site name if site-specific
// - Format currency as ₹XX,XXX (Indian format with commas)
// - For counts, use simple text
// - For breakdowns, return a simple table (array of {label, value})
// - For lists, limit to top 10 with "and X more" message

// Example responses:
// "Total salary for Site Madurai (Jan 2025): ₹4,52,300"
// "Today's attendance at Site Pudukkottai: 24 workers present"
// "Expense breakdown this month:" + table [{category: "Transportation", amount: "₹12,000"}, ...]
```

### 3. File Structure

Create these files (adjust paths to match existing project structure):

```
src/
├── components/
│   └── chat-assistant/
│       ├── ChatAssistant.tsx          // Main component with FAB + Drawer
│       ├── ChatMessageList.tsx        // Message bubbles display
│       ├── ChatMessage.tsx            // Individual message bubble
│       ├── ChatInput.tsx              // Input field + send button
│       ├── ChatFilters.tsx            // Site selector + date range
│       ├── QuickActionChips.tsx       // Predefined query chips
│       └── ChatResponseTable.tsx      // Table display inside chat bubble
├── lib/
│   └── chat-assistant/
│       ├── intent-parser.ts           // Parse user input → intent + entities
│       ├── query-builder.ts           // Map intent → Supabase query
│       ├── query-executor.ts          // Execute queries and return results
│       ├── response-formatter.ts      // Format results for display
│       ├── types.ts                   // TypeScript types for chat system
│       └── constants.ts              // Intent keywords, quick actions, etc.
└── hooks/
    └── useChatAssistant.ts            // Main hook combining all logic
```

> **Important**: Check the existing project folder structure first. If the project uses `app/` directory, `components/` at root, or a different pattern — follow that pattern. Don't impose a new structure.

### 4. State Management

```typescript
// Types needed:
interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  tableData?: { headers: string[]; rows: string[][] }; // For tabular responses
  highlightValue?: string; // For big number display (e.g., "₹4,52,300")
  timestamp: Date;
  isLoading?: boolean;
}

interface ChatFilters {
  siteId: string | 'all';
  dateFrom: Date | null;
  dateTo: Date | null;
}

interface ParsedIntent {
  intent: string;
  confidence: number; // 0-1, show "I'm not sure" below 0.5
  filters: {
    site_id?: string;
    date_from?: string;
    date_to?: string;
    laborer_name?: string;
    team_name?: string;
    category?: string;
    employment_type?: string;
    status?: string;
  };
  originalQuery: string;
}
```

### 5. Error Handling & Edge Cases

- **No results**: Show friendly message "No data found for this query. Try adjusting the date range or site."
- **Unknown intent** (confidence < 0.3): Show "I didn't understand that. Try one of these:" + show quick action chips
- **Low confidence** (0.3-0.5): Show "Did you mean: [closest matching intent]?" with Yes/No buttons
- **Supabase error**: Show "Something went wrong. Please try again." and log error
- **Empty date range**: Default to "this month" if no date specified
- **Loading state**: Show typing indicator (3 animated dots) while query runs

### 6. Accessibility & Mobile

- Chat drawer should be **full screen on mobile** (below md breakpoint)
- FAB should not overlap with existing bottom navigation
- Chat input should handle mobile keyboard properly (viewport should adjust)
- Quick action chips should be horizontally scrollable on mobile
- Messages should auto-scroll to bottom on new message
- Support for keyboard Enter to send (desktop)

### 7. Currency Formatting

```typescript
// Use this for all money values:
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};
// Output: ₹4,52,300
```

---

## Implementation Steps (Follow This Order)

### Step 1: Types & Constants
Create `types.ts` and `constants.ts` with all type definitions, intent keyword mappings, and quick action definitions.

### Step 2: Intent Parser
Build `intent-parser.ts` — the function that takes a string input and returns a `ParsedIntent`. Test it with various inputs before moving on.

### Step 3: Query Builder & Executor
Build `query-builder.ts` and `query-executor.ts`. Each intent maps to a specific Supabase query function. Use the existing Supabase client from the project.

### Step 4: Response Formatter
Build `response-formatter.ts` that takes query results and formats them into `ChatMessage` objects with appropriate text, tables, or highlighted values.

### Step 5: Chat UI Components
Build the UI components starting with `ChatMessage.tsx`, then `ChatMessageList.tsx`, `ChatInput.tsx`, `ChatFilters.tsx`, `QuickActionChips.tsx`, and finally `ChatAssistant.tsx` as the main wrapper.

### Step 6: Integration Hook
Build `useChatAssistant.ts` hook that combines intent parsing, query execution, and response formatting. This hook manages the chat message state.

### Step 7: Add FAB to Layout
Add the ChatAssistant component to the app's main layout so it appears on all pages. Make sure it uses the existing site context from the app.

### Step 8: Testing
Test with these queries to verify:
- "How many workers came today?"
- "Total salary this month"
- "Pending advances"
- "Expense breakdown for January"
- "Contract payment from 1st to 15th"
- "Tea shop balance"
- "Top 5 earning workers this week"
- "Total spending from December to January"
- Just clicking quick action chips

---

## Important Reminders

1. **DO NOT install any AI/LLM packages.** This is a keyword-based parser, not AI-powered.
2. **DO NOT create new Supabase tables or modify existing ones.** Read-only queries.
3. **DO NOT create a new Supabase client.** Use the existing one from the project.
4. **MATCH the existing code style** — check how other components are written (MUI usage, file naming, import patterns).
5. **Use the existing site selector context** — the app already has a site selection mechanism. Reuse it.
6. **Indian number formatting** — use `en-IN` locale for all currency.
7. **Keep it lightweight** — no heavy dependencies. Just MUI + existing Supabase client.
8. **Mobile first** — design for mobile screen first, then adapt for desktop.
