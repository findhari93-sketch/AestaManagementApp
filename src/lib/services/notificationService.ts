import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";

export interface LaborerDetails {
  dailyCount: number;
  marketCount: number;
  totalAmount: number;
  laborerNames?: string[];
}

export interface TransactionWithLaborers {
  id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  settlement_status: string | null;
  settlement_mode: string | null;
  settlement_proof_url: string | null;
  settlement_reason?: string | null;
  dispute_notes?: string | null;
  user_id: string;
  site_id: string | null;
  engineer_name?: string;
  daily_attendance: Array<{
    id: string;
    laborer_name: string;
    daily_earnings: number;
    date: string;
  }>;
  market_attendance: Array<{
    id: string;
    role_name: string;
    count: number;
    rate_per_person: number;
    total_cost: number;
    date: string;
  }>;
}

/**
 * Create a payment settlement notification for a site engineer
 * Called when admin sends money to engineer via engineer wallet
 */
export async function createPaymentSettlementNotification(
  supabase: SupabaseClient<Database>,
  transactionId: string,
  engineerId: string,
  amount: number,
  laborerDetails: LaborerDetails,
  siteName?: string
): Promise<{ error: Error | null }> {
  try {
    const laborerText =
      laborerDetails.dailyCount + laborerDetails.marketCount > 0
        ? `${laborerDetails.dailyCount + laborerDetails.marketCount} laborers (${laborerDetails.dailyCount} daily, ${laborerDetails.marketCount} market)`
        : "laborers";

    const message = siteName
      ? `₹${amount.toLocaleString("en-IN")} received for ${laborerText} at ${siteName}. Tap to settle.`
      : `₹${amount.toLocaleString("en-IN")} received for ${laborerText}. Tap to settle.`;

    const { error } = await supabase.from("notifications").insert({
      user_id: engineerId,
      title: "Payment Received for Settlement",
      message,
      notification_type: "payment_settlement_pending",
      related_id: transactionId,
      related_table: "site_engineer_transactions",
      is_read: false,
    });

    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error("Error creating payment settlement notification:", err);
    return { error: err as Error };
  }
}

/**
 * Create notifications for all admin and office users when engineer completes settlement
 */
export async function createSettlementCompletedNotifications(
  supabase: SupabaseClient<Database>,
  transactionId: string,
  engineerName: string,
  amount: number,
  settlementMode: "upi" | "cash",
  siteName?: string
): Promise<{ error: Error | null }> {
  try {
    // Get all admin and office users
    const adminOfficeUserIds = await getAdminOfficeUserIds(supabase);

    if (adminOfficeUserIds.length === 0) {
      console.warn("No admin/office users found to notify");
      return { error: null };
    }

    const modeText = settlementMode === "upi" ? "UPI" : "Cash";
    const message = siteName
      ? `${engineerName} settled ₹${amount.toLocaleString("en-IN")} via ${modeText} at ${siteName}. Tap to review.`
      : `${engineerName} settled ₹${amount.toLocaleString("en-IN")} via ${modeText}. Tap to review.`;

    // Create notifications for each admin/office user
    const notifications = adminOfficeUserIds.map((userId) => ({
      user_id: userId,
      title: "Payment Settlement Completed",
      message,
      notification_type: "payment_settlement_completed",
      related_id: transactionId,
      related_table: "site_engineer_transactions",
      is_read: false,
    }));

    const { error } = await supabase.from("notifications").insert(notifications);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error("Error creating settlement completed notifications:", err);
    return { error: err as Error };
  }
}

/**
 * Get all admin and office user IDs for notification distribution
 */
export async function getAdminOfficeUserIds(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .in("role", ["admin", "office"])
      .eq("status", "active");

    if (error) throw error;
    return data?.map((user) => user.id) || [];
  } catch (err) {
    console.error("Error fetching admin/office users:", err);
    return [];
  }
}

/**
 * Get transaction with linked laborer details for settlement form
 */
export async function getTransactionWithLaborers(
  supabase: SupabaseClient<Database>,
  transactionId: string
): Promise<{ data: TransactionWithLaborers | null; error: Error | null }> {
  try {
    // Fetch the transaction
    const { data: transaction, error: txError } = await supabase
      .from("site_engineer_transactions")
      .select(
        `
        id,
        amount,
        description,
        transaction_date,
        settlement_status,
        settlement_mode,
        settlement_proof_url,
        notes,
        user_id,
        site_id,
        users!site_engineer_transactions_user_id_fkey (name)
      `
      )
      .eq("id", transactionId)
      .single();

    if (txError) throw txError;
    if (!transaction) throw new Error("Transaction not found");

    // Fetch daily attendance linked to this transaction
    const { data: dailyAttendance, error: dailyError } = await supabase
      .from("daily_attendance")
      .select(
        `
        id,
        daily_earnings,
        date,
        laborers!daily_attendance_laborer_id_fkey (name)
      `
      )
      .eq("engineer_transaction_id", transactionId);

    if (dailyError) throw dailyError;

    // Fetch market laborer attendance linked to this transaction
    const { data: marketAttendance, error: marketError } = await supabase
      .from("market_laborer_attendance")
      .select(
        `
        id,
        count,
        rate_per_person,
        total_cost,
        date,
        laborer_roles!market_laborer_attendance_role_id_fkey (name)
      `
      )
      .eq("engineer_transaction_id", transactionId);

    if (marketError) throw marketError;

    const result: TransactionWithLaborers = {
      id: transaction.id,
      amount: transaction.amount,
      description: transaction.description,
      transaction_date: transaction.transaction_date,
      settlement_status: transaction.settlement_status,
      settlement_mode: transaction.settlement_mode,
      settlement_proof_url: transaction.settlement_proof_url,
      settlement_reason: (transaction as Record<string, unknown>)
        .notes as string | null,
      user_id: transaction.user_id,
      site_id: transaction.site_id,
      engineer_name: (
        transaction.users as unknown as { name: string } | null
      )?.name,
      daily_attendance:
        dailyAttendance?.map((da) => ({
          id: da.id,
          laborer_name:
            (da.laborers as unknown as { name: string } | null)?.name ||
            "Unknown",
          daily_earnings: da.daily_earnings || 0,
          date: da.date,
        })) || [],
      market_attendance:
        marketAttendance?.map((ma) => ({
          id: ma.id,
          role_name:
            (ma.laborer_roles as unknown as { name: string } | null)?.name ||
            "Unknown",
          count: ma.count || 0,
          rate_per_person: ma.rate_per_person || 0,
          total_cost: ma.total_cost || 0,
          date: ma.date,
        })) || [],
    };

    return { data: result, error: null };
  } catch (err) {
    console.error("Error fetching transaction with laborers:", err);
    return { data: null, error: err as Error };
  }
}

/**
 * Submit settlement - update transaction and create notifications for admin/office
 */
export async function submitSettlement(
  supabase: SupabaseClient<Database>,
  transactionId: string,
  settlementMode: "upi" | "cash",
  settledByUserId: string,
  settledByName: string,
  proofUrl?: string,
  reason?: string,
  siteName?: string
): Promise<{ error: Error | null }> {
  try {
    // Update the transaction
    const updateData: Record<string, unknown> = {
      settlement_status: "pending_confirmation",
      settlement_mode: settlementMode,
      settled_by: settledByUserId,
      settled_date: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    };

    if (settlementMode === "upi" && proofUrl) {
      updateData.settlement_proof_url = proofUrl;
    }

    if (settlementMode === "cash" && reason) {
      updateData.notes = reason;
    }

    const { data: transaction, error: updateError } = await supabase
      .from("site_engineer_transactions")
      .update(updateData)
      .eq("id", transactionId)
      .select("amount")
      .single();

    if (updateError) throw updateError;

    // Create notifications for admin/office users
    const { error: notifError } = await createSettlementCompletedNotifications(
      supabase,
      transactionId,
      settledByName,
      transaction?.amount || 0,
      settlementMode,
      siteName
    );

    if (notifError) throw notifError;

    return { error: null };
  } catch (err) {
    console.error("Error submitting settlement:", err);
    return { error: err as Error };
  }
}

/**
 * Confirm settlement - admin action to confirm engineer's settlement
 */
export async function confirmSettlement(
  supabase: SupabaseClient<Database>,
  transactionId: string,
  confirmedByUserId: string,
  confirmedByName: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("site_engineer_transactions")
      .update({
        settlement_status: "confirmed",
        confirmed_by: confirmedByName,
        confirmed_by_user_id: confirmedByUserId,
        confirmed_at: new Date().toISOString(),
        is_settled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) throw error;

    // Optionally: Mark linked attendance as paid
    // This depends on your business logic
    // await markLinkedAttendanceAsPaid(supabase, transactionId);

    return { error: null };
  } catch (err) {
    console.error("Error confirming settlement:", err);
    return { error: err as Error };
  }
}

/**
 * Dispute settlement - admin action to dispute engineer's settlement
 */
export async function disputeSettlement(
  supabase: SupabaseClient<Database>,
  transactionId: string,
  disputeNotes: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("site_engineer_transactions")
      .update({
        settlement_status: "disputed",
        dispute_notes: disputeNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error("Error disputing settlement:", err);
    return { error: err as Error };
  }
}

/**
 * Get pending settlements for a site engineer
 */
export async function getPendingSettlements(
  supabase: SupabaseClient<Database>,
  engineerUserId: string
): Promise<{
  data: Array<{
    id: string;
    amount: number;
    description: string | null;
    transaction_date: string;
    site_name: string | null;
  }>;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("site_engineer_transactions")
      .select(
        `
        id,
        amount,
        description,
        transaction_date,
        sites!site_engineer_transactions_site_id_fkey (name)
      `
      )
      .eq("user_id", engineerUserId)
      .eq("transaction_type", "received_from_company")
      .eq("settlement_status", "pending_settlement")
      .order("transaction_date", { ascending: false });

    if (error) throw error;

    const result =
      data?.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        transaction_date: tx.transaction_date,
        site_name: (tx.sites as unknown as { name: string } | null)?.name || null,
      })) || [];

    return { data: result, error: null };
  } catch (err) {
    console.error("Error fetching pending settlements:", err);
    return { data: [], error: err as Error };
  }
}
