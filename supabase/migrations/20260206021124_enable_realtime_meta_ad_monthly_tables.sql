/*
  # Enable Realtime for Ad-Level Monthly Tables

  1. Changes
    - Enable realtime replication for meta_ad_monthly_insights
    - Enable realtime replication for meta_ad_monthly_demographics
    - Set replica identity to full for both tables
*/

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE meta_ad_monthly_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE meta_ad_monthly_demographics;

-- Set replica identity to full for complete change tracking
ALTER TABLE meta_ad_monthly_insights REPLICA IDENTITY FULL;
ALTER TABLE meta_ad_monthly_demographics REPLICA IDENTITY FULL;
