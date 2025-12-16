import { SupabaseClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { createSalaryExpense } from "./notificationService";
import type { PaymentMode, PaymentChannel } from "@/types/payment.types";
import type { PayerSource, SettlementRecord } from "@/types/settlement.types";

export interface SettlementResult {
  success: boolean;
  expenseId?: string;
  engineerTransactionId?: string;
  error?: string;
}

export interface SettlementConfig {
  siteId: string;
  records: SettlementRecord[];
  totalAmount: number;
  paymentMode: PaymentMode;
  paymentChannel: PaymentChannel;
  payerSource: PayerSource;
  customPayerName?: string;
  engineerId?: string;
  engineerReference?: string;
  proofUrl?: string;
  notes?: string;
  subcontractId?: string;
  userId: string;
  userName: string;
}

/**
 * Process a settlement - the main entry point for all settlement operations.
 * This ensures consistency across all settlement paths (attendance page, salary page, etc.)
 */
export async function processSettlement(
  supabase: SupabaseClient,
  config: SettlementConfig
): Promise<SettlementResult> {
  try {
    const paymentDate = dayjs().format("YYYY-MM-DD");
    let engineerTransactionId: string | null = null;
    let expenseId: string | undefined;

    // 1. If via engineer wallet, create engineer transaction first
    if (config.paymentChannel === "engineer_wallet" && config.engineerId) {
      const { data: txData, error: txError } = await (supabase
        .from("site_engineer_transactions") as any)
        .insert({
          user_id: config.engineerId,
          site_id: config.siteId,
          transaction_type: "received_from_company",
          settlement_status: "pending_settlement",
          amount: config.totalAmount,
          description: config.engineerReference || "Salary settlement",
          payment_mode: config.paymentMode,
          proof_url: config.proofUrl || null,
          is_settled: false,
          recorded_by: config.userName,
          recorded_by_user_id: config.userId,
          related_subcontract_id: config.subcontractId || null,
        })
        .select()
        .single();

      if (txError) throw txError;
      engineerTransactionId = txData.id;
    }

    // 2. Update attendance records
    const updateData = {
      is_paid: config.paymentChannel === "direct",
      payment_date: paymentDate,
      payment_mode: config.paymentMode,
      paid_via: config.paymentChannel === "direct" ? "direct" : "engineer_wallet",
      engineer_transaction_id: engineerTransactionId,
      payment_proof_url: config.proofUrl || null,
      payment_notes: config.notes || null,
      payer_source: config.payerSource,
      payer_name: config.payerSource === "custom" ? config.customPayerName : null,
    };

    // Group records by type
    const dailyIds = config.records
      .filter((r) => r.sourceType === "daily")
      .map((r) => r.sourceId);
    const marketIds = config.records
      .filter((r) => r.sourceType === "market")
      .map((r) => r.sourceId);

    // Update daily_attendance records
    if (dailyIds.length > 0) {
      const { error: dailyError } = await supabase
        .from("daily_attendance")
        .update({
          ...updateData,
          subcontract_id: config.subcontractId || null,
        })
        .in("id", dailyIds);

      if (dailyError) throw dailyError;
    }

    // Update market_laborer_attendance records
    if (marketIds.length > 0) {
      const { error: marketError } = await supabase
        .from("market_laborer_attendance")
        .update(updateData)
        .in("id", marketIds);

      if (marketError) throw marketError;
    }

    // 3. Create salary expense for direct payments
    if (config.paymentChannel === "direct") {
      const laborerCount = config.records.length;
      const recordDate = config.records.length > 0 ? config.records[0].date : paymentDate;

      const description = buildExpenseDescription(config, laborerCount);

      const expenseResult = await createSalaryExpense(supabase, {
        siteId: config.siteId,
        amount: config.totalAmount,
        date: recordDate,
        description,
        paymentMode: config.paymentMode,
        paidBy: config.userName,
        paidByUserId: config.userId,
        proofUrl: config.proofUrl || null,
        subcontractId: config.subcontractId || null,
        isCleared: true,
        paymentSource: "direct",
      });

      if (expenseResult.error) {
        console.warn("Failed to create salary expense:", expenseResult.error.message);
      } else {
        expenseId = expenseResult.expenseId || undefined;
      }

      // Link expense to attendance records
      if (expenseId) {
        if (dailyIds.length > 0) {
          await supabase
            .from("daily_attendance")
            .update({ expense_id: expenseId })
            .in("id", dailyIds);
        }
        if (marketIds.length > 0) {
          await supabase
            .from("market_laborer_attendance")
            .update({ expense_id: expenseId })
            .in("id", marketIds);
        }
      }
    }

    return {
      success: true,
      expenseId,
      engineerTransactionId: engineerTransactionId || undefined,
    };
  } catch (err: any) {
    console.error("Settlement error:", err);
    return {
      success: false,
      error: err.message || "Failed to process settlement",
    };
  }
}

/**
 * Process a weekly settlement for a date range
 */
export async function processWeeklySettlement(
  supabase: SupabaseClient,
  config: {
    siteId: string;
    dateFrom: string;
    dateTo: string;
    settlementType: "all" | "daily" | "contract" | "market";
    totalAmount: number;
    paymentMode: PaymentMode;
    paymentChannel: PaymentChannel;
    payerSource: PayerSource;
    customPayerName?: string;
    engineerId?: string;
    engineerReference?: string;
    proofUrl?: string;
    notes?: string;
    userId: string;
    userName: string;
  }
): Promise<SettlementResult> {
  try {
    const paymentDate = dayjs().format("YYYY-MM-DD");
    let engineerTransactionId: string | null = null;

    // 1. If via engineer wallet, create engineer transaction
    if (config.paymentChannel === "engineer_wallet" && config.engineerId) {
      const { data: txData, error: txError } = await (supabase
        .from("site_engineer_transactions") as any)
        .insert({
          user_id: config.engineerId,
          site_id: config.siteId,
          transaction_type: "received_from_company",
          settlement_status: "pending_settlement",
          amount: config.totalAmount,
          description: config.engineerReference || `Weekly settlement (${config.dateFrom} - ${config.dateTo})`,
          payment_mode: config.paymentMode,
          proof_url: config.proofUrl || null,
          is_settled: false,
          recorded_by: config.userName,
          recorded_by_user_id: config.userId,
        })
        .select()
        .single();

      if (txError) throw txError;
      engineerTransactionId = txData.id;
    }

    const updateData = {
      is_paid: config.paymentChannel === "direct",
      payment_date: paymentDate,
      payment_mode: config.paymentMode,
      paid_via: config.paymentChannel === "direct" ? "direct" : "engineer_wallet",
      engineer_transaction_id: engineerTransactionId,
      payment_proof_url: config.proofUrl || null,
      payment_notes: config.notes || null,
      payer_source: config.payerSource,
      payer_name: config.payerSource === "custom" ? config.customPayerName : null,
    };

    // 2. Update records based on settlement type
    if (config.settlementType === "daily" || config.settlementType === "all") {
      const { error: dailyError } = await supabase
        .from("daily_attendance")
        .update(updateData)
        .eq("site_id", config.siteId)
        .gte("date", config.dateFrom)
        .lte("date", config.dateTo)
        .eq("is_paid", false)
        .neq("laborer_type", "contract");

      if (dailyError) throw dailyError;
    }

    if (config.settlementType === "contract" || config.settlementType === "all") {
      const { error: contractError } = await supabase
        .from("daily_attendance")
        .update(updateData)
        .eq("site_id", config.siteId)
        .gte("date", config.dateFrom)
        .lte("date", config.dateTo)
        .eq("is_paid", false)
        .eq("laborer_type", "contract");

      if (contractError) throw contractError;
    }

    if (config.settlementType === "market" || config.settlementType === "all") {
      const { error: marketError } = await supabase
        .from("market_laborer_attendance")
        .update(updateData)
        .eq("site_id", config.siteId)
        .gte("date", config.dateFrom)
        .lte("date", config.dateTo)
        .eq("is_paid", false);

      if (marketError) throw marketError;
    }

    // 3. Create salary expense for direct payments
    if (config.paymentChannel === "direct") {
      const expenseResult = await createSalaryExpense(supabase, {
        siteId: config.siteId,
        amount: config.totalAmount,
        date: config.dateFrom,
        description: `Weekly salary settlement (${config.dateFrom} - ${config.dateTo})${config.notes ? ` - ${config.notes}` : ""}`,
        paymentMode: config.paymentMode,
        paidBy: config.userName,
        paidByUserId: config.userId,
        proofUrl: config.proofUrl || null,
        subcontractId: null,
        isCleared: true,
        paymentSource: "direct",
      });

      if (expenseResult.error) {
        console.warn("Failed to create salary expense:", expenseResult.error.message);
      }

      return {
        success: true,
        expenseId: expenseResult.expenseId || undefined,
        engineerTransactionId: engineerTransactionId || undefined,
      };
    }

    return {
      success: true,
      engineerTransactionId: engineerTransactionId || undefined,
    };
  } catch (err: any) {
    console.error("Weekly settlement error:", err);
    return {
      success: false,
      error: err.message || "Failed to process weekly settlement",
    };
  }
}

/**
 * Build a description string for the expense record
 */
function buildExpenseDescription(config: SettlementConfig, laborerCount: number): string {
  const parts: string[] = [];

  parts.push(`Laborer salary (${laborerCount} ${laborerCount === 1 ? "laborer" : "laborers"})`);

  // Add payer info
  const payerLabel = getPayerLabel(config.payerSource, config.customPayerName);
  if (payerLabel !== "Own Money") {
    parts.push(`via ${payerLabel}`);
  }

  // Add notes if present
  if (config.notes) {
    parts.push(config.notes);
  }

  return parts.join(" - ");
}

/**
 * Get display label for payer source
 */
function getPayerLabel(source: PayerSource, customName?: string): string {
  switch (source) {
    case "own_money":
      return "Own Money";
    case "client_money":
      return "Client Money";
    case "mothers_money":
      return "Mother's Money";
    case "custom":
      return customName || "Custom";
    default:
      return source;
  }
}

/**
 * Cancel a settlement and revert attendance records
 */
export async function cancelSettlement(
  supabase: SupabaseClient,
  config: {
    siteId: string;
    records: { sourceType: "daily" | "market"; sourceId: string; expenseId?: string; engineerTransactionId?: string }[];
    userId: string;
    userName: string;
    reason?: string;
  }
): Promise<SettlementResult> {
  try {
    // Reset attendance records
    const dailyIds = config.records
      .filter((r) => r.sourceType === "daily")
      .map((r) => r.sourceId);
    const marketIds = config.records
      .filter((r) => r.sourceType === "market")
      .map((r) => r.sourceId);

    const resetData = {
      is_paid: false,
      payment_date: null,
      payment_mode: null,
      paid_via: null,
      engineer_transaction_id: null,
      payment_proof_url: null,
      payment_notes: null,
      payer_source: null,
      payer_name: null,
      expense_id: null,
    };

    if (dailyIds.length > 0) {
      const { error } = await supabase
        .from("daily_attendance")
        .update(resetData)
        .in("id", dailyIds);
      if (error) throw error;
    }

    if (marketIds.length > 0) {
      const { error } = await supabase
        .from("market_laborer_attendance")
        .update(resetData)
        .in("id", marketIds);
      if (error) throw error;
    }

    // Delete linked expenses
    const expenseIds = [...new Set(config.records.map((r) => r.expenseId).filter(Boolean))];
    if (expenseIds.length > 0) {
      await supabase.from("expenses").delete().in("id", expenseIds);
    }

    // Handle engineer transactions
    const txIds = [...new Set(config.records.map((r) => r.engineerTransactionId).filter(Boolean))];
    for (const txId of txIds) {
      // Check if transaction still has linked records
      const { count: dailyCount } = await supabase
        .from("daily_attendance")
        .select("*", { count: "exact", head: true })
        .eq("engineer_transaction_id", txId);

      const { count: marketCount } = await supabase
        .from("market_laborer_attendance")
        .select("*", { count: "exact", head: true })
        .eq("engineer_transaction_id", txId);

      if ((dailyCount || 0) + (marketCount || 0) === 0) {
        // No more linked records, cancel the transaction
        await supabase
          .from("site_engineer_transactions")
          .update({
            settlement_status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: config.userName,
            cancelled_by_user_id: config.userId,
            cancellation_reason: config.reason || null,
          })
          .eq("id", txId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Cancel settlement error:", err);
    return {
      success: false,
      error: err.message || "Failed to cancel settlement",
    };
  }
}
