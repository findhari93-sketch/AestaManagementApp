import { describe, it, expect } from "vitest";

// Pure helper extracted from mutation — tested here before wiring in
function calcRentalDays(
  startDate: string,
  expectedReturnDate: string | undefined,
  excludeStartDate: boolean
): number {
  if (!expectedReturnDate) return 30;
  const diff = Math.ceil(
    (new Date(expectedReturnDate).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return Math.max(1, excludeStartDate ? diff : diff + 1);
}

describe("calcRentalDays", () => {
  it("includes both endpoints when excludeStartDate is false (26 days)", () => {
    expect(calcRentalDays("2026-03-31", "2026-04-25", false)).toBe(26);
  });

  it("excludes start date when flag is true (25 days)", () => {
    expect(calcRentalDays("2026-03-31", "2026-04-25", true)).toBe(25);
  });

  it("returns 30 when no return date", () => {
    expect(calcRentalDays("2026-03-31", undefined, false)).toBe(30);
    expect(calcRentalDays("2026-03-31", undefined, true)).toBe(30);
  });

  it("clamps to minimum 1 day", () => {
    expect(calcRentalDays("2026-03-31", "2026-03-31", true)).toBe(1);
    expect(calcRentalDays("2026-03-31", "2026-03-31", false)).toBe(1);
  });
});
