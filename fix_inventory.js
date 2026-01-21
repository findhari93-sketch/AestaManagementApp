const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocutbpoaibjxtyjkrnda.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdXRicG9haWJqeHR5amtybmRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc1NjY5NSwiZXhwIjoyMDgwMzMyNjk1fQ.8PjPyJ9mFdzUkokweaNCpFiKTU6SPoKH0DooCLzcuro';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventory() {
  const materialId = '3c7c1d28-6e8d-40a5-9f98-2d0f669233a0';
  const groupId = '0ecc1c2f-e198-4918-bee2-b56128523b01';

  console.log('=== Checking Transactions ===');
  const { data: transactions, error: txError } = await supabase
    .from('group_stock_transactions')
    .select('*')
    .eq('material_id', materialId)
    .eq('site_group_id', groupId)
    .order('created_at');

  if (txError) {
    console.error('Transaction query error:', txError);
  } else {
    console.log('Found', transactions.length, 'transactions:');
    transactions.forEach((tx, i) => {
      console.log(`\n${i + 1}. ${tx.transaction_type} - ${tx.transaction_date}`);
      console.log('   Quantity:', tx.quantity);
      console.log('   Unit Cost:', tx.unit_cost);
      console.log('   Total Cost:', tx.total_cost);
      console.log('   Reference:', tx.reference_type, tx.reference_id);
      console.log('   Created:', tx.created_at);
      console.log('   ID:', tx.id);
    });
  }

  console.log('\n=== Checking Inventory ===');
  const { data: inventory, error: invError } = await supabase
    .from('group_stock_inventory')
    .select('*')
    .eq('material_id', materialId)
    .eq('site_group_id', groupId)
    .single();

  if (invError) {
    console.error('Inventory query error:', invError);
  } else {
    console.log('Current inventory:');
    console.log('  Current Qty:', inventory.current_qty);
    console.log('  Available Qty:', inventory.available_qty);
    console.log('  Avg Unit Cost:', inventory.avg_unit_cost);
    console.log('  Created:', inventory.created_at);
    console.log('  Updated:', inventory.updated_at);
  }

  console.log('\n=== Calculated Correct Quantity ===');
  const calculatedQty = transactions.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);
  console.log('Sum of all transaction quantities:', calculatedQty);
  console.log('Current inventory shows:', inventory?.current_qty);
  console.log('Difference:', (inventory?.current_qty || 0) - calculatedQty);

  if ((inventory?.current_qty || 0) !== calculatedQty) {
    console.log('\n⚠️  INVENTORY MISMATCH DETECTED!');
    console.log('The inventory needs to be recalculated.');

    console.log('\n=== Checking for duplicate purchases ===');
    const purchases = transactions.filter(tx => tx.transaction_type === 'purchase');
    console.log('Found', purchases.length, 'purchase transactions:');
    purchases.forEach((p, i) => {
      console.log(`  ${i + 1}. Date: ${p.transaction_date}, Qty: ${p.quantity}, Ref: ${p.reference_id}`);
    });
  }
}

checkInventory().then(() => process.exit(0)).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
