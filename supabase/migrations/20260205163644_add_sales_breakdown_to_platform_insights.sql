/*
  # Add Sales Breakdown Columns to Platform Insights

  Add the same sales breakdown columns to meta_platform_insights table:
  - sales_purchase (integer, default 0)
  - sales_initiate_checkout (integer, default 0)
  - sales_add_to_cart (integer, default 0)
*/

ALTER TABLE meta_platform_insights
  ADD COLUMN IF NOT EXISTS sales_purchase integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_initiate_checkout integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_add_to_cart integer DEFAULT 0;