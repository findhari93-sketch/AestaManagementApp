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
 * Also marks linked attendance as paid and creates daily expense entry
 */
export async function confirmSettlement(
  supabase: SupabaseClient<Database>,
  transactionId: string,
  confirmedByUserId: string,
  confirmedByName: string
): Promise<{ error: Error | null }> {
  try {
    // 1. Get transaction details
    const { data: transaction, error: txError } = await supabase
      .from("site_engineer_transactions")
      .select("id, amount, site_id, transaction_date, description, settlement_proof_url, related_subcontract_id")
      .eq("id", transactionId)
      .single();

    if (txError) throw txError;
    if (!transaction) throw new Error("Transaction not found");

    const paymentDate = new Date().toISOString().split("T")[0];

    // 2. Update transaction status
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

    // 3. Mark linked daily attendance as paid
    const { error: dailyError } = await supabase
      .from("daily_attendance")
      .update({
        is_paid: true,
        payment_date: paymentDate,
      })
      .eq("engineer_transaction_id", transactionId);

    if (dailyError) {
      console.error("Error updating daily attendance:", dailyError);
    }

    // 4. Mark linked market attendance as paid
    const { error: marketError } = await supabase
      .from("market_laborer_attendance")
      .update({
        is_paid: true,
        payment_date: paymentDate,
      })
      .eq("engineer_transaction_id", transactionId);

    if (marketError) {
      console.error("Error updating market attendance:", marketError);
    }

    // 5. Create daily expense entry for this settlement
    if (transaction.site_id && transaction.amount > 0) {
      await createSettlementExpense(
        supabase,
        {
          siteId: transaction.site_id,
          amount: transaction.amount,
          date: transaction.transaction_date,
          description: transaction.description || "Laborer salary settlement",
          subcontractId: transaction.related_subcontract_id,
          proofUrl: transaction.settlement_proof_url,
          paidBy: confirmedByName,
          paidByUserId: confirmedByUserId,
        }
      );
    }

    return { error: null };
  } catch (err) {
    console.error("Error confirming settlement:", err);
    return { error: err as Error };
  }
}

/**
 * Create a daily expense entry for a confirmed settlement
 */
async function createSettlementExpense(
  supabase: SupabaseClient<Database>,
  params: {
    siteId: string;
    amount: number;
    date: string;
    description: string;
    subcontractId: string | null;
    proofUrl: string | null;
    paidBy: string;
    paidByUserId: string;
  }
): Promise<void> {
  try {
    // Find or create "Salary Settlement" category
    const { data: categories } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("name", "Salary Settlement")
      .limit(1);

    let categoryId = categories?.[0]?.id;

    // If no category exists, try to find "Labor" category
    if (!categoryId) {
      const { data: laborCategories } = await supabase
        .from("expense_categories")
        .select("id")
        .ilike("name", "%labor%")
        .limit(1);

      categoryId = laborCategories?.[0]?.id;
    }

    // If still no category, skip expense creation
    if (!categoryId) {
      console.warn("No suitable expense category found for salary settlement");
      return;
    }

    // Build description with "Via Engineer" indicator
    let fullDescription = params.description;
    if (!fullDescription.includes("Via Engineer") &&
        !fullDescription.includes("Direct by Company")) {
      fullDescription += " - Via Engineer";
    }

    // Create expense entry
    const { error: expenseError } = await supabase
      .from("expenses")
      .insert({
        site_id: params.siteId,
        category_id: categoryId,
        amount: params.amount,
        date: params.date,
        description: fullDescription,
        contract_id: params.subcontractId,
        receipt_url: params.proofUrl,
        module: "labor",
        paid_by: params.paidBy,
        entered_by: params.paidBy,
        entered_by_user_id: params.paidByUserId,
        is_cleared: true,
        cleared_date: params.date,
      });

    if (expenseError) {
      console.error("Error creating settlement expense:", expenseError);
    }
  } catch (err) {
    console.error("Error in createSettlementExpense:", err);
  }
}

/**
 * Parameters for creating a salary expense entry
 */
export interface SalaryExpenseParams {
  siteId: string;
  amount: number;
  date: string;
  description: string;
  paymentMode?: string;
  paidBy: string;
  paidByUserId: string;
  proofUrl?: string | null;
  subcontractId?: string | null;
  isCleared: boolean; // false = "Pending from Company"
  engineerTransactionId?: string | null; // Link to engineer transaction for tracking
  paymentSource: "direct" | "via_engineer" | "engineer_own_money";
}

/**
 * Create a salary/labor expense entry in daily expenses
 * Used for:
 * 1. Direct payments by company
 * 2. Engineer settlements (via company money)
 * 3. Engineer's own money payments (pending reimbursement)
 */
export async function createSalaryExpense(
  supabase: SupabaseClient<Database>,
  params: SalaryExpenseParams
): Promise<{ error: Error | null; expenseId: string | null }> {
  try {
    // Find "Salary Settlement" or "Labor" category
    const { data: categories } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("name", "Salary Settlement")
      .limit(1);

    let categoryId = categories?.[0]?.id;

    // If no category exists, try to find "Labor" category
    if (!categoryId) {
      const { data: laborCategories } = await supabase
        .from("expense_categories")
        .select("id")
        .ilike("name", "%labor%")
        .limit(1);

      categoryId = laborCategories?.[0]?.id;
    }

    // If still no category, return error
    if (!categoryId) {
      console.warn("No suitable expense category found for salary expense");
      return { error: new Error("No expense category found"), expenseId: null };
    }

    // Build description with source indicator
    let fullDescription = params.description;
    if (!fullDescription.includes("Direct by Company") &&
        !fullDescription.includes("Via Engineer") &&
        !fullDescription.includes("Pending from Company")) {
      switch (params.paymentSource) {
        case "direct":
          fullDescription += " - Direct by Company";
          break;
        case "via_engineer":
          fullDescription += " - Via Engineer";
          break;
        case "engineer_own_money":
          fullDescription += " - Pending from Company";
          break;
      }
    }

    // Create expense entry
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        site_id: params.siteId,
        category_id: categoryId,
        amount: params.amount,
        date: params.date,
        description: fullDescription,
        contract_id: params.subcontractId || null,
        receipt_url: params.proofUrl || null,
        module: "labor",
        paid_by: params.paidByUserId, // UUID - foreign key to users table
        entered_by: params.paidBy, // Name string
        entered_by_user_id: params.paidByUserId,
        is_cleared: params.isCleared,
        cleared_date: params.isCleared ? params.date : null,
        payment_mode: params.paymentMode as any || null,
        engineer_transaction_id: params.engineerTransactionId || null,
      })
      .select("id")
      .single();

    if (expenseError) {
      console.error("Error creating salary expense:", expenseError);
      return { error: expenseError, expenseId: null };
    }

    return { error: null, expenseId: expense?.id || null };
  } catch (err) {
    console.error("Error in createSalaryExpense:", err);
    return { error: err as Error, expenseId: null };
  }
}

/**
 * Clear a pending salary expense when engineer is reimbursed
 * Updates is_cleared to true and removes "Pending from Company" indicator
 */
export async function clearPendingSalaryExpense(
  supabase: SupabaseClient<Database>,
  engineerTransactionId: string
): Promise<{ error: Error | null }> {
  try {
    // First, find the expense by engineer_transaction_id
    const { data: expense, error: fetchError } = await supabase
      .from("expenses")
      .select("id, description")
      .eq("engineer_transaction_id", engineerTransactionId)
      .single();

    if (fetchError || !expense) {
      // No expense found - might not have been created yet
      return { error: null };
    }

    // Update the expense to mark as cleared
    const newDescription = expense.description
      ?.replace(" - Pending from Company", " - Via Engineer (Reimbursed)")
      || "Laborer salary - Via Engineer (Reimbursed)";

    const { error: updateError } = await supabase
      .from("expenses")
      .update({
        is_cleared: true,
        cleared_date: new Date().toISOString().split("T")[0],
        description: newDescription,
      })
      .eq("id", expense.id);

    if (updateError) {
      console.error("Error clearing pending salary expense:", updateError);
      return { error: updateError };
    }

    return { error: null };
  } catch (err) {
    console.error("Error in clearPendingSalaryExpense:", err);
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
 * Send a reminder notification to engineer about pending settlement
 * Used when admin clicks "Notify Engineer" button
 */
export async function notifyEngineerPaymentReminder(
  supabase: SupabaseClient<Database>,
  engineerId: string,
  transactionId: string,
  amount: number,
  laborerCount: number,
  siteName?: string,
  paymentDate?: string
): Promise<{ error: Error | null }> {
  try {
    const dateText = paymentDate
      ? new Date(paymentDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "recent";

    const message = siteName
      ? `Reminder: Please settle ₹${amount.toLocaleString("en-IN")} for ${laborerCount} ${laborerCount === 1 ? "laborer" : "laborers"} at ${siteName} (${dateText}).`
      : `Reminder: Please settle ₹${amount.toLocaleString("en-IN")} for ${laborerCount} ${laborerCount === 1 ? "laborer" : "laborers"} (${dateText}).`;

    const { error } = await supabase.from("notifications").insert({
      user_id: engineerId,
      title: "Payment Settlement Reminder",
      message,
      notification_type: "payment_settlement_reminder",
      related_id: transactionId,
      related_table: "site_engineer_transactions",
      is_read: false,
    });

    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error("Error creating payment reminder notification:", err);
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
