# Generate Attendance Notifications Edge Function

This Supabase Edge Function runs daily at 10:00 AM IST (04:30 UTC) to check for sites without attendance and create notifications.

## Logic

1. Gets all active sites
2. Checks which sites have attendance records for today
3. Checks which sites have holidays marked for today
4. For sites with neither attendance nor holiday:
   - Creates notifications for eligible users (admin, or users with the site in their assigned_sites)
5. Avoids duplicate notifications if run multiple times in the same day

## Setup Instructions

### 1. Deploy the Function

```bash
# From the project root
supabase functions deploy generate-attendance-notifications --project-ref YOUR_PROJECT_REF
```

### 2. Set Up Cron Schedule

In the Supabase Dashboard:
1. Go to Database → Extensions
2. Enable the `pg_cron` extension if not already enabled
3. Go to SQL Editor and run:

```sql
-- Create a cron job that runs at 10:00 AM IST (04:30 UTC) every day
SELECT cron.schedule(
  'generate-attendance-notifications',
  '30 4 * * *',  -- 04:30 UTC = 10:00 AM IST
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-attendance-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key

### 3. Verify Setup

```bash
# Check scheduled jobs
SELECT * FROM cron.job;

# Check job history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### 4. Manual Testing

You can manually invoke the function:

```bash
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-attendance-notifications' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json'
```

## Environment Variables Required

The function uses these environment variables (automatically available in Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Response Format

```json
{
  "message": "Notifications created successfully",
  "notificationsCreated": 5,
  "sitesChecked": 10,
  "sitesNeedingAction": 2
}
```
