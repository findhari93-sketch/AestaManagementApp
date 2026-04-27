/**
 * useDayPendingRecords
 *
 * Fetches the unsettled per-laborer attendance entries for one (site, date)
 * and reshapes them into `DailyPaymentRecord[]` — the input shape that
 * `PaymentDialog` expects in its `dailyRecords` mode.
 *
 * Reads `daily_attendance` and `market_laborer_attendance` directly with
 * the same column projection used by the heavy `useAttendanceData` hook on
 * `/site/attendance`, then keeps only rows where `is_paid = false`. This
 * exists because the `get_attendance_for_date` RPC is intentionally
 * view-only (no `is_paid` / `laborer_id` / `originalDbId` exposed) and so
 * cannot feed the settlement payload — see `settlementAdapters.ts` for the
 * historical context.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DailyPaymentRecord } from "@/types/payment.types";

interface DailyAttendanceRow {
  id: string;
  date: string;
  laborer_id: string;
  daily_earnings: number | null;
  is_paid: boolean | null;
  payment_notes: string | null;
  subcontract_id: string | null;
  laborers:
    | {
        name: string | null;
        laborer_type: string | null;
        labor_categories: { name: string | null } | null;
        labor_roles: { name: string | null } | null;
      }
    | null;
  subcontracts: { title: string | null } | null;
}

interface MarketAttendanceRow {
  id: string;
  date: string;
  count: number | null;
  total_cost: number | null;
  is_paid: boolean | null;
  payment_notes: string | null;
  labor_roles: { name: string | null } | null;
}

export function useDayPendingRecords(
  siteId: string | undefined,
  date: string | undefined
) {
  const supabase = createClient();
  return useQuery<DailyPaymentRecord[]>({
    queryKey: ["payments", "day-pending-records", siteId, date],
    enabled: Boolean(siteId && date),
    staleTime: 15_000,
    queryFn: async (): Promise<DailyPaymentRecord[]> => {
      const [{ data: dailyData, error: dailyError }, { data: marketData, error: marketError }] =
        await Promise.all([
          supabase
            .from("daily_attendance")
            .select(
              `
              id, date, laborer_id, daily_earnings, is_paid, payment_notes, subcontract_id,
              laborers!inner(
                name, laborer_type,
                labor_categories(name),
                labor_roles(name)
              ),
              subcontracts(title)
              `
            )
            .eq("site_id", siteId!)
            .eq("date", date!)
            .eq("is_paid", false),
          (supabase.from("market_laborer_attendance") as any)
            .select(
              "id, date, count, total_cost, is_paid, payment_notes, labor_roles(name)"
            )
            .eq("site_id", siteId!)
            .eq("date", date!)
            .eq("is_paid", false),
        ]);

      if (dailyError) throw dailyError;
      if (marketError) throw marketError;

      const dailyRecords: DailyPaymentRecord[] = ((dailyData ?? []) as unknown as DailyAttendanceRow[]).map(
        (r) => {
          const labType: "daily" | "contract" = r.laborers?.laborer_type === "contract" ? "contract" : "daily";
          return {
            id: `daily-${r.id}`,
            sourceType: "daily",
            sourceId: r.id,
            date: r.date,
            laborerId: r.laborer_id,
            laborerName: r.laborers?.name ?? "Unknown",
            laborerType: labType,
            category: r.laborers?.labor_categories?.name ?? undefined,
            role: r.laborers?.labor_roles?.name ?? undefined,
            amount: r.daily_earnings ?? 0,
            isPaid: false,
            paidVia: null,
            paymentDate: null,
            paymentMode: null,
            engineerTransactionId: null,
            engineerUserId: null,
            proofUrl: null,
            paymentNotes: r.payment_notes ?? null,
            settlementStatus: null,
            companyProofUrl: null,
            engineerProofUrl: null,
            transactionDate: null,
            settledDate: null,
            confirmedAt: null,
            settlementMode: null,
            cashReason: null,
            moneySource: null,
            moneySourceName: null,
            subcontractId: r.subcontract_id,
            subcontractTitle: r.subcontracts?.title ?? null,
            expenseId: null,
            settlementGroupId: null,
            settlementReference: null,
          };
        }
      );

      const marketRecords: DailyPaymentRecord[] = ((marketData ?? []) as MarketAttendanceRow[]).map(
        (r) => ({
          id: `market-${r.id}`,
          sourceType: "market",
          sourceId: r.id,
          date: r.date,
          laborerId: null,
          laborerName: r.labor_roles?.name ?? "Market laborer",
          laborerType: "market",
          role: r.labor_roles?.name ?? undefined,
          count: r.count ?? 1,
          amount: r.total_cost ?? 0,
          isPaid: false,
          paidVia: null,
          paymentDate: null,
          paymentMode: null,
          engineerTransactionId: null,
          engineerUserId: null,
          proofUrl: null,
          paymentNotes: r.payment_notes ?? null,
          settlementStatus: null,
          companyProofUrl: null,
          engineerProofUrl: null,
          transactionDate: null,
          settledDate: null,
          confirmedAt: null,
          settlementMode: null,
          cashReason: null,
          moneySource: null,
          moneySourceName: null,
          subcontractId: null,
          subcontractTitle: null,
          expenseId: null,
          settlementGroupId: null,
          settlementReference: null,
        })
      );

      return [...dailyRecords, ...marketRecords];
    },
  });
}
