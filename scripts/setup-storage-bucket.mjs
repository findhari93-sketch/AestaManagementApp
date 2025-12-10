/**
 * Script to check and create the work-updates storage bucket
 * Run with: node scripts/setup-storage-bucket.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  const envVars = {};
  try {
    const content = readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    });
  } catch (err) {
    console.error('Error reading .env.local:', err.message);
  }
  return envVars;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('\nTo get the service role key:');
  console.error('1. Go to your Supabase dashboard');
  console.error('2. Go to Project Settings > API');
  console.error('3. Copy the "service_role" key (secret)');
  console.error('4. Add it to .env.local as SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('Checking storage buckets...\n');

  // List existing buckets
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Error listing buckets:', listError.message);
    process.exit(1);
  }

  console.log('Existing buckets:', buckets.map(b => b.name).join(', ') || 'none');

  // Check if work-updates bucket exists
  const workUpdatesBucket = buckets.find(b => b.id === 'work-updates');

  if (workUpdatesBucket) {
    console.log('\n✓ work-updates bucket already exists');
    console.log('  - Public:', workUpdatesBucket.public);
    console.log('  - File size limit:', workUpdatesBucket.file_size_limit);
  } else {
    console.log('\n× work-updates bucket does not exist. Creating...');

    const { data, error: createError } = await supabase.storage.createBucket('work-updates', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
    });

    if (createError) {
      console.error('Error creating bucket:', createError.message);
      process.exit(1);
    }

    console.log('✓ work-updates bucket created successfully');
  }

  // Test upload access
  console.log('\nTesting upload access...');
  const testBlob = new Blob(['test'], { type: 'text/plain' });
  const { error: uploadError } = await supabase.storage
    .from('work-updates')
    .upload('_test/test.txt', testBlob, { upsert: true });

  if (uploadError) {
    console.error('× Upload test failed:', uploadError.message);
    console.error('\nYou may need to update RLS policies.');
  } else {
    console.log('✓ Upload test successful');
    // Clean up test file
    await supabase.storage.from('work-updates').remove(['_test/test.txt']);
  }

  console.log('\nDone!');
}

main().catch(console.error);
