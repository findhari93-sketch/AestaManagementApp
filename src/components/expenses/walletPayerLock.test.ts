import { describe, it, expect } from "vitest";
import { isSiteEngineerPayingFromWallet } from "./walletPayerLock";

describe("isSiteEngineerPayingFromWallet", () => {
  it("returns true when role + payerType + wallet flag all align", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "site_engineer",
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(true);
  });

  it("returns false for admin paying via a site engineer's wallet (admin keeps the picker)", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "admin",
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });

  it("returns false when wallet transaction toggle is off", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "site_engineer",
        payerType: "site_engineer",
        createWalletTransaction: false,
      })
    ).toBe(false);
  });

  it("returns false when payer type is company_direct (shouldn't happen for engineers, defensive)", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "site_engineer",
        payerType: "company_direct",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });

  it("returns false for office role", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: "office",
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });

  it("returns false when role is undefined (auth still loading)", () => {
    expect(
      isSiteEngineerPayingFromWallet({
        userRole: undefined,
        payerType: "site_engineer",
        createWalletTransaction: true,
      })
    ).toBe(false);
  });
});
