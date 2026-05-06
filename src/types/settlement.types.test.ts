import { describe, it, expect } from "vitest";
import { requiresPayerName } from "./settlement.types";

describe("requiresPayerName", () => {
  it("returns true for 'custom'", () => {
    expect(requiresPayerName("custom")).toBe(true);
  });

  it("returns true for 'other_site_money'", () => {
    expect(requiresPayerName("other_site_money")).toBe(true);
  });

  it("returns false for 'own_money'", () => {
    expect(requiresPayerName("own_money")).toBe(false);
  });

  it("returns false for 'amma_money'", () => {
    expect(requiresPayerName("amma_money")).toBe(false);
  });

  it("returns false for 'client_money'", () => {
    expect(requiresPayerName("client_money")).toBe(false);
  });

  it("returns false for 'trust_account'", () => {
    expect(requiresPayerName("trust_account")).toBe(false);
  });

  it("returns false for 'mothers_money' (legacy alias)", () => {
    expect(requiresPayerName("mothers_money")).toBe(false);
  });

  it("returns false for unknown / future custom keys", () => {
    expect(requiresPayerName("totally_made_up_key")).toBe(false);
  });
});
