/**
 * Predicate: hide the manual PayerSourceSelector when a logged-in site
 * engineer is paying from their own wallet.
 *
 * Phase 1 doesn't yet derive the source automatically (Phase 2 will,
 * via engineer_wallet_spend_allocations). But the manual picker is
 * already redundant for engineers — deposits carry payer_source, and
 * the engineer just spends from the pool. Stripping the picker now
 * removes a confusing input and prevents the historical bug where the
 * engineer's manual pick contradicts the actual wallet composition.
 *
 * Admins and office users keep the picker — they have legitimate
 * reasons to attribute manually (recording an out-of-wallet company
 * purchase, or editorial correction on a retroactive row).
 */
export interface WalletPayerLockArgs {
  userRole: string | undefined;
  payerType: "site_engineer" | "company_direct" | undefined;
  createWalletTransaction: boolean | undefined;
}

export function isSiteEngineerPayingFromWallet(
  args: WalletPayerLockArgs
): boolean {
  return (
    args.userRole === "site_engineer" &&
    args.payerType === "site_engineer" &&
    args.createWalletTransaction === true
  );
}
