import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDatabase() {
  console.log('Checking RLS policies and attendance data...\n');

  // Check RLS status using rpc (need to create function first)
  // Instead, let's just try operations directly

  // 1. Try to select from daily_attendance
  console.log('1. Checking daily_attendance SELECT...');
  const { data: attendance, error: selectErr } = await supabase
    .from('daily_attendance')
    .select('id, date, laborer_id, site_id')
    .eq('date', '2025-12-08')
    .limit(10);

  if (selectErr) {
    console.log('   SELECT ERROR:', selectErr.message);
  } else {
    console.log('   SELECT OK - Found', attendance?.length || 0, 'records');
    if (attendance?.length > 0) {
      console.log('   Records:', JSON.stringify(attendance, null, 2));
    }
  }

  // 2. Check if there are any labor_payments referencing these attendance records
  console.log('\n2. Checking labor_payments references...');
  const { data: payments, error: payErr } = await supabase
    .from('labor_payments')
    .select('id, attendance_id')
    .not('attendance_id', 'is', null)
    .limit(10);

  if (payErr) {
    console.log('   PAYMENTS SELECT ERROR:', payErr.message);
  } else {
    console.log('   Found', payments?.length || 0, 'payments with attendance_id');
    if (payments?.length > 0) {
      console.log('   Payments:', JSON.stringify(payments, null, 2));
    }
  }

  // 3. Try a test delete on a non-existent record
  console.log('\n3. Testing DELETE operation (dry run on fake ID)...');
  const startTime = Date.now();
  const { error: deleteErr, count } = await supabase
    .from('daily_attendance')
    .delete({ count: 'exact' })
    .eq('id', '00000000-0000-0000-0000-000000000000'); // Fake ID that doesn't exist

  const elapsed = Date.now() - startTime;
  if (deleteErr) {
    console.log('   DELETE ERROR:', deleteErr.message, deleteErr.code);
  } else {
    console.log('   DELETE OK - took', elapsed, 'ms, affected', count, 'rows');
  }

  // 4. Check daily_work_summary
  console.log('\n4. Checking daily_work_summary...');
  const { data: summary, error: summaryErr } = await supabase
    .from('daily_work_summary')
    .select('*')
    .eq('date', '2025-12-08')
    .limit(5);

  if (summaryErr) {
    console.log('   SUMMARY SELECT ERROR:', summaryErr.message);
  } else {
    console.log('   Found', summary?.length || 0, 'summary records');
  }

  // 5. Try to insert and delete from daily_work_summary
  console.log('\n5. Testing daily_work_summary UPSERT...');
  const testSummary = {
    site_id: attendance?.[0]?.site_id || '00000000-0000-0000-0000-000000000000',
    date: '2025-12-08',
    work_description: 'Test description',
    total_laborer_count: 0
  };

  const upsertStart = Date.now();
  const { error: upsertErr } = await supabase
    .from('daily_work_summary')
    .upsert(testSummary, { onConflict: 'site_id,date' });

  const upsertElapsed = Date.now() - upsertStart;
  if (upsertErr) {
    console.log('   UPSERT ERROR:', upsertErr.message, upsertErr.code);
  } else {
    console.log('   UPSERT OK - took', upsertElapsed, 'ms');
  }

  console.log('\n=== Done ===');
}

checkDatabase().catch(console.error);
