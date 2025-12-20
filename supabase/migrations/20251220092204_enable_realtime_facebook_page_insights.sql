/*
  # Enable Realtime for Facebook Page Insights

  1. Changes
    - Enable realtime replication for facebook_page_insights
    - Enable realtime replication for facebook_page_demographics
    - Set replica identity to FULL for better realtime support
    
  2. Impact
    - UI can receive live updates when insights are synced
    - Dashboard metrics update in real-time
*/

-- Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_page_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_page_demographics;

-- Set replica identity to FULL for better realtime support
ALTER TABLE facebook_page_insights REPLICA IDENTITY FULL;
ALTER TABLE facebook_page_demographics REPLICA IDENTITY FULL;
