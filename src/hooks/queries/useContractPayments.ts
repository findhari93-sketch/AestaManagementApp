import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ContractPaymentType =
  | "weekly_advance"
  | "milestone"
  | "part_payment"
  | "final_settlement";

export type PaymentMode = "cash" | "upi" | "bank_transfer" | "cheque" | "other";

export type PaymentChannel =
  | "via_site_engineer"
  | "mesthri_at_office"
  | "company_direct_online";

/** Source identifies whether a ledger entry came from subcontract_payments
 *  (a direct payment to the mesthri) or settlement_groups (a multi-laborer
 *  salary settlement that happens to be classified to this contract). The
 *  inline ledger renders both together so users see the full money flow. */
export type LedgerSource = "direct" | "settlement";

export interface ContractLedgerEntry {
  id: string;
  source: LedgerSource;
  amount: number;
  paymentDate: string;
  /** subcontract_payments.payment_type or settlement_groups.payment_type. */
  paymentType: string;
  paymentMode: PaymentMode | null;
  paymentChannel: string | null;
  reference: string | null;
  notes: string | null;
}

interface RawPaymentRow {
  id: string;
  contract_id: string;
  amount: number | string;
  payment_date: string;
  payment_type: ContractPaymentType;
  payment_mode: PaymentMode | null;
  payment_channel: PaymentChannel | null;
  reference_number: string | null;
  comments: string | null;
  created_at: string;
}

interface RawSettlementRow {
  id: string;
  amount: number | string;
  date: string;
  payment_type: string | null;
  payment_mode: PaymentMode | null;
  payment_channel: string | null;
  settlement_reference: string | null;
}

/**
 * Unified ledger for a single contract: subcontract_payments + non-cancelled
 * settlement_groups merged into one chronological timeline (newest first).
 * Used by the inline payments list on the trade card.
 */
export function useContractPayments(contractId: string | undefined) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["contract-payments", contractId],
    enabled: !!contractId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ContractLedgerEntry[]> => {
      if (!contractId) return [];
      const sb = supabase as any;

      const [paymentsRes, settlementsRes] = await Promise.all([
        sb
          .from("subcontract_payments")
          .select(
            "id, contract_id, amount, payment_date, payment_type, payment_mode, payment_channel, reference_number, comments, created_at"
          )
          .eq("contract_id", contractId)
          .eq("is_deleted", false),
        sb
          .from("settlement_groups")
          .select(
            "id, total_amount, settlement_date, payment_type, payment_mode, payment_channel, settlement_reference"
          )
          .eq("subcontract_id", contractId)
          .eq("is_cancelled", false),
      ]);
      if (paymentsRes.error) throw paymentsRes.error;
      if (settlementsRes.error) throw settlementsRes.error;

      const direct: ContractLedgerEntry[] = (
        (paymentsRes.data ?? []) as RawPaymentRow[]
      ).map((r) => ({
        id: `sp:${r.id}`,
        source: "direct" as const,
        amount: Number(r.amount ?? 0),
        paymentDate: r.payment_date,
        paymentType: r.payment_type,
        paymentMode: r.payment_mode,
        paymentChannel: r.payment_channel,
        reference: r.reference_number,
        notes: r.comments,
      }));

      const settlements: ContractLedgerEntry[] = (
        (settlementsRes.data ?? [] as Array<RawSettlementRow & { total_amount: number | string; settlement_date: string }>)
      ).map((r: any) => ({
        id: `sg:${r.id}`,
        source: "settlement" as const,
        amount: Number(r.total_amount ?? 0),
        paymentDate: r.settlement_date,
        paymentType: r.payment_type ?? "salary",
        paymentMode: r.payment_mode,
        paymentChannel: r.payment_channel,
        reference: r.settlement_reference,
        notes: null,
      }));

      return [...direct, ...settlements].sort((a, b) => {
        if (a.paymentDate !== b.paymentDate) {
          return a.paymentDate < b.paymentDate ? 1 : -1;
        }
        return 0;
      });
    },
  });
}
