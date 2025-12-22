import { SupabaseClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { createSalaryExpense } from "./notificationService";
import type {
  PaymentMode,
  PaymentChannel,
  ContractPaymentType,
  ContractPaymentConfig,
  PaymentDetails,
  PaymentWeekAllocation,
} from "@/types/payment.types";
import type { PayerSource, SettlementRecord } from "@/types/settlement.types";

export interface SettlementResult {
  success: boolean;
  expenseId?: string;
  engineerTransactionId?: string;
  settlementReference?: string;
  settlementGroupId?: string;
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
 *
 * Now creates a settlement_group as the single source of truth.
 * Expenses are derived from settlement_groups via the v_all_expenses view.
 */
export async function processSettlement(
  supabase: SupabaseClient,
  config: SettlementConfig
): Promise<SettlementResult> {
  try {
    const paymentDate = dayjs().format("YYYY-MM-DD");
    let engineerTransactionId: string | null = null;
    let settlementGroupId: string | undefined;
    let settlementReference: string | undefined;

    // Get subcontract from config OR from existing attendance records
    // This handles the case where a settlement was canceled and re-created
    let effectiveSubcontractId = config.subcontractId;
    if (!effectiveSubcontractId && config.records.length > 0) {
      effectiveSubcontractId = await getSubcontractFromAttendanceRecords(supabase, config.records) ?? undefined;
    }

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
          related_subcontract_id: effectiveSubcontractId || null,
        })
        .select()
        .single();

      if (txError) throw txError;
      engineerTransactionId = txData.id;
    }

    // 2. Generate settlement reference and create settlement_group
    const { data: refData, error: refError } = await supabase.rpc(
      "generate_settlement_reference",
      { p_site_id: config.siteId }
    );

    if (refError) {
      console.warn("Could not generate settlement reference:", refError);
      // Fallback reference
      settlementReference = `SET-${dayjs().format("YYYYMM")}-${Date.now().toString().slice(-4)}`;
    } else {
      settlementReference = refData as string;
    }

    // Calculate laborer count (market records may have count field)
    const laborerCount = config.records.reduce((sum, r) => {
      if (r.sourceType === "market" && r.count) {
        return sum + r.count;
      }
      return sum + 1;
    }, 0);

    // Get the record date (use first record's date)
    const recordDate = config.records.length > 0 ? config.records[0].date : paymentDate;

    // Create settlement_group as the single source of truth
    const { data: groupData, error: groupError } = await (supabase
      .from("settlement_groups") as any)
      .insert({
        settlement_reference: settlementReference,
        site_id: config.siteId,
        settlement_date: recordDate,
        total_amount: config.totalAmount,
        laborer_count: laborerCount,
        payment_channel: config.paymentChannel,
        payment_mode: config.paymentMode,
        payer_source: config.payerSource,
        payer_name: config.payerSource === "custom" || config.payerSource === "other_site_money"
          ? config.customPayerName
          : null,
        proof_url: config.proofUrl || null,
        notes: config.notes || null,
        subcontract_id: effectiveSubcontractId || null,
        engineer_transaction_id: engineerTransactionId,
        created_by: config.userId,
        created_by_name: config.userName,
      })
      .select()
      .single();

    if (groupError) {
      console.error("Error creating settlement_group:", groupError);
      throw groupError;
    }

    settlementGroupId = groupData.id;

    // 3. Update attendance records with settlement_group_id
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
      settlement_group_id: settlementGroupId,
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
          subcontract_id: effectiveSubcontractId || null,
        })
        .in("id", dailyIds);

      if (dailyError) throw dailyError;
    }

    // Update market_laborer_attendance records
    if (marketIds.length > 0) {
      const { error: marketError } = await supabase
        .from("market_laborer_attendance")
        .update({
          ...updateData,
          subcontract_id: effectiveSubcontractId || null,
        })
        .in("id", marketIds);

      if (marketError) throw marketError;
    }

    // NOTE: We no longer create salary expenses here!
    // Expenses are now derived from settlement_groups via the v_all_expenses view.
    // This ensures single source of truth and automatic sync of changes.

    return {
      success: true,
      settlementReference,
      settlementGroupId,
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
 * Now creates a settlement_group as the single source of truth.
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
    subcontractId?: string;
    userId: string;
    userName: string;
  }
): Promise<SettlementResult> {
  try {
    const paymentDate = dayjs().format("YYYY-MM-DD");
    let engineerTransactionId: string | null = null;
    let settlementGroupId: string | undefined;
    let settlementReference: string | undefined;

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
          related_subcontract_id: config.subcontractId || null,
        })
        .select()
        .single();

      if (txError) throw txError;
      engineerTransactionId = txData.id;
    }

    // 2. Generate settlement reference
    const { data: refData, error: refError } = await supabase.rpc(
      "generate_settlement_reference",
      { p_site_id: config.siteId }
    );

    if (refError) {
      console.warn("Could not generate settlement reference:", refError);
      settlementReference = `SET-${dayjs().format("YYYYMM")}-${Date.now().toString().slice(-4)}`;
    } else {
      settlementReference = refData as string;
    }

    // 3. Count records that will be settled
    let laborerCount = 0;

    if (config.settlementType === "daily" || config.settlementType === "all") {
      const { count } = await supabase
        .from("daily_attendance")
        .select("*", { count: "exact", head: true })
        .eq("site_id", config.siteId)
        .gte("date", config.dateFrom)
        .lte("date", config.dateTo)
        .eq("is_paid", false)
        .neq("laborer_type", "contract");
      laborerCount += count || 0;
    }

    if (config.settlementType === "contract" || config.settlementType === "all") {
      const { count } = await supabase
        .from("daily_attendance")
        .select("*", { count: "exact", head: true })
        .eq("site_id", config.siteId)
        .gte("date", config.dateFrom)
        .lte("date", config.dateTo)
        .eq("is_paid", false)
        .eq("laborer_type", "contract");
      laborerCount += count || 0;
    }

    if (config.settlementType === "market" || config.settlementType === "all") {
      const { data: marketData } = await supabase
        .from("market_laborer_attendance")
        .select("count")
        .eq("site_id", config.siteId)
        .gte("date", config.dateFrom)
        .lte("date", config.dateTo)
        .eq("is_paid", false);
      laborerCount += (marketData || []).reduce((sum, r) => sum + (r.count || 1), 0);
    }

    // 4. Create settlement_group
    const { data: groupData, error: groupError } = await (supabase
      .from("settlement_groups") as any)
      .insert({
        settlement_reference: settlementReference,
        site_id: config.siteId,
        settlement_date: config.dateFrom,
        total_amount: config.totalAmount,
        laborer_count: laborerCount,
        payment_channel: config.paymentChannel,
        payment_mode: config.paymentMode,
        payer_source: config.payerSource,
        payer_name: config.payerSource === "custom" || config.payerSource === "other_site_money"
          ? config.customPayerName
          : null,
        proof_url: config.proofUrl || null,
        notes: config.notes ? `Weekly (${config.dateFrom} - ${config.dateTo}): ${config.notes}` : `Weekly settlement (${config.dateFrom} - ${config.dateTo})`,
        subcontract_id: config.subcontractId || null,
        engineer_transaction_id: engineerTransactionId,
        created_by: config.userId,
        created_by_name: config.userName,
      })
      .select()
      .single();

    if (groupError) {
      console.error("Error creating settlement_group:", groupError);
      throw groupError;
    }

    settlementGroupId = groupData.id;

    // 5. Update attendance records with settlement_group_id
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
      settlement_group_id: settlementGroupId,
    };

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

    // NOTE: We no longer create salary expenses here!
    // Expenses are now derived from settlement_groups via the v_all_expenses view.

    return {
      success: true,
      settlementReference,
      settlementGroupId,
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
 * Now marks settlement_groups as cancelled instead of deleting expenses.
 */
export async function cancelSettlement(
  supabase: SupabaseClient,
  config: {
    siteId: string;
    records: { sourceType: "daily" | "market"; sourceId: string; expenseId?: string; engineerTransactionId?: string; settlementGroupId?: string }[];
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
      settlement_group_id: null,
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

    // Mark settlement_groups as cancelled (instead of deleting expenses)
    const groupIds = [...new Set(config.records.map((r) => r.settlementGroupId).filter(Boolean))];
    for (const groupId of groupIds) {
      // Check if group still has linked records
      const { count: dailyCount } = await supabase
        .from("daily_attendance")
        .select("*", { count: "exact", head: true })
        .eq("settlement_group_id", groupId);

      const { count: marketCount } = await supabase
        .from("market_laborer_attendance")
        .select("*", { count: "exact", head: true })
        .eq("settlement_group_id", groupId);

      if ((dailyCount || 0) + (marketCount || 0) === 0) {
        // No more linked records, mark the group as cancelled
        await (supabase.from("settlement_groups") as any)
          .update({
            is_cancelled: true,
            cancelled_at: new Date().toISOString(),
            cancelled_by: config.userName,
            cancelled_by_user_id: config.userId,
            cancellation_reason: config.reason || null,
          })
          .eq("id", groupId);
      }
    }

    // Handle engineer transactions (legacy - still needed for old data)
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

    // Delete old-style linked expenses (for backward compatibility during migration)
    const expenseIds = [...new Set(config.records.map((r) => r.expenseId).filter(Boolean))];
    if (expenseIds.length > 0) {
      await supabase.from("expenses").delete().in("id", expenseIds);
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

/**
 * Get subcontract_id from existing attendance records.
 * This is used when re-settling after a cancel to preserve the subcontract link.
 */
async function getSubcontractFromAttendanceRecords(
  supabase: SupabaseClient,
  records: { sourceType: "daily" | "market"; sourceId: string }[]
): Promise<string | null> {
  // Check daily attendance records first
  const dailyIds = records.filter((r) => r.sourceType === "daily").map((r) => r.sourceId);
  if (dailyIds.length > 0) {
    const { data: dailyData } = await supabase
      .from("daily_attendance")
      .select("subcontract_id")
      .in("id", dailyIds)
      .not("subcontract_id", "is", null)
      .limit(1);

    if (dailyData && dailyData.length > 0 && dailyData[0].subcontract_id) {
      return dailyData[0].subcontract_id;
    }
  }

  // Check market attendance records
  const marketIds = records.filter((r) => r.sourceType === "market").map((r) => r.sourceId);
  if (marketIds.length > 0) {
    const { data: marketData } = await (supabase
      .from("market_laborer_attendance") as any)
      .select("subcontract_id")
      .in("id", marketIds)
      .not("subcontract_id", "is", null)
      .limit(1);

    if (marketData && marketData.length > 0 && marketData[0].subcontract_id) {
      return marketData[0].subcontract_id;
    }
  }

  return null;
}

// ============================================================================
// CONTRACT PAYMENT FUNCTIONS (NEW)
// ============================================================================

export interface ContractPaymentResult extends SettlementResult {
  paymentId?: string;
  paymentReference?: string;
  allocations?: PaymentWeekAllocation[];
}

/**
 * Process a contract laborer payment with auto-allocation for salary payments.
 * Each payment gets its own unique reference code.
 */
export async function processContractPayment(
  supabase: SupabaseClient,
  config: ContractPaymentConfig
): Promise<ContractPaymentResult> {
  try {
    const paymentDate = dayjs().format("YYYY-MM-DD");
    let engineerTransactionId: string | null = null;
    let settlementGroupId: string | undefined;
    let settlementReference: string | undefined;
    let paymentReference: string | undefined;
    let paymentId: string | undefined;
    const allocations: PaymentWeekAllocation[] = [];

    // 1. If via engineer wallet, create engineer transaction first
    if (config.paymentChannel === "engineer_wallet" && config.engineerId) {
      const { data: txData, error: txError } = await (supabase
        .from("site_engineer_transactions") as any)
        .insert({
          user_id: config.engineerId,
          site_id: config.siteId,
          transaction_type: "received_from_company",
          settlement_status: "pending_settlement",
          amount: config.amount,
          description: `Contract payment for ${config.laborerName}`,
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

    // 2. Generate settlement reference for the settlement_group
    const { data: refData, error: refError } = await supabase.rpc(
      "generate_settlement_reference",
      { p_site_id: config.siteId }
    );

    if (refError) {
      console.warn("Could not generate settlement reference:", refError);
      settlementReference = `SET-${dayjs().format("YYYYMM")}-${Date.now().toString().slice(-4)}`;
    } else {
      settlementReference = refData as string;
    }

    // 3. Generate unique payment reference for this payment
    const { data: payRefData, error: payRefError } = await supabase.rpc(
      "generate_payment_reference",
      { p_site_id: config.siteId }
    );

    if (payRefError) {
      console.warn("Could not generate payment reference:", payRefError);
      paymentReference = `PAY-${dayjs().format("YYYYMM")}-${Date.now().toString().slice(-4)}`;
    } else {
      paymentReference = payRefData as string;
    }

    // 4. Create settlement_group
    const { data: groupData, error: groupError } = await (supabase
      .from("settlement_groups") as any)
      .insert({
        settlement_reference: settlementReference,
        site_id: config.siteId,
        settlement_date: config.actualPaymentDate,
        total_amount: config.amount,
        laborer_count: 1,
        payment_channel: config.paymentChannel,
        payment_mode: config.paymentMode,
        payment_type: config.paymentType,
        actual_payment_date: config.actualPaymentDate,
        payer_source: config.payerSource,
        payer_name: config.payerSource === "custom" ? config.customPayerName : null,
        proof_url: config.proofUrl || null,
        notes: config.notes || null,
        subcontract_id: config.subcontractId || null,
        engineer_transaction_id: engineerTransactionId,
        created_by: config.userId,
        created_by_name: config.userName,
      })
      .select()
      .single();

    if (groupError) {
      console.error("Error creating settlement_group:", groupError);
      throw groupError;
    }

    settlementGroupId = groupData.id;

    // 5. Create labor_payments record with unique payment_reference
    const { data: paymentData, error: paymentError } = await (supabase
      .from("labor_payments") as any)
      .insert({
        laborer_id: config.laborerId,
        site_id: config.siteId,
        payment_date: paymentDate,
        payment_for_date: config.paymentForDate,
        actual_payment_date: config.actualPaymentDate,
        amount: config.amount,
        payment_mode: config.paymentMode,
        payment_channel: config.paymentChannel,
        payment_type: config.paymentType,
        payment_reference: paymentReference,
        is_under_contract: true,
        subcontract_id: config.subcontractId || null,
        proof_url: config.proofUrl || null,
        paid_by: config.userName,
        paid_by_user_id: config.userId,
        recorded_by: config.userName,
        recorded_by_user_id: config.userId,
        notes: config.notes || null,
        settlement_group_id: settlementGroupId,
        site_engineer_transaction_id: engineerTransactionId,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating labor_payment:", paymentError);
      throw paymentError;
    }

    paymentId = paymentData.id;

    // 6. If salary payment, allocate to weeks (oldest first)
    if (config.paymentType === "salary" && paymentId) {
      const allocResult = await allocateSalaryToWeeks(supabase, {
        laborPaymentId: paymentId,
        laborerId: config.laborerId,
        siteId: config.siteId,
        amount: config.amount,
        paymentDate: config.actualPaymentDate,
      });
      allocations.push(...allocResult);
    }

    // 7. If advance payment, update laborer's total_advance_given
    if (config.paymentType === "advance") {
      const { error: updateError } = await supabase.rpc("increment_laborer_advance", {
        p_laborer_id: config.laborerId,
        p_amount: config.amount,
      });

      // If RPC doesn't exist, do it manually
      if (updateError) {
        console.warn("increment_laborer_advance RPC not found, updating manually");
        const { data: laborer } = await supabase
          .from("laborers")
          .select("total_advance_given")
          .eq("id", config.laborerId)
          .single();

        await supabase
          .from("laborers")
          .update({
            total_advance_given: (laborer?.total_advance_given || 0) + config.amount,
          })
          .eq("id", config.laborerId);
      }
    }

    return {
      success: true,
      paymentId,
      paymentReference,
      settlementReference,
      settlementGroupId,
      engineerTransactionId: engineerTransactionId || undefined,
      allocations,
    };
  } catch (err: any) {
    console.error("Contract payment error:", err);
    return {
      success: false,
      error: err.message || "Failed to process contract payment",
    };
  }
}

/**
 * Allocate salary payment to weeks chronologically (oldest unpaid first).
 * Creates payment_week_allocations records and marks attendance as paid when fully covered.
 */
async function allocateSalaryToWeeks(
  supabase: SupabaseClient,
  config: {
    laborPaymentId: string;
    laborerId: string;
    siteId: string;
    amount: number;
    paymentDate: string;
  }
): Promise<PaymentWeekAllocation[]> {
  const allocations: PaymentWeekAllocation[] = [];
  let remainingAmount = config.amount;

  // Get all unpaid or partially paid weeks for this laborer, ordered oldest first
  const { data: attendanceData, error: attendanceError } = await supabase
    .from("daily_attendance")
    .select(`
      id,
      date,
      daily_earnings,
      is_paid,
      payment_id
    `)
    .eq("site_id", config.siteId)
    .eq("laborer_id", config.laborerId)
    .eq("is_paid", false)
    .order("date", { ascending: true });

  if (attendanceError || !attendanceData) {
    console.warn("Could not fetch attendance for allocation:", attendanceError);
    return allocations;
  }

  // Group by week
  const weeklyData = new Map<string, { weekStart: string; weekEnd: string; totalDue: number; attendanceIds: string[] }>();

  for (const att of attendanceData) {
    const d = dayjs(att.date);
    const weekStart = d.day(0).format("YYYY-MM-DD"); // Sunday
    const weekEnd = d.day(6).format("YYYY-MM-DD"); // Saturday

    if (!weeklyData.has(weekStart)) {
      weeklyData.set(weekStart, { weekStart, weekEnd, totalDue: 0, attendanceIds: [] });
    }
    const week = weeklyData.get(weekStart)!;
    week.totalDue += att.daily_earnings || 0;
    week.attendanceIds.push(att.id);
  }

  // Sort weeks by date (oldest first)
  const sortedWeeks = Array.from(weeklyData.values()).sort(
    (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  );

  // Allocate payment to weeks
  for (const week of sortedWeeks) {
    if (remainingAmount <= 0) break;

    const allocatedAmount = Math.min(remainingAmount, week.totalDue);

    if (allocatedAmount > 0) {
      // Create allocation record
      const { data: allocData, error: allocError } = await supabase
        .from("payment_week_allocations")
        .insert({
          labor_payment_id: config.laborPaymentId,
          laborer_id: config.laborerId,
          site_id: config.siteId,
          week_start: week.weekStart,
          week_end: week.weekEnd,
          allocated_amount: allocatedAmount,
        })
        .select()
        .single();

      if (allocError) {
        console.error("Error creating week allocation:", allocError);
        continue;
      }

      allocations.push({
        id: allocData.id,
        laborPaymentId: config.laborPaymentId,
        laborerId: config.laborerId,
        siteId: config.siteId,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        allocatedAmount,
        createdAt: allocData.created_at,
      });

      // If this allocation covers the full week, mark attendance as paid
      if (allocatedAmount >= week.totalDue) {
        await supabase
          .from("daily_attendance")
          .update({
            is_paid: true,
            payment_date: config.paymentDate,
            payment_id: config.laborPaymentId,
          })
          .in("id", week.attendanceIds);
      }

      remainingAmount -= allocatedAmount;
    }
  }

  return allocations;
}

/**
 * Get payment details by reference code (for ref code popup)
 * Handles both formats:
 * - PAY-YYYYMM-NNN (new format from labor_payments.payment_reference)
 * - SET-YYYYMM-NNN (old format from settlement_groups.settlement_reference)
 */
export async function getPaymentByReference(
  supabase: SupabaseClient,
  reference: string
): Promise<PaymentDetails | null> {
  try {
    let payment: any = null;
    let settlementGroup: any = null;

    // Detect reference format and query accordingly
    if (reference.startsWith("PAY-")) {
      // New format: Query directly by payment_reference
      const { data, error } = await supabase
        .from("labor_payments")
        .select(`
          *,
          laborers(name, labor_roles(name)),
          subcontracts(title),
          settlement_groups(settlement_reference, payer_source, payer_name)
        `)
        .eq("payment_reference", reference)
        .single();

      if (!error && data) {
        payment = data;
        settlementGroup = (data as any).settlement_groups;
      }
    }

    // If not found by PAY-* or reference is SET-*, query through settlement_groups
    if (!payment && reference.startsWith("SET-")) {
      // Old format: Query settlement_groups first, then labor_payments
      const { data: sg, error: sgError } = await (supabase
        .from("settlement_groups") as any)
        .select("id, settlement_reference, payer_source, payer_name, proof_url, notes, payment_mode, payment_channel, actual_payment_date, settlement_date, total_amount, subcontract_id, created_at, created_by_name")
        .eq("settlement_reference", reference)
        .single();

      if (sgError || !sg) {
        console.error("Settlement group not found:", sgError);
        return null;
      }

      settlementGroup = sg;

      // Query labor_payments by settlement_group_id
      const { data: paymentData, error: paymentError } = await supabase
        .from("labor_payments")
        .select(`
          *,
          laborers(name, labor_roles(name)),
          subcontracts(title)
        `)
        .eq("settlement_group_id", sg.id)
        .limit(1)
        .maybeSingle();

      if (paymentData) {
        payment = paymentData;
      } else {
        // Old settlement without labor_payments record (daily/market settlement)
        // Return settlement_group data as payment details
        return {
          paymentId: sg.id,
          paymentReference: sg.settlement_reference,
          amount: sg.total_amount,
          paymentType: "salary",
          actualPaymentDate: sg.actual_payment_date || sg.settlement_date,
          paymentForDate: sg.settlement_date,
          weeksCovered: [],
          laborerId: "",
          laborerName: "Multiple Laborers",
          laborerRole: undefined,
          paidBy: sg.created_by_name || "Unknown",
          paidByUserId: "",
          paymentMode: sg.payment_mode,
          paymentChannel: sg.payment_channel,
          proofUrl: sg.proof_url,
          notes: sg.notes,
          subcontractId: sg.subcontract_id,
          subcontractTitle: null,
          payerSource: sg.payer_source,
          payerName: sg.payer_name,
          settlementGroupId: sg.id,
          settlementReference: sg.settlement_reference,
          createdAt: sg.created_at,
        };
      }
    }

    if (!payment) {
      console.error("Payment not found for reference:", reference);
      return null;
    }

    // Fetch allocations
    const { data: allocations } = await supabase
      .from("payment_week_allocations")
      .select("*")
      .eq("labor_payment_id", payment.id)
      .order("week_start", { ascending: true });

    const weeksCovered = (allocations || []).map((a: any) => ({
      weekStart: a.week_start,
      weekEnd: a.week_end,
      allocatedAmount: a.allocated_amount,
    }));

    return {
      paymentId: payment.id,
      paymentReference: payment.payment_reference || settlementGroup?.settlement_reference || reference,
      amount: payment.amount,
      paymentType: payment.payment_type || "salary",
      actualPaymentDate: payment.actual_payment_date || payment.payment_date,
      paymentForDate: payment.payment_for_date,
      weeksCovered,
      laborerId: payment.laborer_id,
      laborerName: (payment as any).laborers?.name || "Unknown",
      laborerRole: (payment as any).laborers?.labor_roles?.name,
      paidBy: payment.paid_by,
      paidByUserId: payment.paid_by_user_id,
      paymentMode: payment.payment_mode,
      paymentChannel: payment.payment_channel,
      proofUrl: payment.proof_url,
      notes: payment.notes,
      subcontractId: payment.subcontract_id,
      subcontractTitle: (payment as any).subcontracts?.title || null,
      payerSource: settlementGroup?.payer_source || null,
      payerName: settlementGroup?.payer_name || null,
      settlementGroupId: payment.settlement_group_id,
      settlementReference: settlementGroup?.settlement_reference || (payment as any).settlement_groups?.settlement_reference || null,
      createdAt: payment.created_at,
    };
  } catch (err: any) {
    console.error("Error fetching payment by reference:", err);
    return null;
  }
}

/**
 * Update an existing contract payment
 */
export async function updateContractPayment(
  supabase: SupabaseClient,
  paymentId: string,
  updates: {
    amount?: number;
    actualPaymentDate?: string;
    paymentType?: ContractPaymentType;
    paymentMode?: PaymentMode;
    proofUrl?: string | null;
    notes?: string | null;
    subcontractId?: string | null;
    userId: string;
    userName: string;
  }
): Promise<ContractPaymentResult> {
  try {
    // Get existing payment
    const { data: existingPayment, error: fetchError } = await supabase
      .from("labor_payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (fetchError || !existingPayment) {
      throw new Error("Payment not found");
    }

    // Build update object
    const updateData: any = {};
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.actualPaymentDate !== undefined) updateData.actual_payment_date = updates.actualPaymentDate;
    if (updates.paymentType !== undefined) updateData.payment_type = updates.paymentType;
    if (updates.paymentMode !== undefined) updateData.payment_mode = updates.paymentMode;
    if (updates.proofUrl !== undefined) updateData.proof_url = updates.proofUrl;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.subcontractId !== undefined) updateData.subcontract_id = updates.subcontractId;

    // Update the payment
    const { error: updateError } = await supabase
      .from("labor_payments")
      .update(updateData)
      .eq("id", paymentId);

    if (updateError) throw updateError;

    // If amount or payment_type changed, recalculate allocations
    if (updates.amount !== undefined || updates.paymentType !== undefined) {
      const newPaymentType = updates.paymentType || existingPayment.payment_type || "salary";
      const newAmount = updates.amount || existingPayment.amount;

      // Delete existing allocations
      await supabase
        .from("payment_week_allocations")
        .delete()
        .eq("labor_payment_id", paymentId);

      // Reset attendance records that were marked paid by this payment
      await supabase
        .from("daily_attendance")
        .update({ is_paid: false, payment_id: null })
        .eq("payment_id", paymentId);

      // Re-allocate if salary payment
      if (newPaymentType === "salary") {
        await allocateSalaryToWeeks(supabase, {
          laborPaymentId: paymentId,
          laborerId: existingPayment.laborer_id,
          siteId: existingPayment.site_id,
          amount: newAmount,
          paymentDate: updates.actualPaymentDate || existingPayment.actual_payment_date || existingPayment.payment_date,
        });
      }
    }

    // Update settlement_group if it exists
    if (existingPayment.settlement_group_id) {
      const groupUpdates: any = {};
      if (updates.amount !== undefined) groupUpdates.total_amount = updates.amount;
      if (updates.actualPaymentDate !== undefined) groupUpdates.actual_payment_date = updates.actualPaymentDate;
      if (updates.paymentType !== undefined) groupUpdates.payment_type = updates.paymentType;
      if (updates.paymentMode !== undefined) groupUpdates.payment_mode = updates.paymentMode;
      if (updates.proofUrl !== undefined) groupUpdates.proof_url = updates.proofUrl;
      if (updates.notes !== undefined) groupUpdates.notes = updates.notes;

      if (Object.keys(groupUpdates).length > 0) {
        await (supabase.from("settlement_groups") as any)
          .update(groupUpdates)
          .eq("id", existingPayment.settlement_group_id);
      }
    }

    return {
      success: true,
      paymentId,
      paymentReference: existingPayment.payment_reference,
    };
  } catch (err: any) {
    console.error("Update contract payment error:", err);
    return {
      success: false,
      error: err.message || "Failed to update payment",
    };
  }
}

/**
 * Cancel/delete a contract payment (soft delete)
 */
export async function cancelContractPayment(
  supabase: SupabaseClient,
  paymentId: string,
  reason: string,
  userId: string,
  userName: string
): Promise<ContractPaymentResult> {
  try {
    // Get existing payment
    const { data: existingPayment, error: fetchError } = await supabase
      .from("labor_payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (fetchError || !existingPayment) {
      throw new Error("Payment not found");
    }

    // Delete payment allocations
    await supabase
      .from("payment_week_allocations")
      .delete()
      .eq("labor_payment_id", paymentId);

    // Reset attendance records that were marked paid by this payment
    await supabase
      .from("daily_attendance")
      .update({ is_paid: false, payment_id: null })
      .eq("payment_id", paymentId);

    // If advance payment, reduce laborer's total_advance_given
    if (existingPayment.payment_type === "advance") {
      const { data: laborer } = await supabase
        .from("laborers")
        .select("total_advance_given")
        .eq("id", existingPayment.laborer_id)
        .single();

      await supabase
        .from("laborers")
        .update({
          total_advance_given: Math.max(0, (laborer?.total_advance_given || 0) - existingPayment.amount),
        })
        .eq("id", existingPayment.laborer_id);
    }

    // Delete the labor_payment record
    await supabase
      .from("labor_payments")
      .delete()
      .eq("id", paymentId);

    // Cancel the settlement_group if it exists
    if (existingPayment.settlement_group_id) {
      await (supabase.from("settlement_groups") as any)
        .update({
          is_cancelled: true,
          cancelled_at: new Date().toISOString(),
          cancelled_by: userName,
          cancelled_by_user_id: userId,
          cancellation_reason: reason,
        })
        .eq("id", existingPayment.settlement_group_id);
    }

    // Cancel engineer transaction if it exists
    if (existingPayment.site_engineer_transaction_id) {
      await supabase
        .from("site_engineer_transactions")
        .update({
          settlement_status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: userName,
          cancelled_by_user_id: userId,
          cancellation_reason: reason,
        })
        .eq("id", existingPayment.site_engineer_transaction_id);
    }

    return {
      success: true,
      paymentId,
    };
  } catch (err: any) {
    console.error("Cancel contract payment error:", err);
    return {
      success: false,
      error: err.message || "Failed to cancel payment",
    };
  }
}

/**
 * Contract payment history record for list display
 */
export interface ContractPaymentHistoryRecord {
  id: string;
  paymentReference: string | null;
  settlementReference: string | null;
  laborerId: string;
  laborerName: string;
  laborerRole: string | null;
  amount: number;
  paymentType: ContractPaymentType;
  paymentMode: PaymentMode | null;
  paymentChannel: PaymentChannel | null;
  actualPaymentDate: string;
  paymentDate: string;
  // Payment source - who actually paid (company money, own money, trust account, etc.)
  payerSource: string | null;
  payerName: string | null;
  // Audit fields
  recordedBy: string;
  recordedByUserId: string | null;
  createdAt: string;
  // Legacy field - kept for backward compatibility (same as recordedBy)
  paidBy: string;
  proofUrl: string | null;
  notes: string | null;
  subcontractId: string | null;
  subcontractTitle: string | null;
}

/**
 * Fetch all contract labor payments for a site, ordered by date (newest first)
 */
export async function getContractPaymentHistory(
  supabase: SupabaseClient,
  siteId: string,
  options?: {
    limit?: number;
    offset?: number;
    laborerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<{ payments: ContractPaymentHistoryRecord[]; total: number }> {
  try {
    // Build query
    let query = supabase
      .from("labor_payments")
      .select(`
        id,
        payment_reference,
        laborer_id,
        amount,
        payment_type,
        payment_mode,
        payment_channel,
        actual_payment_date,
        payment_date,
        paid_by,
        paid_by_user_id,
        recorded_by,
        recorded_by_user_id,
        proof_url,
        notes,
        subcontract_id,
        created_at,
        settlement_group_id,
        laborers(name, labor_roles(name)),
        subcontracts(title),
        settlement_groups(settlement_reference, payer_source, payer_name)
      `, { count: "exact" })
      .eq("site_id", siteId)
      .eq("is_under_contract", true);

    // Apply filters
    if (options?.laborerId) {
      query = query.eq("laborer_id", options.laborerId);
    }
    if (options?.dateFrom) {
      query = query.gte("actual_payment_date", options.dateFrom);
    }
    if (options?.dateTo) {
      query = query.lte("actual_payment_date", options.dateTo);
    }

    // Order by date (newest first) and apply pagination
    query = query.order("actual_payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching contract payment history:", error);
      throw error;
    }

    const payments: ContractPaymentHistoryRecord[] = (data || []).map((p: any) => ({
      id: p.id,
      paymentReference: p.payment_reference,
      settlementReference: p.settlement_groups?.settlement_reference || null,
      laborerId: p.laborer_id,
      laborerName: p.laborers?.name || "Unknown",
      laborerRole: p.laborers?.labor_roles?.name || null,
      amount: p.amount,
      paymentType: p.payment_type || "salary",
      paymentMode: p.payment_mode,
      paymentChannel: p.payment_channel,
      actualPaymentDate: p.actual_payment_date || p.payment_date,
      paymentDate: p.payment_date,
      // Payment source from settlement_groups
      payerSource: p.settlement_groups?.payer_source || null,
      payerName: p.settlement_groups?.payer_name || null,
      // Audit fields
      recordedBy: p.recorded_by || p.paid_by || "Unknown",
      recordedByUserId: p.recorded_by_user_id || p.paid_by_user_id || null,
      createdAt: p.created_at,
      // Legacy field
      paidBy: p.paid_by || "Unknown",
      proofUrl: p.proof_url,
      notes: p.notes,
      subcontractId: p.subcontract_id,
      subcontractTitle: p.subcontracts?.title || null,
    }));

    return { payments, total: count || 0 };
  } catch (err: any) {
    console.error("Error in getContractPaymentHistory:", err);
    return { payments: [], total: 0 };
  }
}
