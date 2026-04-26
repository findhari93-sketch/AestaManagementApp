import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface SubcontractSpend {
  spent: number;
  totalValue: number;
  percentOfTotal: number;
}

export function useSubcontractSpend(subcontractId: string | null | undefined) {
  const supabase = createClient();
  return useQuery<SubcontractSpend | null>({
    queryKey: ["subcontract-spend", subcontractId],
    enabled: Boolean(subcontractId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!subcontractId) return null;

      const { data: subcontract, error: subErr } = await supabase
        .from("subcontracts")
        .select("total_value")
        .eq("id", subcontractId)
        .single();
      if (subErr) throw subErr;

      // v_all_expenses uses contract_id (not subcontract_id) for the
      // subcontract foreign key. Sum amount across all categories
      // (materials, salary, etc.) for an all-categories burn-down number.
      const { data: expenses, error: expErr } = await supabase
        .from("v_all_expenses")
        .select("amount")
        .eq("contract_id", subcontractId);
      if (expErr) throw expErr;

      const spent = (expenses ?? []).reduce(
        (s: number, e: { amount: number | string }) => s + Number(e.amount || 0),
        0
      );
      const totalValue = Number(subcontract?.total_value || 0);
      const percentOfTotal =
        totalValue > 0 ? Math.round((spent / totalValue) * 100) : 0;

      return { spent, totalValue, percentOfTotal };
    },
  });
}
