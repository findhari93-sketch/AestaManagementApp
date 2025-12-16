import { createClient } from "@/lib/supabase/server";
import dayjs from "dayjs";

export interface DashboardStats {
  todayLaborers: number;
  todayCost: number;
  weekTotal: number;
  pendingSalaries: number;
  activeLaborers: number;
  pendingPaymentAmount: number;
}

export interface RecentAttendance {
  date: string;
  laborer_name: string;
  work_days: number;
  daily_earnings: number;
}

export interface PendingSalary {
  laborer_name: string;
  week_ending: string;
  balance_due: number;
  status: string;
}

export interface WeeklyTrendData {
  date: string;
  labor: number;
  expenses: number;
}

export interface ExpenseBreakdown {
  name: string;
  value: number;
}

export interface ProjectCosts {
  teaShopCount: number;
  teaShopTotal: number;
  expensesCount: number;
  expensesTotal: number;
  totalUnlinked: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentAttendance: RecentAttendance[];
  pendingSalaries: PendingSalary[];
  weeklyTrendData: WeeklyTrendData[];
  expenseBreakdown: ExpenseBreakdown[];
  projectCosts: ProjectCosts;
}

/**
 * Fetch all dashboard data on the server.
 * Uses Promise.all for parallel queries.
 */
export async function getDashboardData(siteId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const today = dayjs().format("YYYY-MM-DD");
  const weekStart = dayjs().subtract(7, "days").format("YYYY-MM-DD");
  const thirtyDaysAgo = dayjs().subtract(30, "days").format("YYYY-MM-DD");

  // Run all queries in parallel for optimal performance
  const [
    // Stats queries
    todayResult,
    weekResult,
    laborersResult,
    pendingSalaryResult,
    // Recent attendance
    recentAttendanceResult,
    // Pending salaries list
    pendingSalariesResult,
    // Trend data
    trendAttendanceResult,
    trendExpensesResult,
    // Expense breakdown
    expenseBreakdownResult,
    // Project costs
    teaShopsResult,
    allExpensesResult,
  ] = await Promise.all([
    // Today's attendance
    supabase
      .from("daily_attendance")
      .select("work_days, daily_earnings")
      .eq("site_id", siteId)
      .eq("date", today),

    // Week's attendance
    supabase
      .from("daily_attendance")
      .select("daily_earnings")
      .eq("site_id", siteId)
      .gte("date", weekStart)
      .lte("date", today),

    // Active laborers count
    supabase
      .from("laborers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),

    // Pending salaries summary
    supabase
      .from("salary_periods")
      .select("balance_due, status")
      .in("status", ["calculated", "partial"]),

    // Recent attendance (last 5)
    supabase
      .from("v_active_attendance")
      .select("date, laborer_name, work_days, daily_earnings")
      .eq("site_id", siteId)
      .order("date", { ascending: false })
      .limit(5),

    // Pending salaries list (last 5)
    supabase
      .from("v_salary_periods_detailed")
      .select("laborer_name, week_ending, balance_due, status")
      .in("status", ["calculated", "partial"])
      .order("week_ending", { ascending: false })
      .limit(5),

    // Trend attendance (last 7 days)
    supabase
      .from("daily_attendance")
      .select("date, daily_earnings")
      .eq("site_id", siteId)
      .gte("date", dayjs().subtract(6, "days").format("YYYY-MM-DD"))
      .lte("date", today),

    // Trend expenses (last 7 days)
    supabase
      .from("expenses")
      .select("date, amount")
      .eq("site_id", siteId)
      .gte("date", dayjs().subtract(6, "days").format("YYYY-MM-DD"))
      .lte("date", today),

    // Expense breakdown (last 30 days)
    supabase
      .from("expenses")
      .select("module, amount")
      .eq("site_id", siteId)
      .gte("date", thirtyDaysAgo),

    // Tea shop accounts for project costs
    supabase.from("tea_shop_accounts").select("id").eq("site_id", siteId),

    // All expenses for project costs
    supabase.from("expenses").select("amount").eq("site_id", siteId),
  ]);

  // Process stats
  const todayAttendance = todayResult.data as
    | { work_days: number; daily_earnings: number }[]
    | null;
  const weekAttendance = weekResult.data as { daily_earnings: number }[] | null;
  const pendingSalaryData = pendingSalaryResult.data as
    | { balance_due: number; status: string }[]
    | null;

  const stats: DashboardStats = {
    todayLaborers: todayAttendance?.length || 0,
    todayCost:
      todayAttendance?.reduce((sum, a) => sum + (a.daily_earnings || 0), 0) || 0,
    weekTotal:
      weekAttendance?.reduce((sum, a) => sum + (a.daily_earnings || 0), 0) || 0,
    pendingSalaries: pendingSalaryData?.length || 0,
    activeLaborers: laborersResult.count || 0,
    pendingPaymentAmount:
      pendingSalaryData?.reduce((sum, s) => sum + (s.balance_due || 0), 0) || 0,
  };

  // Process recent attendance
  const recentAttendance: RecentAttendance[] = (
    recentAttendanceResult.data || []
  ).map((d: any) => ({
    date: d.date || "",
    laborer_name: d.laborer_name || "",
    work_days: d.work_days || 0,
    daily_earnings: d.daily_earnings || 0,
  }));

  // Process pending salaries
  const pendingSalaries: PendingSalary[] = (
    pendingSalariesResult.data || []
  ).map((d: any) => ({
    laborer_name: d.laborer_name || "",
    week_ending: d.week_ending || "",
    balance_due: d.balance_due || 0,
    status: d.status || "",
  }));

  // Process weekly trend data
  const attendanceByDate: Record<string, number> = {};
  const expensesByDate: Record<string, number> = {};

  (trendAttendanceResult.data || []).forEach((row: any) => {
    attendanceByDate[row.date] =
      (attendanceByDate[row.date] || 0) + (row.daily_earnings || 0);
  });

  (trendExpensesResult.data || []).forEach((row: any) => {
    expensesByDate[row.date] =
      (expensesByDate[row.date] || 0) + (row.amount || 0);
  });

  const weeklyTrendData: WeeklyTrendData[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = dayjs().subtract(i, "days");
    const dateStr = date.format("YYYY-MM-DD");
    weeklyTrendData.push({
      date: date.format("DD MMM"),
      labor: attendanceByDate[dateStr] || 0,
      expenses: expensesByDate[dateStr] || 0,
    });
  }

  // Process expense breakdown
  const expensesByModule: Record<string, number> = {};
  (expenseBreakdownResult.data || []).forEach((exp: any) => {
    expensesByModule[exp.module] =
      (expensesByModule[exp.module] || 0) + (exp.amount || 0);
  });

  const expenseBreakdown: ExpenseBreakdown[] = Object.entries(
    expensesByModule
  ).map(([module, amount]) => ({
    name: module.charAt(0).toUpperCase() + module.slice(1),
    value: amount,
  }));

  // Process project costs (unlinked payments)
  const teaShopIds = (teaShopsResult.data || []).map((t: any) => t.id);
  let projectCosts: ProjectCosts = {
    teaShopCount: 0,
    teaShopTotal: 0,
    expensesCount: (allExpensesResult.data || []).length,
    expensesTotal: (allExpensesResult.data || []).reduce(
      (sum: number, e: any) => sum + (e.amount || 0),
      0
    ),
    totalUnlinked: 0,
  };

  // Fetch tea shop settlements if there are any tea shops
  if (teaShopIds.length > 0) {
    const { data: teaSettlements } = await supabase
      .from("tea_shop_settlements")
      .select("amount_paid")
      .in("tea_shop_id", teaShopIds);

    const teaTotal = (teaSettlements || []).reduce(
      (sum: number, t: any) => sum + (t.amount_paid || 0),
      0
    );

    projectCosts = {
      ...projectCosts,
      teaShopCount: (teaSettlements || []).length,
      teaShopTotal: teaTotal,
      totalUnlinked: teaTotal + projectCosts.expensesTotal,
    };
  } else {
    projectCosts.totalUnlinked = projectCosts.expensesTotal;
  }

  return {
    stats,
    recentAttendance,
    pendingSalaries,
    weeklyTrendData,
    expenseBreakdown,
    projectCosts,
  };
}
