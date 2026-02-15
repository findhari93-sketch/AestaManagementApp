import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Backfill missing debtor-side material expenses for completed inter-site settlements.
 * Finds all settled settlements that don't have a corresponding expense for the debtor site
 * and creates them.
 */
export async function POST() {
  try {
    const supabase = createAdminClient();

    // Find all settled inter-site settlements without debtor expenses
    const { data: settlements, error: fetchError } = await (supabase as any)
      .from("inter_site_material_settlements")
      .select(`
        id,
        settlement_code,
        site_group_id,
        from_site_id,
        to_site_id,
        total_amount,
        settled_at,
        from_site:sites!inter_site_material_settlements_from_site_id_fkey(id, name),
        to_site:sites!inter_site_material_settlements_to_site_id_fkey(id, name)
      `)
      .eq("status", "settled");

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch settlements", details: fetchError.message }, { status: 500 });
    }

    if (!settlements || settlements.length === 0) {
      return NextResponse.json({ message: "No settled settlements found", backfilled: 0 });
    }

    const results: { settlement_code: string; debtor: string; success: boolean; error?: string }[] = [];

    for (const settlement of settlements) {
      // Check if debtor expense already exists
      const { data: existingExpense } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id")
        .eq("site_id", settlement.to_site_id)
        .eq("settlement_reference", settlement.settlement_code)
        .not("original_batch_code", "is", null)
        .limit(1);

      if (existingExpense && existingExpense.length > 0) {
        // Already exists, skip
        continue;
      }

      try {
        // Get payment info
        const { data: payments } = await (supabase as any)
          .from("inter_site_settlement_payments")
          .select("payment_date, payment_mode, reference_number")
          .eq("settlement_id", settlement.id)
          .order("payment_date", { ascending: false })
          .limit(1);

        const payment = payments?.[0];

        // Generate ref code
        let refCode: string;
        try {
          const { data: rpcRefCode } = await (supabase as any).rpc("generate_material_purchase_reference");
          refCode = rpcRefCode || `ISET-BF-${Date.now()}`;
        } catch {
          refCode = `ISET-BF-${Date.now()}`;
        }

        const paymentDate = payment?.payment_date || settlement.settled_at?.split("T")[0] || new Date().toISOString().split("T")[0];
        // Map payment mode - material_purchase_expenses allows: cash, upi, bank_transfer, cheque, credit
        // inter_site_settlement_payments allows: cash, bank_transfer, upi, adjustment
        const validModes = ["cash", "upi", "bank_transfer", "cheque", "credit"];
        const rawMode = payment?.payment_mode || "cash";
        const paymentMode = validModes.includes(rawMode) ? rawMode : "cash";

        // Create expense
        const { data: expense, error: expenseError } = await (supabase as any)
          .from("material_purchase_expenses")
          .insert({
            site_id: settlement.to_site_id,
            ref_code: refCode,
            purchase_type: "own_site",
            purchase_date: paymentDate,
            total_amount: settlement.total_amount,
            transport_cost: 0,
            status: "completed",
            is_paid: true,
            paid_date: paymentDate,
            payment_mode: paymentMode,
            payment_reference: payment?.reference_number || null,
            original_batch_code: settlement.settlement_code,
            settlement_reference: settlement.settlement_code,
            settlement_date: paymentDate,
            settlement_payer_source: "own",
            site_group_id: settlement.site_group_id,
            notes: `Backfilled: Inter-site settlement payment from ${settlement.to_site?.name || "debtor"} to ${settlement.from_site?.name || "creditor"}. Settlement: ${settlement.settlement_code}`,
          })
          .select()
          .single();

        if (expenseError) {
          results.push({ settlement_code: settlement.settlement_code, debtor: settlement.to_site?.name || settlement.to_site_id, success: false, error: expenseError.message });
          continue;
        }

        // Create expense items from settlement items
        const { data: settlementItems } = await (supabase as any)
          .from("inter_site_settlement_items")
          .select("material_id, brand_id, quantity_used, unit_cost")
          .eq("settlement_id", settlement.id);

        if (settlementItems && settlementItems.length > 0 && expense) {
          const expenseItems = settlementItems.map((item: any) => ({
            purchase_expense_id: expense.id,
            material_id: item.material_id,
            brand_id: item.brand_id || null,
            quantity: Number(item.quantity_used || 0),
            unit_price: Number(item.unit_cost || 0),
            notes: `Backfilled from settlement ${settlement.settlement_code}`,
          }));

          await (supabase as any)
            .from("material_purchase_expense_items")
            .insert(expenseItems);
        }

        results.push({
          settlement_code: settlement.settlement_code,
          debtor: settlement.to_site?.name || settlement.to_site_id,
          success: true,
        });
      } catch (err: any) {
        results.push({ settlement_code: settlement.settlement_code, debtor: settlement.to_site?.name || settlement.to_site_id, success: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: "Backfill complete",
      totalSettled: settlements.length,
      alreadyHadExpense: settlements.length - results.length,
      backfilled: successCount,
      failed: failCount,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Backfill failed", details: err.message }, { status: 500 });
  }
}

// GET: Check how many settlements need backfilling
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: settlements } = await (supabase as any)
      .from("inter_site_material_settlements")
      .select("id, settlement_code, to_site_id, total_amount")
      .eq("status", "settled");

    if (!settlements) {
      return NextResponse.json({ needsBackfill: 0, totalSettled: 0 });
    }

    let needsBackfill = 0;
    for (const s of settlements) {
      const { data: existing } = await (supabase as any)
        .from("material_purchase_expenses")
        .select("id")
        .eq("site_id", s.to_site_id)
        .eq("settlement_reference", s.settlement_code)
        .not("original_batch_code", "is", null)
        .limit(1);

      if (!existing || existing.length === 0) {
        needsBackfill++;
      }
    }

    return NextResponse.json({
      totalSettled: settlements.length,
      needsBackfill,
      alreadyHasExpense: settlements.length - needsBackfill,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
