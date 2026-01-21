const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocutbpoaibjxtyjkrnda.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdXRicG9haWJqeHR5amtybmRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc1NjY5NSwiZXhwIjoyMDgwMzMyNjk1fQ.8PjPyJ9mFdzUkokweaNCpFiKTU6SPoKH0DooCLzcuro';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAll() {
  console.log('=== ALL Material Purchases ===');
  const { data: allPurchases, error } = await supabase
    .from('material_purchase_expenses')
    .select('ref_code, purchase_date, purchase_type, site_group_id, total_amount')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${allPurchases.length} recent purchases:`);
    allPurchases.forEach((p, i) => {
      console.log(`${i + 1}. ${p.ref_code} (${p.purchase_type}) - ${p.purchase_date} - ₹${p.total_amount}`);
      if (p.site_group_id) console.log(`   Group ID: ${p.site_group_id}`);
    });
  }
}

listAll().then(() => process.exit(0)).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
