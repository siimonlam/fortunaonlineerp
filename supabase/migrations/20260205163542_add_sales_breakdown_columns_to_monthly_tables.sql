/*
  # Add Sales Breakdown Columns to Monthly Tables

  For sales objective campaigns, we need to track 3 specific sales action types separately:
  - sales_purchase (omni_purchase, purchase, offsite_conversion.fb_pixel_purchase)
  - sales_initiate_checkout (initiate_checkout)
  - sales_add_to_cart (add_to_cart)

  The `sales` column will be the SUM of these 3 columns.

  1. Changes to `meta_monthly_insights`
    - Add `sales_purchase` column (integer, default 0)
    - Add `sales_initiate_checkout` column (integer, default 0)
    - Add `sales_add_to_cart` column (integer, default 0)

  2. Changes to `meta_monthly_demographics`
    - Add `sales_purchase` column (integer, default 0)
    - Add `sales_initiate_checkout` column (integer, default 0)
    - Add `sales_add_to_cart` column (integer, default 0)

  Note: Only sales objective campaigns will have values in these columns. All other objectives will have 0.
*/

-- Add sales breakdown columns to meta_monthly_insights
ALTER TABLE meta_monthly_insights
  ADD COLUMN IF NOT EXISTS sales_purchase integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_initiate_checkout integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_add_to_cart integer DEFAULT 0;

-- Add sales breakdown columns to meta_monthly_demographics
ALTER TABLE meta_monthly_demographics
  ADD COLUMN IF NOT EXISTS sales_purchase integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_initiate_checkout integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_add_to_cart integer DEFAULT 0;