/**
 * Script to check and fix missing expense records for confirmed settlements
 *
 * Run with: node scripts/fix-missing-settlement-expenses.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
    });
    return env;
  } catch (e) {
    console.error('Failed to load .env.local:', e.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Checking Confirmed Settlements ===\n');

  // 1. Get all confirmed settlements
  const { data: confirmedSettlements, error: settlementsError } = await supabase
    .from('site_engineer_transactions')
    .select(`
      id,
      amount,
      settlement_status,
      confirmed_at,
      site_id,
      related_subcontract_id,
      description,
      settlement_proof_url,
      confirmed_by,
      confirmed_by_user_id
    `)
    .eq('settlement_status', 'confirmed')
    .order('confirmed_at', { ascending: false });

  if (settlementsError) {
    console.error('Error fetching settlements:', settlementsError);
    return;
  }

  console.log(`Found ${confirmedSettlements?.length || 0} confirmed settlements\n`);

  if (!confirmedSettlements || confirmedSettlements.length === 0) {
    console.log('No confirmed settlements found.');
    return;
  }

  // 2. Get Salary Settlement category
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id, name')
    .or('name.eq.Salary Settlement,name.ilike.%labor%')
    .limit(2);

  const salaryCategory = categories?.find(c => c.name === 'Salary Settlement');
  const laborCategory = categories?.find(c => c.name.toLowerCase().includes('labor'));
  const categoryId = salaryCategory?.id || laborCategory?.id;

  if (!categoryId) {
    console.error('No suitable expense category found (Salary Settlement or Labor)');
    return;
  }

  console.log(`Using category: ${salaryCategory?.name || laborCategory?.name} (${categoryId})\n`);

  // 3. Check each settlement for existing expense
  let missingCount = 0;
  let existingCount = 0;
  const missingExpenses = [];

  for (const settlement of confirmedSettlements) {
    // Check if expense exists for this settlement
    const { data: existingExpense } = await supabase
      .from('expenses')
      .select('id, amount, contract_id')
      .or(`description.ilike.%${settlement.id}%,description.ilike.%Via Engineer%`)
      .eq('site_id', settlement.site_id)
      .eq('amount', settlement.amount)
      .limit(1);

    if (existingExpense && existingExpense.length > 0) {
      existingCount++;
      console.log(`✓ Settlement ${settlement.id.slice(0, 8)}... has expense (${existingExpense[0].id.slice(0, 8)}...)`);
    } else {
      missingCount++;
      missingExpenses.push(settlement);
      console.log(`✗ Settlement ${settlement.id.slice(0, 8)}... MISSING expense - Amount: Rs.${settlement.amount}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Settlements with expenses: ${existingCount}`);
  console.log(`Settlements MISSING expenses: ${missingCount}`);

  if (missingExpenses.length === 0) {
    console.log('\nAll confirmed settlements have expense records!');
    return;
  }

  // 4. Ask to create missing expenses
  console.log('\n=== Missing Expenses Details ===');
  for (const settlement of missingExpenses) {
    console.log(`- ID: ${settlement.id}`);
    console.log(`  Amount: Rs.${settlement.amount}`);
    console.log(`  Confirmed: ${settlement.confirmed_at}`);
    console.log(`  Subcontract: ${settlement.related_subcontract_id || 'None'}`);
    console.log('');
  }

  // Check if we should create the missing expenses
  const CREATE_MISSING = process.argv.includes('--fix');

  if (!CREATE_MISSING) {
    console.log('\nTo create missing expenses, run: node scripts/fix-missing-settlement-expenses.mjs --fix');
    return;
  }

  console.log('\n=== Creating Missing Expenses ===');

  for (const settlement of missingExpenses) {
    // Build expense data - paid_by is FK to users.id so use confirmed_by_user_id
    const expenseData = {
      site_id: settlement.site_id,
      category_id: categoryId,
      amount: settlement.amount,
      date: settlement.confirmed_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      description: `${settlement.description || 'Laborer salary settlement'} - Via Engineer (Retroactive)`,
      contract_id: settlement.related_subcontract_id,
      receipt_url: settlement.settlement_proof_url,
      module: 'labor',
      // paid_by is FK to users.id - use confirmed_by_user_id
      paid_by: settlement.confirmed_by_user_id || null,
      // entered_by is a string field for name
      entered_by: settlement.confirmed_by || 'System (Retroactive)',
      entered_by_user_id: settlement.confirmed_by_user_id || null,
      is_cleared: true,
      cleared_date: settlement.confirmed_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    };

    const { data: newExpense, error: expenseError } = await supabase
      .from('expenses')
      .insert(expenseData)
      .select('id')
      .single();

    if (expenseError) {
      console.error(`✗ Failed to create expense for ${settlement.id.slice(0, 8)}...:`, expenseError.message);
    } else {
      console.log(`✓ Created expense ${newExpense.id.slice(0, 8)}... for settlement ${settlement.id.slice(0, 8)}...`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);