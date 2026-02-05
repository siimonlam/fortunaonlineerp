/*
  # Add Actions and Result Type to Demographics Table

  1. Changes
    - Add `actions` column (jsonb) to store demographic-specific actions from Meta API
    - Add `result_type` column (text) to store the primary result type for calculation
    - Add objective-specific metric columns to match meta_monthly_insights structure:
      - sales (integer)
      - leads (integer)
      - traffic (integer)
      - engagement (integer)
      - awareness (integer)
      - app_installs (integer)

  2. Purpose
    - Enable Option 1: Store actions in demographics and calculate independently
    - Demographics will have their own action data from Meta API breakdowns
    - Use same calculation logic as insights table for consistency
    - Each demographic segment calculates its own objective-specific metrics

  3. Notes
    - This allows demographic-level action data (e.g., purchases by women 25-34)
    - Calculations happen independently from adset-level aggregates
    - Risk: Potential discrepancies if Meta API returns inconsistent data
    - Benefit: True demographic-specific metrics without assumptions
*/

-- Add actions column to store demographic-specific actions from Meta API
ALTER TABLE meta_monthly_demographics
ADD COLUMN IF NOT EXISTS actions jsonb;

-- Add result_type column to identify primary result type
ALTER TABLE meta_monthly_demographics
ADD COLUMN IF NOT EXISTS result_type text;

-- Add objective-specific metric columns to match insights table structure
ALTER TABLE meta_monthly_demographics
ADD COLUMN IF NOT EXISTS sales integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS leads integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS traffic integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS awareness integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS app_installs integer DEFAULT 0;

-- Create index on result_type for filtering
CREATE INDEX IF NOT EXISTS idx_demographics_result_type
  ON meta_monthly_demographics(result_type);

-- Create index on actions for JSON queries (GIN index)
CREATE INDEX IF NOT EXISTS idx_demographics_actions
  ON meta_monthly_demographics USING GIN (actions);

COMMENT ON COLUMN meta_monthly_demographics.actions IS 'Demographic-specific actions array from Meta API breakdowns';
COMMENT ON COLUMN meta_monthly_demographics.result_type IS 'Primary result type used for calculations (e.g., omni_purchase, offsite_conversion.fb_pixel_lead)';
COMMENT ON COLUMN meta_monthly_demographics.sales IS 'Sales/purchases for this demographic segment';
COMMENT ON COLUMN meta_monthly_demographics.leads IS 'Leads generated for this demographic segment';
COMMENT ON COLUMN meta_monthly_demographics.traffic IS 'Traffic actions for this demographic segment';
COMMENT ON COLUMN meta_monthly_demographics.engagement IS 'Engagement actions for this demographic segment';
COMMENT ON COLUMN meta_monthly_demographics.awareness IS 'Awareness impressions for this demographic segment';
COMMENT ON COLUMN meta_monthly_demographics.app_installs IS 'App installs for this demographic segment';
