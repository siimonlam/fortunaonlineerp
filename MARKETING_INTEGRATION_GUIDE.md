# Marketing Detail Pages Integration Guide

This guide provides complete implementation details for the three marketing detail pages: Facebook, Instagram, and Meta Ads.

## Table of Contents
1. [Edge Functions](#edge-functions)
2. [Frontend Components](#frontend-components)
3. [Database Structure](#database-structure)
4. [Usage Examples](#usage-examples)

---

## Edge Functions

Three edge functions have been deployed:

### 1. get-facebook-page-details
**Endpoint:** `{SUPABASE_URL}/functions/v1/get-facebook-page-details`

**Query Parameters:**
- `marketingReference` (optional): Marketing project reference
- `pageId` (optional): Facebook page ID

**Returns:**
```typescript
{
  id: string;
  page_id: string;
  name: string;
  username: string;
  followers_count: number;
  fan_count: number;
  category: string;
  total_page_likes: number;
  total_reach_28d: number;
  total_engagement_28d: number;
  engagement_rate: number;
  net_growth_7d: number;
  facebook_posts: Array<{
    id: string;
    post_id: string;
    message: string;
    permalink_url: string;
    created_time: string;
    post_type: string;
    facebook_post_metrics: {
      likes: number;
      comments: number;
      shares: number;
      reactions: number;
      reach: number;
      impressions: number;
      engagement: number;
      video_views: number;
    }[];
  }>;
  facebook_page_insights: Array<{
    date: string;
    page_impressions: number;
    page_impressions_unique: number;
    page_engaged_users: number;
    page_post_engagements: number;
    page_fan_adds: number;
    page_fan_removes: number;
  }>;
  facebook_page_demographics: Array<{
    age_range: string;
    gender: string;
    country: string;
    city: string;
    value: number;
    metric_type: string;
  }>;
}
```

### 2. get-instagram-account-details
**Endpoint:** `{SUPABASE_URL}/functions/v1/get-instagram-account-details`

**Query Parameters:**
- `marketingReference` (optional): Marketing project reference
- `accountId` (optional): Instagram account ID

**Returns:**
```typescript
{
  id: string;
  account_id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  website: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  instagram_posts: Array<{
    id: string;
    media_id: string;
    caption: string;
    media_type: string;
    media_url: string;
    permalink: string;
    timestamp: string;
    instagram_post_metrics: {
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      reach: number;
      impressions: number;
      engagement: number;
      video_views: number;
      plays: number;
    }[];
  }>;
}
```

### 3. get-meta-ads-details
**Endpoint:** `{SUPABASE_URL}/functions/v1/get-meta-ads-details`

**Query Parameters:**
- `marketingReference` (optional): Marketing project reference
- `accountId` (optional): Meta Ad account ID

**Returns:**
```typescript
{
  account_id: string;
  account_name: string;
  currency: string;
  timezone_name: string;
  business_id: string;
  business_name: string;
  account_status: number;
  meta_campaigns: Array<{
    campaign_id: string;
    name: string;
    status: string;
    objective: string;
    created_time: string;
    meta_adsets: Array<{
      adset_id: string;
      name: string;
      status: string;
      optimization_goal: string;
      daily_budget: number;
      lifetime_budget: number;
      meta_ads: Array<{
        ad_id: string;
        name: string;
        status: string;
        meta_ad_insights: Array<{
          date_start: string;
          date_stop: string;
          impressions: number;
          clicks: number;
          spend: number;
          reach: number;
          ctr: number;
          cpc: number;
          cpm: number;
        }>;
      }>;
    }>;
  }>;
  meta_ad_monthly_insights: Array<{
    month: string;
    impressions: number;
    clicks: number;
    spend: number;
    reach: number;
    ctr: number;
    cpc: number;
    cpm: number;
  }>;
}
```

---

## Frontend Components

### 1. Facebook Page Detail Component

**File:** `src/pages/FacebookPageDetail.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface FacebookPageData {
  id: string;
  page_id: string;
  name: string;
  username: string;
  followers_count: number;
  fan_count: number;
  category: string;
  total_page_likes: number;
  total_reach_28d: number;
  total_engagement_28d: number;
  engagement_rate: number;
  net_growth_7d: number;
  facebook_posts: Array<{
    id: string;
    post_id: string;
    message: string;
    permalink_url: string;
    created_time: string;
    post_type: string;
    facebook_post_metrics: Array<{
      likes: number;
      comments: number;
      shares: number;
      reactions: number;
      reach: number;
      impressions: number;
      engagement: number;
      video_views: number;
    }>;
  }>;
  facebook_page_insights: Array<{
    date: string;
    page_impressions: number;
    page_impressions_unique: number;
    page_engaged_users: number;
    page_post_engagements: number;
    page_fan_adds: number;
    page_fan_removes: number;
  }>;
}

export default function FacebookPageDetail() {
  const { marketingReference } = useParams<{ marketingReference: string }>();
  const [data, setData] = useState<FacebookPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-facebook-page-details?marketingReference=${marketingReference}`;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Facebook page data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (marketingReference) {
      fetchData();
    }
  }, [marketingReference]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">No data found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Facebook Page Details</h1>

      {/* Page Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">{data.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-600">Username</p>
            <p className="text-lg font-medium">@{data.username}</p>
          </div>
          <div>
            <p className="text-gray-600">Category</p>
            <p className="text-lg font-medium">{data.category}</p>
          </div>
          <div>
            <p className="text-gray-600">Total Page Likes</p>
            <p className="text-lg font-medium">{data.total_page_likes?.toLocaleString() || 0}</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">28-Day Reach</p>
          <p className="text-2xl font-bold">{data.total_reach_28d?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">28-Day Engagement</p>
          <p className="text-2xl font-bold">{data.total_engagement_28d?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Engagement Rate</p>
          <p className="text-2xl font-bold">{data.engagement_rate?.toFixed(2) || 0}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">7-Day Growth</p>
          <p className="text-2xl font-bold">{data.net_growth_7d?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Posts</h3>
        <div className="space-y-4">
          {data.facebook_posts?.slice(0, 10).map((post) => {
            const metrics = post.facebook_post_metrics?.[0];
            return (
              <div key={post.id} className="border-b pb-4 last:border-b-0">
                <p className="text-sm text-gray-600 mb-2">
                  {new Date(post.created_time).toLocaleDateString()}
                </p>
                <p className="mb-2">{post.message}</p>
                {metrics && (
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>👍 {metrics.likes || 0}</span>
                    <span>💬 {metrics.comments || 0}</span>
                    <span>🔄 {metrics.shares || 0}</span>
                    <span>👁️ Reach: {metrics.reach?.toLocaleString() || 0}</span>
                  </div>
                )}
                <a
                  href={post.permalink_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                >
                  View on Facebook →
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### 2. Instagram Account Detail Component

**File:** `src/pages/InstagramAccountDetail.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface InstagramAccountData {
  id: string;
  account_id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  website: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  instagram_posts: Array<{
    id: string;
    media_id: string;
    caption: string;
    media_type: string;
    media_url: string;
    permalink: string;
    timestamp: string;
    instagram_post_metrics: Array<{
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      reach: number;
      impressions: number;
      engagement: number;
      video_views: number;
    }>;
  }>;
}

export default function InstagramAccountDetail() {
  const { marketingReference } = useParams<{ marketingReference: string }>();
  const [data, setData] = useState<InstagramAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-instagram-account-details?marketingReference=${marketingReference}`;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Instagram account data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (marketingReference) {
      fetchData();
    }
  }, [marketingReference]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">No data found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Instagram Account Details</h1>

      {/* Profile Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-6">
          <img
            src={data.profile_picture_url}
            alt={data.name}
            className="w-24 h-24 rounded-full"
          />
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">{data.name}</h2>
            <p className="text-gray-600">@{data.username}</p>
            <p className="mt-2">{data.biography}</p>
            {data.website && (
              <a
                href={data.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm mt-2 inline-block"
              >
                {data.website}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Followers</p>
          <p className="text-2xl font-bold">{data.followers_count?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Following</p>
          <p className="text-2xl font-bold">{data.follows_count?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Posts</p>
          <p className="text-2xl font-bold">{data.media_count?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Posts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.instagram_posts?.slice(0, 12).map((post) => {
            const metrics = post.instagram_post_metrics?.[0];
            return (
              <div key={post.id} className="border rounded-lg overflow-hidden">
                {post.media_url && (
                  <img
                    src={post.media_url}
                    alt={post.caption?.substring(0, 50) || 'Instagram post'}
                    className="w-full h-64 object-cover"
                  />
                )}
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    {new Date(post.timestamp).toLocaleDateString()}
                  </p>
                  <p className="text-sm mb-2 line-clamp-2">{post.caption}</p>
                  {metrics && (
                    <div className="flex gap-3 text-sm text-gray-600">
                      <span>❤️ {metrics.likes || 0}</span>
                      <span>💬 {metrics.comments || 0}</span>
                      <span>🔖 {metrics.saves || 0}</span>
                    </div>
                  )}
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                  >
                    View on Instagram →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### 3. Meta Ads Detail Component

**File:** `src/pages/MetaAdsDetail.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface MetaAdsData {
  account_id: string;
  account_name: string;
  currency: string;
  timezone_name: string;
  business_name: string;
  account_status: number;
  meta_campaigns: Array<{
    campaign_id: string;
    name: string;
    status: string;
    objective: string;
    created_time: string;
    meta_adsets: Array<{
      adset_id: string;
      name: string;
      status: string;
      optimization_goal: string;
      daily_budget: number;
      lifetime_budget: number;
      meta_ads: Array<{
        ad_id: string;
        name: string;
        status: string;
        meta_ad_insights: Array<{
          date_start: string;
          date_stop: string;
          impressions: number;
          clicks: number;
          spend: number;
          reach: number;
          ctr: number;
          cpc: number;
          cpm: number;
        }>;
      }>;
    }>;
  }>;
  meta_ad_monthly_insights: Array<{
    month: string;
    impressions: number;
    clicks: number;
    spend: number;
    reach: number;
    ctr: number;
    cpc: number;
    cpm: number;
  }>;
}

export default function MetaAdsDetail() {
  const { marketingReference } = useParams<{ marketingReference: string }>();
  const [data, setData] = useState<MetaAdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-meta-ads-details?marketingReference=${marketingReference}`;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Meta Ads data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (marketingReference) {
      fetchData();
    }
  }, [marketingReference]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">No data found</div>
      </div>
    );
  }

  const totalSpend = data.meta_ad_monthly_insights?.reduce((sum, insight) => sum + (insight.spend || 0), 0) || 0;
  const totalClicks = data.meta_ad_monthly_insights?.reduce((sum, insight) => sum + (insight.clicks || 0), 0) || 0;
  const totalImpressions = data.meta_ad_monthly_insights?.reduce((sum, insight) => sum + (insight.impressions || 0), 0) || 0;
  const avgCTR = data.meta_ad_monthly_insights?.reduce((sum, insight) => sum + (insight.ctr || 0), 0) / (data.meta_ad_monthly_insights?.length || 1);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Meta Ads Details</h1>

      {/* Account Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">{data.account_name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-600">Account ID</p>
            <p className="text-lg font-medium">{data.account_id}</p>
          </div>
          <div>
            <p className="text-gray-600">Business</p>
            <p className="text-lg font-medium">{data.business_name}</p>
          </div>
          <div>
            <p className="text-gray-600">Currency</p>
            <p className="text-lg font-medium">{data.currency}</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Spend</p>
          <p className="text-2xl font-bold">{data.currency} {totalSpend.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Clicks</p>
          <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Impressions</p>
          <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Avg CTR</p>
          <p className="text-2xl font-bold">{avgCTR.toFixed(2)}%</p>
        </div>
      </div>

      {/* Campaigns */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Campaigns</h3>
        <div className="space-y-6">
          {data.meta_campaigns?.map((campaign) => (
            <div key={campaign.campaign_id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-semibold">{campaign.name}</h4>
                  <p className="text-sm text-gray-600">Objective: {campaign.objective}</p>
                </div>
                <span className={`px-3 py-1 rounded text-sm ${
                  campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {campaign.status}
                </span>
              </div>

              {/* Ad Sets */}
              {campaign.meta_adsets?.map((adset) => (
                <div key={adset.adset_id} className="ml-4 mt-4 border-l-2 border-gray-200 pl-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium">{adset.name}</h5>
                      <p className="text-sm text-gray-600">
                        Daily Budget: {data.currency} {adset.daily_budget ? (adset.daily_budget / 100).toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      adset.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {adset.status}
                    </span>
                  </div>

                  {/* Ads */}
                  {adset.meta_ads?.map((ad) => {
                    const insights = ad.meta_ad_insights?.[0];
                    return (
                      <div key={ad.ad_id} className="ml-4 mt-2 bg-gray-50 rounded p-3">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium">{ad.name}</p>
                          <span className={`px-2 py-1 rounded text-xs ${
                            ad.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {ad.status}
                          </span>
                        </div>
                        {insights && (
                          <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <p className="text-gray-600">Impressions</p>
                              <p className="font-medium">{insights.impressions?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Clicks</p>
                              <p className="font-medium">{insights.clicks?.toLocaleString() || 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Spend</p>
                              <p className="font-medium">{data.currency} {insights.spend?.toFixed(2) || 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">CTR</p>
                              <p className="font-medium">{insights.ctr?.toFixed(2) || 0}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Database Structure

### Key Tables

1. **facebook_accounts**
   - Stores Facebook page information
   - Links via `marketing_reference` or `page_id`

2. **facebook_posts**
   - Recent posts from Facebook pages
   - Linked via `page_id` foreign key

3. **facebook_post_metrics**
   - Engagement metrics for each post
   - Linked to posts

4. **facebook_page_insights**
   - Daily page-level insights
   - Linked to accounts

5. **instagram_accounts**
   - Instagram account information
   - Links via `marketing_reference` or `account_id`

6. **instagram_posts**
   - Recent Instagram posts
   - Linked via `account_id` foreign key

7. **instagram_post_metrics**
   - Engagement metrics for each post
   - Linked to posts

8. **meta_ad_accounts**
   - Meta Ad account information
   - Links via `marketing_reference` or `account_id`

9. **meta_campaigns**
   - Ad campaigns
   - Linked via `account_id` foreign key

10. **meta_adsets**
    - Ad sets within campaigns
    - Linked via `campaign_id` foreign key

11. **meta_ads**
    - Individual ads
    - Linked via `adset_id` foreign key

12. **meta_ad_insights**
    - Performance metrics for ads
    - Linked to ads

---

## Usage Examples

### Navigating to Detail Pages

From your marketing list page, you can navigate to detail pages using React Router:

```typescript
import { Link } from 'react-router-dom';

// In your marketing list component
<Link to={`/marketing/${marketingProject.id}/facebook`}>
  View Facebook Details
</Link>

<Link to={`/marketing/${marketingProject.id}/instagram`}>
  View Instagram Details
</Link>

<Link to={`/marketing/${marketingProject.id}/meta-ads`}>
  View Meta Ads Details
</Link>
```

### Setting Up Routes

In your router configuration:

```typescript
import { createBrowserRouter } from 'react-router-dom';
import FacebookPageDetail from './pages/FacebookPageDetail';
import InstagramAccountDetail from './pages/InstagramAccountDetail';
import MetaAdsDetail from './pages/MetaAdsDetail';

const router = createBrowserRouter([
  // ... other routes
  {
    path: '/marketing/:marketingReference/facebook',
    element: <FacebookPageDetail />,
  },
  {
    path: '/marketing/:marketingReference/instagram',
    element: <InstagramAccountDetail />,
  },
  {
    path: '/marketing/:marketingReference/meta-ads',
    element: <MetaAdsDetail />,
  },
]);
```

### Environment Variables

Make sure your `.env` file contains:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Testing

You can test the edge functions directly using curl:

```bash
# Test Facebook endpoint
curl -X GET \
  "${SUPABASE_URL}/functions/v1/get-facebook-page-details?marketingReference=MAR001" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# Test Instagram endpoint
curl -X GET \
  "${SUPABASE_URL}/functions/v1/get-instagram-account-details?marketingReference=MAR001" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# Test Meta Ads endpoint
curl -X GET \
  "${SUPABASE_URL}/functions/v1/get-meta-ads-details?marketingReference=MAR001" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

---

## Troubleshooting

### No Data Returned

1. Check that the `marketing_reference` exists in your database
2. Verify that the relationship tables have matching records
3. Check browser console for network errors

### CORS Errors

The edge functions include proper CORS headers, but ensure you're calling them from your frontend using the correct domain.

### Loading Performance

For large datasets, consider:
- Implementing pagination in the edge functions
- Adding caching mechanisms
- Using lazy loading for images

---

## Next Steps

1. Add pagination to handle large numbers of posts
2. Implement filtering and sorting options
3. Add charts for visualizing metrics over time
4. Include export functionality for reports
5. Add real-time updates using Supabase Realtime

---

**Summary:**

This guide provides everything you need to implement the three marketing detail pages:
- ✅ 3 deployed edge functions
- ✅ 3 complete React/TSX components
- ✅ Database structure overview
- ✅ Usage examples and routing setup
- ✅ Testing instructions

Copy the TSX components to your Bolt project and update your routes to start using them immediately!
