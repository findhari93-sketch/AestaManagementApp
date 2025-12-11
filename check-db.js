const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDatabase() {
  console.log('=== Full Database Check ===\n');

  // 1. Get ALL attendance records
  console.log('1. ALL daily_attendance records:');
  const { data: allAttendance, error: allErr } = await supabase
    .from('daily_attendance')
    .select('id, date, site_id, laborer_id')
    .order('date', { ascending: false })
    .limit(20);

  if (allErr) {
    console.log('   ERROR:', allErr.message);
  } else {
    console.log('   Total records:', allAttendance?.length || 0);
    allAttendance?.forEach(r => {
      console.log('   -', r.date, '| site:', r.site_id?.substring(0,8), '| laborer:', r.laborer_id?.substring(0,8));
    });
  }

  // 2. Get ALL daily_work_summary records
  console.log('\n2. ALL daily_work_summary records:');
  const { data: allSummary, error: sumErr } = await supabase
    .from('daily_work_summary')
    .select('id, date, site_id, work_description')
    .order('date', { ascending: false })
    .limit(10);

  if (sumErr) {
    console.log('   ERROR:', sumErr.message);
  } else {
    console.log('   Total records:', allSummary?.length || 0);
    allSummary?.forEach(r => {
      console.log('   -', r.date, '| site:', r.site_id?.substring(0,8), '| desc:', r.work_description?.substring(0, 30) || '(none)');
    });
  }

  // 3. Get ALL sites
  console.log('\n3. Sites:');
  const { data: sites, error: siteErr } = await supabase
    .from('sites')
    .select('id, name')
    .limit(5);

  if (siteErr) {
    console.log('   ERROR:', siteErr.message);
  } else {
    sites?.forEach(s => {
      console.log('   -', s.id, '|', s.name);
    });
  }

  // 4. Test INSERT into daily_attendance
  if (sites?.[0]) {
    const siteId = sites[0].id;

    // Get a laborer
    const { data: laborers } = await supabase
      .from('laborers')
      .select('id')
      .limit(1);

    const { data: sections } = await supabase
      .from('building_sections')
      .select('id')
      .eq('site_id', siteId)
      .limit(1);

    if (laborers?.[0] && sections?.[0]) {
      console.log('\n4. Testing INSERT into daily_attendance...');
      const testRecord = {
        date: '2025-12-08',
        site_id: siteId,
        laborer_id: laborers[0].id,
        section_id: sections[0].id,
        work_days: 1,
        daily_rate_applied: 500,
        daily_earnings: 500,
        is_paid: false,
        recorded_by: 'test-script'
      };

      const insertStart = Date.now();
      const { data: inserted, error: insertErr } = await supabase
        .from('daily_attendance')
        .insert(testRecord)
        .select();

      const insertElapsed = Date.now() - insertStart;
      if (insertErr) {
        console.log('   INSERT ERROR:', insertErr.message, '| Code:', insertErr.code);
        console.log('   Details:', insertErr.details);
        console.log('   Hint:', insertErr.hint);
      } else {
        console.log('   INSERT OK - took', insertElapsed, 'ms');
        console.log('   Inserted ID:', inserted?.[0]?.id);

        // Now delete it
        console.log('\n5. Testing DELETE of inserted record...');
        const deleteStart = Date.now();
        const { error: delErr } = await supabase
          .from('daily_attendance')
          .delete()
          .eq('id', inserted[0].id);

        const deleteElapsed = Date.now() - deleteStart;
        if (delErr) {
          console.log('   DELETE ERROR:', delErr.message);
        } else {
          console.log('   DELETE OK - took', deleteElapsed, 'ms');
        }
      }
    }
  }

  // 5. Test upsert to daily_work_summary
  if (sites?.[0]) {
    console.log('\n6. Testing UPSERT to daily_work_summary with work_description...');
    const upsertStart = Date.now();
    const { error: upsertErr } = await supabase
      .from('daily_work_summary')
      .upsert({
        site_id: sites[0].id,
        date: '2025-12-08',
        work_description: 'Test from script - Column concrete',
        work_status: '100%',
        comments: 'Testing',
        total_laborer_count: 2,
        entered_by: 'test-script'
      }, { onConflict: 'site_id,date' });

    const upsertElapsed = Date.now() - upsertStart;
    if (upsertErr) {
      console.log('   UPSERT ERROR:', upsertErr.message, '| Code:', upsertErr.code);
    } else {
      console.log('   UPSERT OK - took', upsertElapsed, 'ms');
    }
  }

  console.log('\n=== Done ===');
}

checkDatabase().catch(err => {
  console.error('Script error:', err);
});
