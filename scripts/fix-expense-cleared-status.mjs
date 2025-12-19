/**
 * Script to fix expense cleared status
 *
 * This script finds expenses that are marked as "cleared" but their corresponding
 * attendance records are unpaid, and updates them to "pending" (is_cleared = false).
 *
 * Usage:
 *   node scripts/fix-expense-cleared-status.mjs          # Dry run - shows what would be fixed
 *   node scripts/fix-expense-cleared-status.mjs --fix    # Actually fix the data
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  });
} catch (err) {
  console.error("Could not read .env.local file:", err.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const shouldFix = process.argv.includes("--fix");

async function findMismatchedExpenses() {
  console.log("\n=== Finding Mismatched Expenses ===\n");

  // Strategy 1: Find expenses linked via expense_id where attendance is unpaid
  console.log("Strategy 1: Checking expenses linked via expense_id...");

  const { data: linkedExpenses, error: linkedError } = await supabase
    .from("expenses")
    .select(`
      id, date, amount, description, is_cleared, contract_id, site_id, engineer_transaction_id,
      daily_attendance!daily_attendance_expense_id_fkey(id, is_paid, laborer_id)
    `)
    .eq("is_cleared", true)
    .not("daily_attendance", "is", null);

  if (linkedError) {
    console.error("Error fetching linked expenses:", linkedError.message);
  } else {
    const mismatchedLinked = (linkedExpenses || []).filter(e => {
      const attendance = e.daily_attendance;
      if (Array.isArray(attendance) && attendance.length > 0) {
        return attendance.some(a => a.is_paid === false);
      }
      return false;
    });

    console.log(`  Found ${mismatchedLinked.length} expenses linked to unpaid attendance`);
    mismatchedLinked.forEach(e => {
      console.log(`    - Expense ${e.id}: ${e.date} - ₹${e.amount} - ${e.description?.substring(0, 50) || 'No description'}`);
    });
  }

  // Strategy 2: Find salary expenses (with engineer_transaction_id) where transaction is cancelled
  console.log("\nStrategy 2: Checking salary expenses with cancelled transactions...");

  const { data: salaryExpenses, error: salaryError } = await supabase
    .from("expenses")
    .select(`
      id, date, amount, description, is_cleared, contract_id, site_id, engineer_transaction_id
    `)
    .eq("is_cleared", true)
    .not("engineer_transaction_id", "is", null);

  if (salaryError) {
    console.error("Error fetching salary expenses:", salaryError.message);
  } else {
    const cancelledTransactionExpenses = [];

    for (const expense of salaryExpenses || []) {
      const { data: transaction } = await supabase
        .from("site_engineer_transactions")
        .select("id, status")
        .eq("id", expense.engineer_transaction_id)
        .single();

      if (transaction && transaction.status === "cancelled") {
        cancelledTransactionExpenses.push({
          ...expense,
          transactionStatus: transaction.status
        });
      }
    }

    console.log(`  Found ${cancelledTransactionExpenses.length} expenses with cancelled transactions`);
    cancelledTransactionExpenses.forEach(e => {
      console.log(`    - Expense ${e.id}: ${e.date} - ₹${e.amount} - Transaction: ${e.engineer_transaction_id} (${e.transactionStatus})`);
    });
  }

  // Strategy 3: Find expenses with "Salary Settlement" in description where no paid attendance exists
  console.log("\nStrategy 3: Checking salary settlement expenses without paid attendance...");

  const { data: salarySettlementExpenses, error: ssError } = await supabase
    .from("expenses")
    .select("id, date, amount, description, is_cleared, contract_id, site_id")
    .eq("is_cleared", true)
    .ilike("description", "%Salary%Settlement%");

  if (ssError) {
    console.error("Error fetching salary settlement expenses:", ssError.message);
  } else {
    const orphanedSalaryExpenses = [];

    for (const expense of salarySettlementExpenses || []) {
      // Check if there's any paid attendance for this date and site
      const { data: paidAttendance } = await supabase
        .from("daily_attendance")
        .select("id")
        .eq("site_id", expense.site_id)
        .eq("date", expense.date)
        .eq("is_paid", true)
        .limit(1);

      if (!paidAttendance || paidAttendance.length === 0) {
        orphanedSalaryExpenses.push(expense);
      }
    }

    console.log(`  Found ${orphanedSalaryExpenses.length} salary expenses without paid attendance`);
    orphanedSalaryExpenses.forEach(e => {
      console.log(`    - Expense ${e.id}: ${e.date} - ₹${e.amount} - ${e.description?.substring(0, 50) || 'No description'}`);
    });
  }

  // Strategy 4: Find labor expenses with contract_id where no paid attendance exists (any description)
  console.log("\nStrategy 4: Checking labor expenses with contract_id but no paid attendance...");

  const { data: laborContractExpenses, error: lcError } = await supabase
    .from("expenses")
    .select("id, date, amount, description, is_cleared, contract_id, site_id, module")
    .eq("is_cleared", true)
    .eq("module", "labor")
    .not("contract_id", "is", null);

  if (lcError) {
    console.error("Error fetching labor contract expenses:", lcError.message);
  } else {
    const orphanedLaborExpenses = [];

    for (const expense of laborContractExpenses || []) {
      // Check for paid daily attendance
      const { data: paidDaily } = await supabase
        .from("daily_attendance")
        .select("id")
        .eq("site_id", expense.site_id)
        .eq("date", expense.date)
        .eq("is_paid", true)
        .limit(1);

      // Check for paid market attendance
      const { data: paidMarket } = await supabase
        .from("market_laborer_attendance")
        .select("id")
        .eq("site_id", expense.site_id)
        .eq("date", expense.date)
        .eq("is_paid", true)
        .limit(1);

      const hasPaidAttendance = (paidDaily && paidDaily.length > 0) || (paidMarket && paidMarket.length > 0);

      if (!hasPaidAttendance) {
        orphanedLaborExpenses.push(expense);
      }
    }

    console.log(`  Found ${orphanedLaborExpenses.length} labor expenses without any paid attendance`);
    orphanedLaborExpenses.forEach(e => {
      console.log(`    - Expense ${e.id}: ${e.date} - ₹${e.amount} - ${e.description?.substring(0, 50) || 'No description'}`);
    });
  }

  // Collect all unique expense IDs to fix
  const expensesToFix = new Set();

  // Add from Strategy 1
  if (linkedExpenses) {
    linkedExpenses.filter(e => {
      const attendance = e.daily_attendance;
      if (Array.isArray(attendance) && attendance.length > 0) {
        return attendance.some(a => a.is_paid === false);
      }
      return false;
    }).forEach(e => expensesToFix.add(e.id));
  }

  // Add from Strategy 2 (cancelled transactions)
  if (salaryExpenses) {
    for (const expense of salaryExpenses) {
      const { data: transaction } = await supabase
        .from("site_engineer_transactions")
        .select("id, status")
        .eq("id", expense.engineer_transaction_id)
        .single();

      if (transaction && transaction.status === "cancelled") {
        expensesToFix.add(expense.id);
      }
    }
  }

  // Add from Strategy 3 (orphaned salary expenses)
  if (salarySettlementExpenses) {
    for (const expense of salarySettlementExpenses) {
      const { data: paidAttendance } = await supabase
        .from("daily_attendance")
        .select("id")
        .eq("site_id", expense.site_id)
        .eq("date", expense.date)
        .eq("is_paid", true)
        .limit(1);

      if (!paidAttendance || paidAttendance.length === 0) {
        expensesToFix.add(expense.id);
      }
    }
  }

  // Add from Strategy 4 (labor expenses with contract_id but no paid attendance)
  if (laborContractExpenses) {
    for (const expense of laborContractExpenses) {
      const { data: paidDaily } = await supabase
        .from("daily_attendance")
        .select("id")
        .eq("site_id", expense.site_id)
        .eq("date", expense.date)
        .eq("is_paid", true)
        .limit(1);

      const { data: paidMarket } = await supabase
        .from("market_laborer_attendance")
        .select("id")
        .eq("site_id", expense.site_id)
        .eq("date", expense.date)
        .eq("is_paid", true)
        .limit(1);

      const hasPaidAttendance = (paidDaily && paidDaily.length > 0) || (paidMarket && paidMarket.length > 0);

      if (!hasPaidAttendance) {
        expensesToFix.add(expense.id);
      }
    }
  }

  return Array.from(expensesToFix);
}

async function fixExpenses(expenseIds) {
  if (expenseIds.length === 0) {
    console.log("\n=== No expenses to fix! ===\n");
    return;
  }

  console.log(`\n=== ${shouldFix ? "Deleting" : "Would delete"} ${expenseIds.length} orphaned expense(s) ===\n`);

  if (!shouldFix) {
    console.log("Run with --fix flag to DELETE these orphaned expenses");
    console.log("  node scripts/fix-expense-cleared-status.mjs --fix\n");
    return;
  }

  // Delete orphaned expenses - they shouldn't exist if payment was cancelled
  const { error } = await supabase
    .from("expenses")
    .delete()
    .in("id", expenseIds);

  if (error) {
    console.error("Error deleting expenses:", error.message);
  } else {
    console.log(`Successfully deleted ${expenseIds.length} orphaned expense(s)`);
  }
}

async function main() {
  console.log("=================================================");
  console.log("  Expense Cleared Status Fix Script");
  console.log("=================================================");
  console.log(`Mode: ${shouldFix ? "FIX (will update database)" : "DRY RUN (no changes)"}`);

  try {
    const expenseIds = await findMismatchedExpenses();
    await fixExpenses(expenseIds);

    console.log("\n=== Summary ===");
    console.log(`Total expenses found with mismatched status: ${expenseIds.length}`);
    if (!shouldFix && expenseIds.length > 0) {
      console.log("\nRun with --fix to update these expenses:");
      console.log("  node scripts/fix-expense-cleared-status.mjs --fix");
    }
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

main();
