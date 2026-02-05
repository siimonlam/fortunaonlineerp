/*
  # Add Sales Breakdown Columns to Ad Insights

  Add sales breakdown columns to meta_ad_insights table for consistency:
  - sales_purchase (integer, default 0)
  - sales_initiate_checkout (integer, default 0)
  - sales_add_to_cart (integer, default 0)
*/

ALTER TABLE meta_ad_insights
  ADD COLUMN IF NOT EXISTS sales_purchase integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_initiate_checkout integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_add_to_cart integer DEFAULT 0;