/*
  # Enable Realtime for Meta Ads Tables

  1. Changes
    - Enable realtime replication for meta ads tables
    - Set replica identity to full for proper realtime updates
*/

-- Enable realtime for meta ad accounts
ALTER PUBLICATION supabase_realtime ADD TABLE meta_ad_accounts;
ALTER TABLE meta_ad_accounts REPLICA IDENTITY FULL;

-- Enable realtime for meta campaigns
ALTER PUBLICATION supabase_realtime ADD TABLE meta_campaigns;
ALTER TABLE meta_campaigns REPLICA IDENTITY FULL;

-- Enable realtime for meta adsets
ALTER PUBLICATION supabase_realtime ADD TABLE meta_adsets;
ALTER TABLE meta_adsets REPLICA IDENTITY FULL;

-- Enable realtime for meta ads
ALTER PUBLICATION supabase_realtime ADD TABLE meta_ads;
ALTER TABLE meta_ads REPLICA IDENTITY FULL;

-- Enable realtime for meta ad insights
ALTER PUBLICATION supabase_realtime ADD TABLE meta_ad_insights;
ALTER TABLE meta_ad_insights REPLICA IDENTITY FULL;

-- Enable realtime for marketing meta ad accounts junction
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_meta_ad_accounts;
ALTER TABLE marketing_meta_ad_accounts REPLICA IDENTITY FULL;
