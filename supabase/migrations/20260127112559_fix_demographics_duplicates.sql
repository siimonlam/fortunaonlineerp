/*
  # Fix Demographics Duplicates and Ensure Proper Unique Constraint

  1. Changes
    - Delete duplicate demographic records, keeping only the most recent
    - Ensure unique constraint works properly for future syncs

  2. Purpose
    - Remove 1,207 duplicate records from meta_monthly_demographics
    - Ensure future syncs update existing records instead of creating duplicates
*/

-- Delete duplicates, keeping only the most recent record for each unique combination
DELETE FROM meta_monthly_demographics
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY adset_id, month_year, age_group, gender, country
        ORDER BY updated_at DESC, id DESC
      ) as rn
    FROM meta_monthly_demographics
  ) t
  WHERE rn > 1
);

-- Verify the existing unique constraint is present
-- If not, recreate it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_monthly_demographic' 
      AND conrelid = 'meta_monthly_demographics'::regclass
  ) THEN
    ALTER TABLE meta_monthly_demographics
      ADD CONSTRAINT unique_monthly_demographic 
        UNIQUE (adset_id, month_year, age_group, gender, country);
  END IF;
END $$;
