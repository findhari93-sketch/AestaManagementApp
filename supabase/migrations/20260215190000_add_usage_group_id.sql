-- Add usage_group_id column to both usage tables for FIFO split grouping.
-- When a single usage action is split across multiple batches by FIFO,
-- all resulting records share the same usage_group_id.

-- 1. Add column to daily_material_usage
ALTER TABLE "public"."daily_material_usage"
  ADD COLUMN IF NOT EXISTS "usage_group_id" UUID;

-- 2. Add column to batch_usage_records
ALTER TABLE "public"."batch_usage_records"
  ADD COLUMN IF NOT EXISTS "usage_group_id" UUID;

-- 3. Create partial indexes for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_usage_group_id
  ON daily_material_usage(usage_group_id)
  WHERE usage_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_usage_records_usage_group_id
  ON batch_usage_records(usage_group_id)
  WHERE usage_group_id IS NOT NULL;

-- 4. Backfill existing records using procedural loop approach
-- Groups records that share (created_by, usage_date, work_description, material_id, brand_id)
-- and were created within a 30-second window of each other.
-- Only assigns group_id when there are 2+ records in the cluster.

DO $$
DECLARE
  rec RECORD;
  prev_created_by UUID := NULL;
  prev_usage_date DATE := NULL;
  prev_work_desc TEXT := NULL;
  prev_material_id UUID := NULL;
  prev_brand_id UUID := NULL;
  prev_created_at TIMESTAMPTZ := NULL;
  current_group_id UUID := NULL;
  group_member_count INT := 0;
  first_id_in_group UUID := NULL;
BEGIN
  -- Process batch_usage_records
  FOR rec IN
    SELECT id, created_by, usage_date, work_description, material_id, brand_id, created_at
    FROM batch_usage_records
    WHERE usage_group_id IS NULL
    ORDER BY created_by, usage_date, work_description NULLS LAST, material_id, brand_id NULLS LAST, created_at
  LOOP
    IF prev_created_by IS NOT DISTINCT FROM rec.created_by
       AND prev_usage_date IS NOT DISTINCT FROM rec.usage_date
       AND prev_work_desc IS NOT DISTINCT FROM rec.work_description
       AND prev_material_id IS NOT DISTINCT FROM rec.material_id
       AND prev_brand_id IS NOT DISTINCT FROM rec.brand_id
       AND prev_created_at IS NOT NULL
       AND rec.created_at - prev_created_at <= INTERVAL '30 seconds'
    THEN
      IF group_member_count = 1 THEN
        current_group_id := gen_random_uuid();
        UPDATE batch_usage_records SET usage_group_id = current_group_id WHERE id = first_id_in_group;
      END IF;
      group_member_count := group_member_count + 1;
      UPDATE batch_usage_records SET usage_group_id = current_group_id WHERE id = rec.id;
    ELSE
      current_group_id := NULL;
      group_member_count := 1;
      first_id_in_group := rec.id;
    END IF;

    prev_created_by := rec.created_by;
    prev_usage_date := rec.usage_date;
    prev_work_desc := rec.work_description;
    prev_material_id := rec.material_id;
    prev_brand_id := rec.brand_id;
    prev_created_at := rec.created_at;
  END LOOP;

  -- Reset for daily_material_usage
  prev_created_by := NULL;
  prev_usage_date := NULL;
  prev_work_desc := NULL;
  prev_material_id := NULL;
  prev_brand_id := NULL;
  prev_created_at := NULL;
  current_group_id := NULL;
  group_member_count := 0;
  first_id_in_group := NULL;

  -- Process daily_material_usage
  FOR rec IN
    SELECT id, created_by, usage_date, work_description, material_id, brand_id, created_at
    FROM daily_material_usage
    WHERE usage_group_id IS NULL
    ORDER BY created_by, usage_date, work_description NULLS LAST, material_id, brand_id NULLS LAST, created_at
  LOOP
    IF prev_created_by IS NOT DISTINCT FROM rec.created_by
       AND prev_usage_date IS NOT DISTINCT FROM rec.usage_date
       AND prev_work_desc IS NOT DISTINCT FROM rec.work_description
       AND prev_material_id IS NOT DISTINCT FROM rec.material_id
       AND prev_brand_id IS NOT DISTINCT FROM rec.brand_id
       AND prev_created_at IS NOT NULL
       AND rec.created_at - prev_created_at <= INTERVAL '30 seconds'
    THEN
      IF group_member_count = 1 THEN
        current_group_id := gen_random_uuid();
        UPDATE daily_material_usage SET usage_group_id = current_group_id WHERE id = first_id_in_group;
      END IF;
      group_member_count := group_member_count + 1;
      UPDATE daily_material_usage SET usage_group_id = current_group_id WHERE id = rec.id;
    ELSE
      current_group_id := NULL;
      group_member_count := 1;
      first_id_in_group := rec.id;
    END IF;

    prev_created_by := rec.created_by;
    prev_usage_date := rec.usage_date;
    prev_work_desc := rec.work_description;
    prev_material_id := rec.material_id;
    prev_brand_id := rec.brand_id;
    prev_created_at := rec.created_at;
  END LOOP;
END $$;
