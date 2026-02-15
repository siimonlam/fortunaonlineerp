# Marketing System Replication Guide
## Complete Documentation for Replicating Marketing → Meta Ads, Instagram & Facebook Features

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [React Components](#react-components)
4. [Edge Functions](#edge-functions)
5. [External API Requirements](#external-api-requirements)
6. [Bolt.new Prompt Template](#boltnew-prompt-template)

---

## System Overview

This marketing system integrates:
- **Marketing Projects**: Container for client marketing campaigns
- **Facebook Pages**: Page analytics, posts, demographics, and insights
- **Instagram Business Accounts**: Profile, posts, and engagement metrics
- **Meta Ads**: Complete ad campaign hierarchy (Account → Campaign → Ad Set → Ad) with daily/monthly insights and demographics

### Key Features
- Multi-account management (Facebook, Instagram, Meta Ads)
- Project-based account linking
- Automated data sync via Edge Functions
- Daily and monthly aggregated insights
- Demographic breakdowns
- ROI/ROAS calculations
- Token management and validation

---

## Database Schema

### Core Tables (17 total)

#### 1. Marketing Projects
```sql
-- Main project table
CREATE TABLE marketing_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status_id uuid REFERENCES statuses(id),
  created_by uuid REFERENCES auth.users(id),
  sales_person_id uuid REFERENCES auth.users(id),
  client_id uuid REFERENCES clients(id),
  company_name text,
  company_name_chinese text,
  contact_name text,
  contact_number text,
  email text,
  address text,
  sales_source text,
  sales_source_detail text,
  project_name text,
  project_reference text UNIQUE,
  client_number text,
  google_drive_folder_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Staff access control
CREATE TABLE marketing_project_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Project tasks
CREATE TABLE marketing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id),
  deadline timestamptz,
  completed boolean DEFAULT false,
  links text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2. Facebook Tables
```sql
-- Facebook accounts/pages
CREATE TABLE facebook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text UNIQUE NOT NULL,
  name text,
  username text,
  access_token text,
  followers_count integer DEFAULT 0,
  fan_count integer DEFAULT 0,
  category text,
  verification_status text,
  client_number text,
  total_page_likes integer DEFAULT 0,
  total_reach_28d integer DEFAULT 0,
  total_engagement_28d integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  net_growth_7d integer DEFAULT 0,
  last_updated timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Facebook posts
CREATE TABLE facebook_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text UNIQUE NOT NULL,
  page_id text NOT NULL,
  account_id uuid REFERENCES facebook_accounts(id) ON DELETE CASCADE,
  date timestamptz,
  message text,
  type text,
  status_type text,
  full_picture text,
  permalink_url text,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Post metrics (daily)
CREATE TABLE facebook_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  account_id uuid REFERENCES facebook_accounts(id) ON DELETE CASCADE,
  client_number text,
  marketing_reference text,
  date timestamptz NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  engagement integer DEFAULT 0,
  reactions jsonb,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  video_views integer DEFAULT 0,
  engaged_users integer DEFAULT 0,
  link_clicks integer DEFAULT 0,
  photo_clicks integer DEFAULT 0,
  negative_feedback integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(post_id, date)
);

-- Page insights (daily page-level)
CREATE TABLE facebook_page_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL,
  account_id uuid REFERENCES facebook_accounts(id) ON DELETE CASCADE,
  client_number text,
  marketing_reference text,
  date date NOT NULL,
  page_fans integer DEFAULT 0,
  page_fan_adds integer DEFAULT 0,
  page_fan_removes integer DEFAULT 0,
  net_growth integer DEFAULT 0,
  page_impressions integer DEFAULT 0,
  page_impressions_unique integer DEFAULT 0,
  page_impressions_organic integer DEFAULT 0,
  page_impressions_paid integer DEFAULT 0,
  page_post_engagements integer DEFAULT 0,
  page_engaged_users integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  page_posts_impressions integer DEFAULT 0,
  page_posts_impressions_unique integer DEFAULT 0,
  page_video_views integer DEFAULT 0,
  page_video_views_unique integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(page_id, date)
);

-- Page demographics
CREATE TABLE facebook_page_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id text NOT NULL,
  account_id uuid REFERENCES facebook_accounts(id) ON DELETE CASCADE,
  client_number text,
  marketing_reference text,
  date date NOT NULL,
  age_gender_breakdown jsonb,
  country_breakdown jsonb,
  city_breakdown jsonb,
  device_breakdown jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(page_id, date)
);

-- Marketing project junction
CREATE TABLE marketing_facebook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_reference text REFERENCES marketing_projects(project_reference) ON DELETE CASCADE,
  page_id text NOT NULL,
  client_number text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(marketing_reference, page_id)
);
```

#### 3. Instagram Tables
```sql
-- Instagram accounts
CREATE TABLE instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text UNIQUE NOT NULL,
  username text,
  name text,
  biography text,
  profile_picture_url text,
  website text,
  followers_count integer DEFAULT 0,
  follows_count integer DEFAULT 0,
  media_count integer DEFAULT 0,
  client_number text,
  last_updated timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Instagram posts
CREATE TABLE instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text UNIQUE NOT NULL,
  date timestamptz,
  caption text,
  media_type text,
  media_url text,
  permalink text,
  thumbnail_url text,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  account_id text REFERENCES instagram_accounts(account_id) ON DELETE CASCADE,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Post metrics
CREATE TABLE instagram_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text REFERENCES instagram_posts(media_id) ON DELETE CASCADE,
  account_id text REFERENCES instagram_accounts(account_id) ON DELETE CASCADE,
  client_number text,
  date timestamptz NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  engagement integer DEFAULT 0,
  saved integer DEFAULT 0,
  video_views integer DEFAULT 0,
  shares integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(media_id, date)
);

-- Marketing project junction
CREATE TABLE marketing_instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE,
  account_id text REFERENCES instagram_accounts(account_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(marketing_project_id, account_id)
);
```

#### 4. Meta Ads Tables
```sql
-- Ad accounts
CREATE TABLE meta_ad_accounts (
  account_id text PRIMARY KEY,
  account_name text,
  currency text,
  timezone_name text,
  business_id text,
  business_name text,
  account_status text,
  disable_reason text,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Campaigns
CREATE TABLE meta_campaigns (
  campaign_id text PRIMARY KEY,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  objective text,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  budget_remaining numeric,
  start_time timestamptz,
  stop_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ad Sets
CREATE TABLE meta_adsets (
  adset_id text PRIMARY KEY,
  campaign_id text REFERENCES meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  bid_amount numeric,
  billing_event text,
  optimization_goal text,
  targeting jsonb,
  start_time timestamptz,
  end_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ads
CREATE TABLE meta_ads (
  ad_id text PRIMARY KEY,
  adset_id text REFERENCES meta_adsets(adset_id) ON DELETE CASCADE,
  campaign_id text REFERENCES meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  status text,
  creative_id text,
  preview_shareable_link text,
  effective_status text,
  configured_status text,
  created_time timestamptz,
  updated_time timestamptz,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ad Creatives
CREATE TABLE meta_ad_creatives (
  creative_id text PRIMARY KEY,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  name text,
  title text,
  body text,
  image_url text,
  video_id text,
  link_url text,
  call_to_action_type text,
  object_story_spec jsonb,
  thumbnail_url text,
  created_time timestamptz,
  updated_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Daily Ad Insights
CREATE TABLE meta_ad_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text REFERENCES meta_ads(ad_id) ON DELETE CASCADE,
  adset_id text REFERENCES meta_adsets(adset_id) ON DELETE CASCADE,
  campaign_id text REFERENCES meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  frequency numeric DEFAULT 0,
  clicks integer DEFAULT 0,
  unique_clicks integer DEFAULT 0,
  ctr numeric DEFAULT 0,
  unique_ctr numeric DEFAULT 0,
  inline_link_clicks integer DEFAULT 0,
  inline_link_click_ctr numeric DEFAULT 0,
  spend numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  cpp numeric DEFAULT 0,
  video_views integer DEFAULT 0,
  video_avg_time_watched_actions numeric DEFAULT 0,
  video_p25_watched_actions integer DEFAULT 0,
  video_p50_watched_actions integer DEFAULT 0,
  video_p75_watched_actions integer DEFAULT 0,
  video_p100_watched_actions integer DEFAULT 0,
  conversions integer DEFAULT 0,
  conversion_values numeric DEFAULT 0,
  cost_per_conversion numeric DEFAULT 0,
  actions jsonb,
  social_spend numeric DEFAULT 0,
  website_ctr numeric DEFAULT 0,
  outbound_clicks integer DEFAULT 0,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  results integer DEFAULT 0,
  result_type text,
  cost_per_result numeric DEFAULT 0,
  sales integer DEFAULT 0,
  leads integer DEFAULT 0,
  traffic integer DEFAULT 0,
  engagement integer DEFAULT 0,
  awareness integer DEFAULT 0,
  app_installs integer DEFAULT 0,
  sales_purchase integer DEFAULT 0,
  sales_initiate_checkout integer DEFAULT 0,
  sales_add_to_cart integer DEFAULT 0,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ad_id, date)
);

-- Monthly Ad Insights (Ad-level aggregations)
CREATE TABLE meta_ad_monthly_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  ad_name text,
  adset_id text,
  adset_name text,
  campaign_id text,
  campaign_name text,
  account_id text,
  account_name text,
  creative_id text,
  month_year date NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  frequency numeric DEFAULT 0,
  clicks integer DEFAULT 0,
  ctr numeric DEFAULT 0,
  spend numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  cpp numeric DEFAULT 0,
  results integer DEFAULT 0,
  result_type text,
  cost_per_result numeric DEFAULT 0,
  sales integer DEFAULT 0,
  leads integer DEFAULT 0,
  traffic integer DEFAULT 0,
  engagement integer DEFAULT 0,
  awareness integer DEFAULT 0,
  app_installs integer DEFAULT 0,
  sales_purchase integer DEFAULT 0,
  sales_initiate_checkout integer DEFAULT 0,
  sales_add_to_cart integer DEFAULT 0,
  actions jsonb,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ad_id, month_year)
);

-- Demographics tables for both daily and monthly also exist
-- (Similar structure, add age_group, gender, country columns)

-- Marketing project junction
CREATE TABLE marketing_meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_project_id uuid REFERENCES marketing_projects(id) ON DELETE CASCADE,
  account_id text REFERENCES meta_ad_accounts(account_id) ON DELETE CASCADE,
  client_number text,
  marketing_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(marketing_project_id, account_id)
);
```

#### 5. System Settings Table
```sql
-- For storing API tokens and configuration
CREATE TABLE system_settings (
  key text PRIMARY KEY,
  value text,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Insert default keys
INSERT INTO system_settings (key, description) VALUES
  ('meta_oauth_user_token', 'Meta OAuth User Access Token'),
  ('meta_system_user_token', 'Meta System User Access Token'),
  ('meta_ads_access_token', 'Meta Ads API Access Token'),
  ('facebook_page_ids', 'Comma-separated Facebook Page IDs'),
  ('instagram_account_ids', 'Comma-separated Instagram Account IDs');
```

---

## React Components

### Required Components (18 files)

#### 1. Settings Pages (3)
- **FacebookSettingsPage.tsx** - Configure Facebook credentials, test tokens, discover pages
- **InstagramSettingsPage.tsx** - Configure Instagram credentials, discover accounts
- **MetaAdsSettingsPage.tsx** - Configure Meta Ads API access, manage ad accounts

#### 2. Account Management (2)
- **FacebookAccountsPage.tsx** - View all synced Facebook pages, sync data
- **InstagramAccountsPage.tsx** - View all synced Instagram accounts, sync data

#### 3. Marketing Project Integration (4)
- **MarketingProjectDetail.tsx** - Main project detail container
- **MarketingFacebookSection.tsx** - Facebook posts/insights within project
- **MarketingInstagramSection.tsx** - Instagram posts/insights within project
- **MarketingMetaAdSection.tsx** - Meta ads campaigns/insights within project

#### 4. Analytics & Insights (2)
- **FacebookPageInsightsPage.tsx** - Detailed page analytics, demographics
- **InstagramPostsPage.tsx** - Individual account post history

#### 5. Supporting Components (7)
- **MonthlyPerformanceChart.tsx** - Chart visualization for metrics
- **MonthlyComparison.tsx** - Month-over-month comparisons
- **CreativePerformanceGallery.tsx** - Ad creative gallery with metrics
- **MarketingTasksSection.tsx** - Task management
- **MarketingMeetingsSection.tsx** - Meeting records
- **MarketingShareResourcesSection.tsx** - Resource sharing
- **MarketingProjectPermissions.tsx** - Access control

### Component Features
- Real-time data sync with Supabase
- Token validation and management
- Auto-discovery of accounts
- Metric calculations and aggregations
- Responsive design with Tailwind CSS
- Icons from Lucide React

---

## Edge Functions

### Required Functions (10 files)

#### Facebook Functions (4)
1. **sync-facebook-accounts** - Sync page metadata and follower counts
2. **sync-facebook-posts** - Sync posts and post-level metrics
3. **sync-facebook-page-insights** - Sync page-level daily insights
4. **test-facebook-token** - Validate tokens and permissions

#### Instagram Functions (2)
5. **sync-instagram-accounts** - Sync account metadata
6. **sync-instagram-posts** - Sync posts and engagement metrics

#### Meta Ads Functions (4)
7. **sync-meta-ads-insights** - Sync daily ad insights (campaigns, ad sets, ads)
8. **sync-monthly-reports** - Generate monthly aggregated reports
9. **sync-ad-creatives** - Sync ad creative assets
10. **test-meta-ads-token** - Validate Meta Ads token

### Key Function Features
- Rate limiting with exponential backoff
- Token exchange (system user → page access tokens)
- Error handling and partial success responses
- Pagination support
- Objective-specific result calculations
- Demographic breakdowns

---

## External API Requirements

### 1. Meta for Developers Account
**Required:** Facebook/Meta Developer Account
- Create app at https://developers.facebook.com
- Add products: Facebook Login, Instagram Basic Display, Marketing API
- Get App ID and App Secret

### 2. Required Permissions

**Facebook Permissions:**
- `pages_show_list` - List pages user manages
- `pages_read_engagement` - Read page insights
- `pages_read_user_content` - Read page posts
- `pages_manage_metadata` - Manage page settings
- `read_insights` - Read page insights data

**Instagram Permissions:**
- `instagram_basic` - Basic profile data
- `instagram_manage_insights` - Read insights
- `pages_show_list` - Required to link Instagram accounts

**Ads Permissions:**
- `ads_read` - Read ad account data
- `ads_management` - Manage ad campaigns (optional)

### 3. API Versions
- Facebook Graph API: v21.0 or v24.0
- Marketing API: Latest stable version

### 4. Token Types Needed
- **OAuth User Token** - For user-authorized operations
- **System User Token** - For backend operations (Facebook)
- **Page Access Token** - For page-specific operations
- **Long-Lived Tokens** - 60-day validity (recommended)

---

## Bolt.new Prompt Template

Use this complete prompt when creating your new website on bolt.new:

```
Create a Marketing Analytics Dashboard with Facebook, Instagram, and Meta Ads integration using React, TypeScript, Supabase, and Tailwind CSS.

## Core Features Required:

### 1. Marketing Projects
- Create/manage marketing projects with client information
- Project-based account linking (Facebook, Instagram, Meta Ads)
- Staff access control (view/edit permissions)
- Task management and meeting records
- Google Drive folder integration

### 2. Facebook Integration
- Settings page: Configure Facebook System User token, discover pages
- Accounts page: View all synced pages with follower counts
- Page Insights: Daily metrics (impressions, reach, engagement, demographics)
- Post Management: View posts with reactions, comments, shares
- Monthly aggregations and trend analysis
- Demographics breakdown by age/gender/location/device

### 3. Instagram Integration
- Settings page: Configure token, discover Instagram Business accounts
- Accounts page: View synced accounts with follower metrics
- Post Gallery: Display posts with engagement metrics (likes, comments, impressions, reach)
- Media type support: IMAGE, VIDEO, REELS, CAROUSEL
- Account-level aggregations

### 4. Meta Ads Integration
- Settings page: Configure Meta Ads API token, discover ad accounts
- Full hierarchy: Ad Account → Campaign → Ad Set → Ad
- Daily and Monthly insights with metrics:
  - Delivery: impressions, reach, frequency
  - Engagement: clicks, CTR, link clicks
  - Cost: spend, CPC, CPM, CPP
  - Video: views, watch time percentages
  - Conversions: results, cost per result, ROAS
- Objective-specific result calculations (sales, leads, traffic, engagement, awareness, app installs)
- Demographics breakdown by age/gender/country
- Platform breakdown (Facebook, Instagram, Audience Network)
- Creative gallery with performance metrics

### 5. Sync & Automation
- Supabase Edge Functions for data sync:
  - Facebook: accounts, posts, page insights
  - Instagram: accounts, posts, metrics
  - Meta Ads: campaigns, ad sets, ads, insights, demographics
- Token management and validation
- Rate limiting with exponential backoff
- Error handling and partial success responses
- Monthly report generation with aggregations

## Technical Requirements:

### Database Schema (Supabase):
Create these tables with proper foreign keys and indexes:

**Marketing Tables:**
- marketing_projects (id, title, status_id, client_id, project_reference, google_drive_folder_id)
- marketing_project_staff (project_id, user_id, can_view, can_edit)
- marketing_tasks (marketing_project_id, title, assigned_to, deadline, completed)

**Facebook Tables:**
- facebook_accounts (page_id, name, followers_count, fan_count, total_reach_28d, engagement_rate)
- facebook_posts (post_id, page_id, date, message, likes_count, comments_count, shares_count)
- facebook_post_metrics (post_id, date, impressions, reach, engagement, reactions JSONB)
- facebook_page_insights (page_id, date, page_fans, page_impressions, page_engaged_users)
- facebook_page_demographics (page_id, date, age_gender_breakdown JSONB, country_breakdown JSONB)
- marketing_facebook_accounts (marketing_reference, page_id)

**Instagram Tables:**
- instagram_accounts (account_id, username, followers_count, media_count)
- instagram_posts (media_id, account_id, date, media_type, likes_count, comments_count)
- instagram_post_metrics (media_id, date, impressions, reach, engagement, saved)
- marketing_instagram_accounts (marketing_project_id, account_id)

**Meta Ads Tables:**
- meta_ad_accounts (account_id, account_name, currency, account_status)
- meta_campaigns (campaign_id, account_id, name, objective, status, budget)
- meta_adsets (adset_id, campaign_id, name, status, targeting JSONB)
- meta_ads (ad_id, adset_id, campaign_id, name, creative_id, status)
- meta_ad_creatives (creative_id, title, body, image_url, video_id)
- meta_ad_insights (ad_id, date, impressions, reach, clicks, spend, cpc, cpm, results)
- meta_ad_monthly_insights (ad_id, month_year, aggregated metrics, results by objective)
- meta_ad_insights_demographics (ad_id, date, age_group, gender, country, metrics)
- marketing_meta_ad_accounts (marketing_project_id, account_id)

**System Settings:**
- system_settings (key, value) - Store API tokens

Enable Row Level Security (RLS) on all tables.

### Frontend Components (React + TypeScript):

**Settings Pages:**
1. FacebookSettingsPage - Token config, page discovery, connection testing
2. InstagramSettingsPage - Token config, account discovery
3. MetaAdsSettingsPage - Token config, ad account discovery

**Account Management:**
4. FacebookAccountsPage - List all pages with sync button
5. InstagramAccountsPage - List all accounts with sync button

**Project Integration:**
6. MarketingProjectDetail - Main project container with sidebar
7. MarketingFacebookSection - Project-level Facebook posts/insights
8. MarketingInstagramSection - Project-level Instagram posts/insights
9. MarketingMetaAdSection - Project-level Meta ads campaigns/insights

**Analytics:**
10. FacebookPageInsightsPage - Detailed page analytics
11. InstagramPostsPage - Account post history
12. MonthlyPerformanceChart - Metric visualizations
13. MonthlyComparison - Month-over-month comparisons
14. CreativePerformanceGallery - Ad creative gallery

Use Tailwind CSS for styling, Lucide React for icons.

### Edge Functions (Supabase):

Create these Deno TypeScript functions:

**Facebook:**
1. sync-facebook-accounts - Fetch page metadata, store in facebook_accounts
2. sync-facebook-posts - Fetch posts + metrics, store in facebook_posts + facebook_post_metrics
3. sync-facebook-page-insights - Fetch daily page insights + demographics
4. test-facebook-token - Validate token and permissions

**Instagram:**
5. sync-instagram-accounts - Fetch account metadata
6. sync-instagram-posts - Fetch posts + insights (impressions, reach, engagement)

**Meta Ads:**
7. sync-meta-ads-insights - Fetch campaigns/adsets/ads + daily insights
8. sync-monthly-reports - Generate monthly aggregations with demographics
9. sync-ad-creatives - Fetch ad creative assets
10. test-meta-ads-token - Validate Meta Ads token

Each function should:
- Read tokens from system_settings table
- Use Meta Graph API (v21.0 or v24.0)
- Implement rate limiting with exponential backoff
- Handle token expiration gracefully
- Support pagination
- Return detailed error messages
- Calculate objective-specific results for Meta Ads

### API Integration:
- Meta Graph API for Facebook/Instagram
- Meta Marketing API for Ads
- Token types: OAuth User Token, System User Token, Page Access Token
- Implement token exchange (system user → page access token)
- Store tokens securely in system_settings table

### UI Features:
- Responsive design with mobile support
- Loading states and error handling
- Real-time data updates via Supabase subscriptions
- Date range filters (7 days, 30 days, custom)
- Search and filtering
- Export capabilities
- Metric cards with trends (↑↓ indicators)
- Charts using a charting library (Chart.js or Recharts)

### Security:
- Row Level Security (RLS) policies for all tables
- Staff-based access control
- Token encryption
- Validate all user inputs
- CORS configuration for Edge Functions

## Design Requirements:
- Clean, modern interface
- Color scheme: Blue primary (#2563eb), Green success (#10b981), Red error (#ef4444)
- Card-based layouts
- Responsive grid system
- Modal dialogs for forms
- Toast notifications for feedback
- Sidebar navigation for project detail
- Tab-based section navigation

## Expected File Structure:
/src
  /components
    - FacebookSettingsPage.tsx
    - FacebookAccountsPage.tsx
    - FacebookPageInsightsPage.tsx
    - InstagramSettingsPage.tsx
    - InstagramAccountsPage.tsx
    - InstagramPostsPage.tsx
    - MetaAdsSettingsPage.tsx
    - MarketingProjectDetail.tsx
    - MarketingFacebookSection.tsx
    - MarketingInstagramSection.tsx
    - MarketingMetaAdSection.tsx
    - MonthlyPerformanceChart.tsx
    - MonthlyComparison.tsx
    - CreativePerformanceGallery.tsx
  /lib
    - supabase.ts (Supabase client)
/supabase
  /functions
    - sync-facebook-accounts/index.ts
    - sync-facebook-posts/index.ts
    - sync-facebook-page-insights/index.ts
    - sync-instagram-accounts/index.ts
    - sync-instagram-posts/index.ts
    - sync-meta-ads-insights/index.ts
    - sync-monthly-reports/index.ts
    - sync-ad-creatives/index.ts
    - test-facebook-token/index.ts
    - test-meta-ads-token/index.ts
  /migrations
    - 001_create_marketing_tables.sql
    - 002_create_facebook_tables.sql
    - 003_create_instagram_tables.sql
    - 004_create_meta_ads_tables.sql
    - 005_create_system_settings.sql

Please create a fully functional prototype with all features, proper error handling, and a polished UI.
```

---

## Additional Notes

### Testing the System
1. Get Meta Developer credentials
2. Create long-lived access tokens
3. Store tokens in system_settings table
4. Test token validation functions first
5. Run sync functions to populate data
6. Verify data appears correctly in UI

### Common Pitfalls
- Token expiration (use 60-day tokens)
- Rate limiting (implement backoff)
- Permission errors (verify all required permissions)
- Date timezone issues (use UTC consistently)
- CORS errors (configure Edge Function headers)

### Performance Considerations
- Index foreign keys and date columns
- Batch database operations (100 records max)
- Paginate API requests
- Cache frequently accessed data
- Use database views for complex aggregations

---

## Support Resources
- Meta Graph API: https://developers.facebook.com/docs/graph-api
- Meta Marketing API: https://developers.facebook.com/docs/marketing-apis
- Instagram Graph API: https://developers.facebook.com/docs/instagram-api
- Supabase Docs: https://supabase.com/docs
