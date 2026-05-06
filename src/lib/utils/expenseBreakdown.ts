export interface ExpenseBreakdownEntry {
  amount: number;
  count: number;
  /** Number of Advance records folded into this Contract Salary entry. */
  advanceCount?: number;
}

export type ExpenseBreakdown = Record<string, ExpenseBreakdownEntry>;

/**
 * Folds the `Advance` expense_type into `Contract Salary` so the page renders
 * a single "total mesthri paid" tile. Mirrors the SalarySliceHero's
 * Total Paid = settlementsTotal + advancesTotal aggregate.
 */
export function mergeContractSalaryWithAdvance(
  breakdown: ExpenseBreakdown,
): ExpenseBreakdown {
  const out: ExpenseBreakdown = { ...breakdown };
  const contract = out["Contract Salary"];
  const advance = out.Advance;

  if (contract && advance) {
    out["Contract Salary"] = {
      amount: contract.amount + advance.amount,
      count: contract.count,
      advanceCount: advance.count,
    };
    delete out.Advance;
  }

  return out;
}
