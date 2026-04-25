import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import dayjs from "dayjs";
import { computeLabel } from "./DateRangeProvider";

describe("computeLabel", () => {
  beforeAll(() => {
    // Freeze clock to 2026-04-24 (Friday)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-24T12:00:00"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const today = () => dayjs("2026-04-24").toDate();
  const daysAgo = (n: number) => dayjs("2026-04-24").subtract(n, "day").toDate();
  const startOfWeek = () => dayjs("2026-04-24").startOf("week").toDate(); // Sunday Apr 19
  const startOfMonth = () => dayjs("2026-04-24").startOf("month").toDate(); // Apr 1

  it("returns 'All Time' when both dates are null", () => {
    expect(computeLabel(null, null)).toBe("All Time");
  });

  it("returns 'Today' for a single-day range on today", () => {
    expect(computeLabel(today(), today())).toBe("Today");
  });

  it("returns 'Yesterday' for a single-day range on yesterday", () => {
    const y = daysAgo(1);
    expect(computeLabel(y, y)).toBe("Yesterday");
  });

  it("returns 'This Week' for Sunday-to-today", () => {
    expect(computeLabel(startOfWeek(), today())).toBe("This Week");
  });

  it("returns 'This Month' for 1st-to-today", () => {
    expect(computeLabel(startOfMonth(), today())).toBe("This Month");
  });

  it("returns 'Last 7 days' for a 7-day rolling window ending today", () => {
    expect(computeLabel(daysAgo(6), today())).toBe("Last 7 days");
  });

  it("returns 'Last 14 days' for a 14-day rolling window ending today", () => {
    expect(computeLabel(daysAgo(13), today())).toBe("Last 14 days");
  });

  it("returns 'Last 30 days' for a 30-day rolling window ending today", () => {
    expect(computeLabel(daysAgo(29), today())).toBe("Last 30 days");
  });

  it("returns 'Last 90 days' for a 90-day rolling window ending today", () => {
    expect(computeLabel(daysAgo(89), today())).toBe("Last 90 days");
  });

  it("returns a custom range label for unrecognised ranges within the same year", () => {
    const start = dayjs("2026-04-03").toDate();
    const end = dayjs("2026-04-17").toDate();
    expect(computeLabel(start, end)).toBe("Custom range");
  });

  it("returns a custom range label with year suffix for ranges crossing years", () => {
    const start = dayjs("2025-12-20").toDate();
    const end = dayjs("2026-01-05").toDate();
    expect(computeLabel(start, end)).toBe("Custom range");
  });

  it("returns the formatted single date when start and end are the same non-today day", () => {
    const d = dayjs("2026-03-10").toDate();
    expect(computeLabel(d, d)).toBe("Mar 10, 2026");
  });
});

import { computeDays } from "./DateRangeProvider";

describe("computeLabel — calendar months (revised 2026-04-25)", () => {
  it("returns 'Feb 2026' for a full past calendar month (two months ago)", () => {
    const start = dayjs("2026-02-01").startOf("day").toDate();
    const end = dayjs("2026-02-28").endOf("day").toDate();
    expect(computeLabel(start, end)).toBe("Feb 2026");
  });

  it("still returns 'This Month' for the current calendar month ending today", () => {
    const today = dayjs();
    const start = today.startOf("month").toDate();
    const end = today.endOf("day").toDate();
    expect(computeLabel(start, end)).toBe("This Month");
  });

  it("returns 'Last Month' for the previous calendar month (current-month minus one)", () => {
    const today = dayjs();
    const start = today.subtract(1, "month").startOf("month").toDate();
    const end = today.subtract(1, "month").endOf("month").toDate();
    expect(computeLabel(start, end)).toBe("Last Month");
  });
});

describe("computeDays", () => {
  it("returns null for All Time (both null)", () => {
    expect(computeDays(null, null)).toBeNull();
  });

  it("returns 1 for a same-day range", () => {
    const d = new Date("2026-04-24");
    expect(computeDays(d, d)).toBe(1);
  });

  it("returns 7 for a 7-day inclusive range", () => {
    expect(
      computeDays(new Date("2026-04-18"), new Date("2026-04-24"))
    ).toBe(7);
  });

  it("returns 25 for Apr 1 → Apr 25", () => {
    expect(
      computeDays(new Date("2026-04-01"), new Date("2026-04-25"))
    ).toBe(25);
  });
});
