/*
  # Add Selected Vendor Flag and Quotation Requirements

  ## Overview
  Supports the BUD procurement quotation workflow where:
  - A winning/selected vendor is identified by client signature, company chop, and sign date
  - Each quotation checklist item requires a minimum number of vendor quotations (2, 3, or 5)
    based on the procurement amount tier (HKD 50K / 300K / 1.4M thresholds)
  - A quotation folder is only "complete" when:
    1. All files have their checks done (by human or AI)
    2. The required number of quotation files is present
    3. One file is marked as the selected (winning) vendor

  ## Modified Tables

  ### `project_checklist_files`
  - `is_selected_vendor` (boolean, default false) — marks this quotation as the winning vendor
  - `selected_vendor_at` (timestamptz, nullable) — when it was marked as selected
  - `selected_vendor_by` (uuid, nullable) — who marked it as selected

  ### `project_checklist_items`
  - `required_vendor_count` (integer, nullable) — minimum number of quotations required
    (2 for ≥$50K, 3 for ≥$300K, 5 for ≥$1.4M); null means no minimum enforced

  ## Notes
  - Only one file per checklist item should be marked as is_selected_vendor = true
  - The UI should enforce single-selection and show a warning if required_vendor_count is not met
*/

-- Add selected vendor columns to project_checklist_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_files' AND column_name = 'is_selected_vendor'
  ) THEN
    ALTER TABLE project_checklist_files ADD COLUMN is_selected_vendor boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_files' AND column_name = 'selected_vendor_at'
  ) THEN
    ALTER TABLE project_checklist_files ADD COLUMN selected_vendor_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_files' AND column_name = 'selected_vendor_by'
  ) THEN
    ALTER TABLE project_checklist_files ADD COLUMN selected_vendor_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add required_vendor_count to project_checklist_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_checklist_items' AND column_name = 'required_vendor_count'
  ) THEN
    ALTER TABLE project_checklist_items ADD COLUMN required_vendor_count integer;
  END IF;
END $$;

-- Index for fast selected vendor lookups per checklist item
CREATE INDEX IF NOT EXISTS idx_pcf_selected_vendor
  ON project_checklist_files(checklist_item_id, is_selected_vendor)
  WHERE is_selected_vendor = true;
