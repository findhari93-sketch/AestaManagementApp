import { SupabaseClient } from "@supabase/supabase-js";

export interface SubcontractTotals {
  subcontractId: string;
  title: string;
  totalValue: number;
  totalPaid: number;
  balance: number;
  status: string;
  // Breakdown for transparency
  directPayments: number;
  laborPayments: number;
  clearedExpenses: number;
  // Record counts
  directPaymentCount: number;
  laborPaymentCount: number;
  expenseCount: number;
  totalRecordCount: number;
}

interface ViewExpenseRecord {
  contract_id: string;
  amount: number;
  source_type: string;
  expense_type: string;
}

interface SubcontractRecord {
  id: string;
  title: string;
  total_value: number | null;
  status: string;
}

/**
 * Calculate subcontract totals using v_all_expenses for consistency.
 *
 * Uses v_all_expenses view which now includes ALL expense types:
 * - Daily Salary (aggregated by date)
 * - Contract Salary
 * - Advance
 * - Material/Machinery/General expenses
 * - Tea Shop settlements
 * - Miscellaneous expenses
 * - Subcontract direct payments (Direct Payment type)
 *
 * This ensures counts match what's shown in the Daily Expenses page.
 */
export async function calculateSubcontractTotals(
  supabase: SupabaseClient,
  subcontractIds: string[]
): Promise<Map<string, SubcontractTotals>> {
  const results = new Map<string, SubcontractTotals>();

  if (subcontractIds.length === 0) {
    return results;
  }

  // Fetch subcontracts basic info
  const { data: subcontracts, error: scError } = await supabase
    .from("subcontracts")
    .select("id, title, total_value, status")
    .in("id", subcontractIds);

  if (scError || !subcontracts) {
    console.error("Error fetching subcontracts:", scError);
    return results;
  }

  // Fetch ALL cleared expenses from v_all_expenses linked to subcontracts
  // This now includes: Direct Payments, Daily Salary, Contract Salary, Advance, Material, etc.
  const { data: allExpenses } = await (supabase as any)
    .from("v_all_expenses")
    .select("contract_id, amount, source_type, expense_type, is_cleared")
    .in("contract_id", subcontractIds)
    .eq("is_deleted", false)
    .eq("is_cleared", true);

  // Aggregate expenses from v_all_expenses by subcontract
  // Split into: direct payments, labor (settlements), and other (regular expenses)
  const directPaymentMap = new Map<string, { total: number; count: number }>();
  const laborExpenseMap = new Map<string, { total: number; count: number }>();
  const otherExpenseMap = new Map<string, { total: number; count: number }>();

  for (const e of (allExpenses as ViewExpenseRecord[] | null) || []) {
    if (!e.contract_id) continue;

    // Determine category based on source_type
    let targetMap: Map<string, { total: number; count: number }>;
    if (e.source_type === "subcontract_payment") {
      targetMap = directPaymentMap;
    } else if (e.source_type === "settlement" || e.source_type === "tea_shop_settlement") {
      targetMap = laborExpenseMap;
    } else {
      targetMap = otherExpenseMap;
    }

    const current = targetMap.get(e.contract_id) || { total: 0, count: 0 };
    current.total += e.amount || 0;
    current.count += 1;
    targetMap.set(e.contract_id, current);
  }

  // Build results
  for (const sc of subcontracts as SubcontractRecord[]) {
    const direct = directPaymentMap.get(sc.id) || { total: 0, count: 0 };
    const labor = laborExpenseMap.get(sc.id) || { total: 0, count: 0 };
    const other = otherExpenseMap.get(sc.id) || { total: 0, count: 0 };

    const totalPaid = direct.total + labor.total + other.total;
    const totalRecordCount = direct.count + labor.count + other.count;

    results.set(sc.id, {
      subcontractId: sc.id,
      title: sc.title,
      totalValue: sc.total_value || 0,
      totalPaid,
      balance: (sc.total_value || 0) - totalPaid,
      status: sc.status,
      directPayments: direct.total,
      laborPayments: labor.total,
      clearedExpenses: other.total,
      directPaymentCount: direct.count,
      laborPaymentCount: labor.count,
      expenseCount: other.count,
      totalRecordCount,
    });
  }

  return results;
}

/**
 * Get subcontract totals for a site (active/on_hold only by default)
 */
export async function getSiteSubcontractTotals(
  supabase: SupabaseClient,
  siteId: string,
  statusFilter?: string[]
): Promise<SubcontractTotals[]> {
  // Get subcontracts for this site
  let query = supabase
    .from("subcontracts")
    .select("id")
    .eq("site_id", siteId);

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  } else {
    // Default to active/on_hold
    query = query.in("status", ["active", "on_hold"]);
  }

  const { data: subcontracts, error } = await query;

  if (error || !subcontracts) {
    console.error("Error fetching site subcontracts:", error);
    return [];
  }

  const ids = subcontracts.map((s: { id: string }) => s.id);
  const totalsMap = await calculateSubcontractTotals(supabase, ids);
  return Array.from(totalsMap.values());
}

/**
 * Get all subcontract totals (company-wide)
 */
export async function getAllSubcontractTotals(
  supabase: SupabaseClient,
  statusFilter?: string[]
): Promise<SubcontractTotals[]> {
  let query = supabase.from("subcontracts").select("id");

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  const { data: subcontracts, error } = await query;

  if (error || !subcontracts) {
    console.error("Error fetching all subcontracts:", error);
    return [];
  }

  const ids = subcontracts.map((s: { id: string }) => s.id);
  const totalsMap = await calculateSubcontractTotals(supabase, ids);
  return Array.from(totalsMap.values());
}
