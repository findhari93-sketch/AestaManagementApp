import { describe, it, expect } from "vitest";
import {
  mergeContractSalaryWithAdvance,
  type ExpenseBreakdownEntry,
} from "./expenseBreakdown";

type Breakdown = Record<string, ExpenseBreakdownEntry>;

describe("mergeContractSalaryWithAdvance", () => {
  it("folds Advance into Contract Salary when both are present", () => {
    const input: Breakdown = {
      "Contract Salary": { amount: 335450, count: 114 },
      Advance: { amount: 15000, count: 2 },
      Material: { amount: 285825, count: 27 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out["Contract Salary"]).toEqual({
      amount: 350450,
      count: 114,
      advanceCount: 2,
    });
    expect(out.Advance).toBeUndefined();
    expect(out.Material).toEqual({ amount: 285825, count: 27 });
  });

  it("leaves Contract Salary untouched when no Advance is present", () => {
    const input: Breakdown = {
      "Contract Salary": { amount: 335450, count: 114 },
      Material: { amount: 285825, count: 27 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out["Contract Salary"]).toEqual({ amount: 335450, count: 114 });
    expect((out["Contract Salary"] as ExpenseBreakdownEntry).advanceCount).toBeUndefined();
    expect(out.Advance).toBeUndefined();
  });

  it("keeps Advance standalone when Contract Salary is absent (defensive)", () => {
    const input: Breakdown = {
      Advance: { amount: 15000, count: 2 },
      Material: { amount: 285825, count: 27 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out.Advance).toEqual({ amount: 15000, count: 2 });
    expect(out["Contract Salary"]).toBeUndefined();
  });

  it("returns an empty object when input has no salary keys", () => {
    const input: Breakdown = {
      Material: { amount: 285825, count: 27 },
      "Tea & Snacks": { amount: 4327, count: 11 },
    };
    const out = mergeContractSalaryWithAdvance(input);
    expect(out.Material).toEqual({ amount: 285825, count: 27 });
    expect(out["Tea & Snacks"]).toEqual({ amount: 4327, count: 11 });
    expect(out["Contract Salary"]).toBeUndefined();
    expect(out.Advance).toBeUndefined();
  });

  it("does not mutate the input object", () => {
    const input: Breakdown = {
      "Contract Salary": { amount: 100, count: 1 },
      Advance: { amount: 50, count: 1 },
    };
    const inputCopy = JSON.parse(JSON.stringify(input));
    mergeContractSalaryWithAdvance(input);
    expect(input).toEqual(inputCopy);
  });
});
