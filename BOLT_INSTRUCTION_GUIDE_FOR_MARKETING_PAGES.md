# Marketing Detail Pages - Complete Implementation Guide for Bolt

**PURPOSE:** This guide is designed to instruct another AI (like Bolt) or developer to implement Facebook, Instagram, and Meta Ads detail pages based on your existing database structure.

**IMPORTANT:** This guide assumes your Supabase database already has all the necessary tables. You will NOT be creating or modifying database tables - only creating edge functions and frontend components to display the data.

---

## Quick Summary

You need to create:
1. **3 Supabase Edge Functions** - To fetch data from the database
2. **3 React/TypeScript Components** - To display the data beautifully
3. **Navigation/Routing** - To access these pages from your marketing project

---

## Part 1: Database Tables You'll Be Querying

Your database already has these tables. Here's what each one contains:

### Facebook Tables

**facebook_accounts** - Main Facebook page data
- Contains: page_id, name, username, followers_count, total_page_likes, engagement metrics
- Key field: `marketing_reference` (links to marketing projects)

**facebook_posts** - Individual posts from pages
- Contains: post_id, page_id, message, likes_count, comments_count, date
- Links to facebook_accounts via `page_id`

**facebook_post_metrics** - Engagement metrics for each post
- Contains: impressions, reach, engagement, video_views
- Links to facebook_posts via `post_id`

**facebook_page_insights** - Daily page-level metrics
- Contains: page_impressions, page_engaged_users, fan growth
- Links to facebook_accounts via `page_id`

### Instagram Tables

**instagram_accounts** - Instagram account information
- Contains: account_id, username, name, followers_count, media_count, biography
- Key field: `marketing_reference`

**instagram_posts** - Media posts
- Contains: media_id, caption, media_type, media_url, likes_count
- Links to instagram_accounts via `account_id`

**instagram_post_metrics** - Post performance metrics
- Contains: impressions, reach, engagement, saved, video_views
- Links to instagram_posts via `media_id`

### Meta Ads Tables

**meta_ad_accounts** - Ad account information
- Contains: account_id, account_name, currency, business_name
- Key field: `marketing_reference`

**meta_campaigns** - Ad campaigns
- Contains: campaign_id, name, objective, status, budget
- Links to meta_ad_accounts via `account_id`

**meta_adsets** - Ad sets within campaigns
- Contains: adset_id, campaign_id, name, optimization_goal, daily_budget
- Links to meta_campaigns via `campaign_id`

**meta_ads** - Individual ads
- Contains: ad_id, adset_id, name, status, creative_id
- Links to meta_adsets via `adset_id`

**meta_ad_insights** - Performance metrics for ads
- Contains: impressions, clicks, spend, reach, ctr, cpc, cpm
- Links to meta_ads via `ad_id`

**meta_ad_monthly_insights** - Monthly aggregated metrics
- Contains: month_year, impressions, clicks, spend, reach
- Linked by account_id, campaign_id, adset_id, ad_id

---

## Part 2: Create Edge Functions

Create these 3 files in your Supabase project under `supabase/functions/`.

### Edge Function 1: `get-facebook-page-details/index.ts`

This function fetches Facebook page data including posts, metrics, and insights.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const marketingReference = url.searchParams.get("marketingReference");
    const pageId = url.searchParams.get("pageId");

    if (!marketingReference && !pageId) {
      return new Response(
        JSON.stringify({ error: "marketingReference or pageId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("facebook_accounts").select("*");
    if (marketingReference) {
      query = query.eq("marketing_reference", marketingReference);
    } else {
      query = query.eq("page_id", pageId);
    }

    const { data: account, error: accountError } = await query.maybeSingle();
    if (accountError) throw accountError;
    if (!account) {
      return new Response(
        JSON.stringify({ error: "Facebook page not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: posts } = await supabase
      .from("facebook_posts")
      .select("*")
      .eq("page_id", account.page_id)
      .order("date", { ascending: false })
      .limit(20);

    const postIds = posts?.map(p => p.post_id) || [];
    let metrics = [];
    if (postIds.length > 0) {
      const { data: metricsData } = await supabase
        .from("facebook_post_metrics")
        .select("*")
        .in("post_id", postIds);
      metrics = metricsData || [];
    }

    const postsWithMetrics = posts?.map(post => ({
      ...post,
      facebook_post_metrics: metrics.filter(m => m.post_id === post.post_id)
    })) || [];

    const { data: insights } = await supabase
      .from("facebook_page_insights")
      .select("*")
      .eq("page_id", account.page_id)
      .order("date", { ascending: false })
      .limit(30);

    const result = {
      ...account,
      facebook_posts: postsWithMetrics,
      facebook_page_insights: insights || []
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Edge Function 2: `get-instagram-account-details/index.ts`

This function fetches Instagram account data with posts and metrics.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const marketingReference = url.searchParams.get("marketingReference");
    const accountId = url.searchParams.get("accountId");

    if (!marketingReference && !accountId) {
      return new Response(
        JSON.stringify({ error: "marketingReference or accountId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("instagram_accounts").select("*");
    if (marketingReference) {
      query = query.eq("marketing_reference", marketingReference);
    } else {
      query = query.eq("account_id", accountId);
    }

    const { data: account, error: accountError } = await query.maybeSingle();
    if (accountError) throw accountError;
    if (!account) {
      return new Response(
        JSON.stringify({ error: "Instagram account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: posts } = await supabase
      .from("instagram_posts")
      .select("*")
      .eq("account_id", account.account_id)
      .order("date", { ascending: false })
      .limit(20);

    const mediaIds = posts?.map(p => p.media_id) || [];
    let metrics = [];
    if (mediaIds.length > 0) {
      const { data: metricsData } = await supabase
        .from("instagram_post_metrics")
        .select("*")
        .in("media_id", mediaIds);
      metrics = metricsData || [];
    }

    const postsWithMetrics = posts?.map(post => ({
      ...post,
      instagram_post_metrics: metrics.filter(m => m.media_id === post.media_id)
    })) || [];

    const result = {
      ...account,
      instagram_posts: postsWithMetrics
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Edge Function 3: `get-meta-ads-details/index.ts`

This function fetches Meta Ads campaigns, ad sets, ads, and insights.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const marketingReference = url.searchParams.get("marketingReference");
    const accountId = url.searchParams.get("accountId");

    if (!marketingReference && !accountId) {
      return new Response(
        JSON.stringify({ error: "marketingReference or accountId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("meta_ad_accounts").select("*");
    if (marketingReference) {
      query = query.eq("marketing_reference", marketingReference);
    } else {
      query = query.eq("account_id", accountId);
    }

    const { data: account, error: accountError } = await query.maybeSingle();
    if (accountError) throw accountError;
    if (!account) {
      return new Response(
        JSON.stringify({ error: "Meta Ad account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: campaigns } = await supabase
      .from("meta_campaigns")
      .select("*")
      .eq("account_id", account.account_id)
      .order("created_time", { ascending: false })
      .limit(10);

    const campaignIds = campaigns?.map(c => c.campaign_id) || [];
    let adsets = [];
    if (campaignIds.length > 0) {
      const { data: adsetsData } = await supabase
        .from("meta_adsets")
        .select("*")
        .in("campaign_id", campaignIds);
      adsets = adsetsData || [];
    }

    const adsetIds = adsets?.map(a => a.adset_id) || [];
    let ads = [];
    if (adsetIds.length > 0) {
      const { data: adsData } = await supabase
        .from("meta_ads")
        .select("*")
        .in("adset_id", adsetIds);
      ads = adsData || [];
    }

    const adIds = ads?.map(a => a.ad_id) || [];
    let insights = [];
    if (adIds.length > 0) {
      const { data: insightsData } = await supabase
        .from("meta_ad_insights")
        .select("*")
        .in("ad_id", adIds)
        .order("date", { ascending: false });
      insights = insightsData || [];
    }

    const adsWithInsights = ads?.map(ad => ({
      ...ad,
      meta_ad_insights: insights.filter(i => i.ad_id === ad.ad_id).slice(0, 7)
    })) || [];

    const adsetsWithAds = adsets?.map(adset => ({
      ...adset,
      meta_ads: adsWithInsights.filter(a => a.adset_id === adset.adset_id)
    })) || [];

    const campaignsWithAdsets = campaigns?.map(campaign => ({
      ...campaign,
      meta_adsets: adsetsWithAds.filter(a => a.campaign_id === campaign.campaign_id)
    })) || [];

    const { data: monthlyInsights } = await supabase
      .from("meta_ad_monthly_insights")
      .select("*")
      .eq("account_id", account.account_id)
      .order("month_year", { ascending: false })
      .limit(12);

    const result = {
      ...account,
      meta_campaigns: campaignsWithAdsets,
      meta_ad_monthly_insights: monthlyInsights || []
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**After creating these files, deploy them:**
```bash
supabase functions deploy get-facebook-page-details
supabase functions deploy get-instagram-account-details
supabase functions deploy get-meta-ads-details
```

---

## Part 3: Create Frontend Components

Now create these 3 React components. They fetch data from your edge functions and display it beautifully.

### Component 1: `src/components/FacebookPageDetail.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function FacebookPageDetail() {
  const { marketingReference } = useParams<{ marketingReference: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-facebook-page-details?marketingReference=${marketingReference}`;

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (marketingReference) fetchData();
  }, [marketingReference]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-red-600">Error: {error}</div></div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-600">No data found</div></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Facebook Page Analytics</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">{data.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Username</p>
            <p className="text-lg font-medium">@{data.username}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Category</p>
            <p className="text-lg font-medium">{data.category}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Likes</p>
            <p className="text-lg font-medium">{data.total_page_likes?.toLocaleString() || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">28-Day Reach</p>
          <p className="text-2xl font-bold text-blue-600">{data.total_reach_28d?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">28-Day Engagement</p>
          <p className="text-2xl font-bold text-green-600">{data.total_engagement_28d?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Engagement Rate</p>
          <p className="text-2xl font-bold text-purple-600">{data.engagement_rate?.toFixed(2) || 0}%</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">7-Day Growth</p>
          <p className="text-2xl font-bold text-orange-600">{data.net_growth_7d > 0 ? '+' : ''}{data.net_growth_7d?.toLocaleString() || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Posts</h3>
        <div className="space-y-4">
          {data.facebook_posts?.slice(0, 10).map((post: any) => {
            const metrics = post.facebook_post_metrics?.[0];
            return (
              <div key={post.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                <p className="text-sm text-gray-500 mb-2">{new Date(post.date).toLocaleDateString()}</p>
                <p className="mb-3">{post.message}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span>👍 {post.likes_count || 0}</span>
                  <span>💬 {post.comments_count || 0}</span>
                  <span>🔄 {post.shares_count || 0}</span>
                  {metrics && <span>👁️ {metrics.reach?.toLocaleString() || 0} reach</span>}
                </div>
                {post.permalink_url && (
                  <a href={post.permalink_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                    View on Facebook →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### Component 2: `src/components/InstagramAccountDetail.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function InstagramAccountDetail() {
  const { marketingReference } = useParams<{ marketingReference: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-instagram-account-details?marketingReference=${marketingReference}`;

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (marketingReference) fetchData();
  }, [marketingReference]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-red-600">Error: {error}</div></div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-600">No data found</div></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Instagram Account Analytics</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-6">
          {data.profile_picture_url && (
            <img src={data.profile_picture_url} alt={data.name} className="w-24 h-24 rounded-full object-cover" />
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">{data.name}</h2>
            <p className="text-gray-600">@{data.username}</p>
            <p className="mt-2 text-gray-700">{data.biography}</p>
            {data.website && (
              <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                {data.website}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Followers</p>
          <p className="text-2xl font-bold text-purple-600">{data.followers_count?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Following</p>
          <p className="text-2xl font-bold text-blue-600">{data.follows_count?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Total Posts</p>
          <p className="text-2xl font-bold text-pink-600">{data.media_count?.toLocaleString() || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Posts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.instagram_posts?.slice(0, 12).map((post: any) => {
            const metrics = post.instagram_post_metrics?.[0];
            return (
              <div key={post.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {post.media_url && <img src={post.media_url} alt={post.caption?.substring(0, 50) || 'Post'} className="w-full h-64 object-cover" />}
                <div className="p-4">
                  <p className="text-sm text-gray-500 mb-2">{new Date(post.date).toLocaleDateString()}</p>
                  <p className="text-sm mb-3 line-clamp-2">{post.caption}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-2">
                    <span>❤️ {post.likes_count || 0}</span>
                    <span>💬 {post.comments_count || 0}</span>
                    {metrics && <span>🔖 {metrics.saved || 0}</span>}
                  </div>
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                      View on Instagram →
                    </a>
                  )}
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

### Component 3: `src/components/MetaAdsDetail.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function MetaAdsDetail() {
  const { marketingReference } = useParams<{ marketingReference: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-meta-ads-details?marketingReference=${marketingReference}`;

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (marketingReference) fetchData();
  }, [marketingReference]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-red-600">Error: {error}</div></div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-600">No data found</div></div>;
  }

  const totalSpend = data.meta_ad_monthly_insights?.reduce((sum: number, i: any) => sum + (Number(i.spend) || 0), 0) || 0;
  const totalClicks = data.meta_ad_monthly_insights?.reduce((sum: number, i: any) => sum + (Number(i.clicks) || 0), 0) || 0;
  const totalImpressions = data.meta_ad_monthly_insights?.reduce((sum: number, i: any) => sum + (Number(i.impressions) || 0), 0) || 0;
  const avgCTR = (data.meta_ad_monthly_insights?.reduce((sum: number, i: any) => sum + (Number(i.ctr) || 0), 0) / (data.meta_ad_monthly_insights?.length || 1)) || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Meta Ads Analytics</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">{data.account_name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Account ID</p>
            <p className="text-lg font-medium">{data.account_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Business</p>
            <p className="text-lg font-medium">{data.business_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Currency</p>
            <p className="text-lg font-medium">{data.currency}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Total Spend</p>
          <p className="text-2xl font-bold text-red-600">{data.currency} {totalSpend.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Total Clicks</p>
          <p className="text-2xl font-bold text-blue-600">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Total Impressions</p>
          <p className="text-2xl font-bold text-purple-600">{totalImpressions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Avg CTR</p>
          <p className="text-2xl font-bold text-green-600">{avgCTR.toFixed(2)}%</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Campaigns</h3>
        <div className="space-y-6">
          {data.meta_campaigns?.map((campaign: any) => (
            <div key={campaign.campaign_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-semibold">{campaign.name}</h4>
                  <p className="text-sm text-gray-600">Objective: {campaign.objective}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {campaign.status}
                </span>
              </div>

              {campaign.meta_adsets?.map((adset: any) => (
                <div key={adset.adset_id} className="ml-4 mt-4 border-l-2 border-gray-300 pl-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium text-gray-900">{adset.name}</h5>
                      <p className="text-sm text-gray-600">
                        Budget: {data.currency} {adset.daily_budget ? (Number(adset.daily_budget) / 100).toFixed(2) : 'N/A'}/day
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${adset.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {adset.status}
                    </span>
                  </div>

                  {adset.meta_ads?.map((ad: any) => {
                    const totalInsights = ad.meta_ad_insights?.reduce((acc: any, i: any) => ({
                      impressions: acc.impressions + (Number(i.impressions) || 0),
                      clicks: acc.clicks + (Number(i.clicks) || 0),
                      spend: acc.spend + (Number(i.spend) || 0),
                    }), { impressions: 0, clicks: 0, spend: 0 });

                    return (
                      <div key={ad.ad_id} className="ml-4 mt-3 bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-900 mb-2">{ad.name}</p>
                        {totalInsights && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-gray-600">Impressions</p>
                              <p className="font-medium">{totalInsights.impressions.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Clicks</p>
                              <p className="font-medium">{totalInsights.clicks.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Spend</p>
                              <p className="font-medium">{data.currency} {totalInsights.spend.toFixed(2)}</p>
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

## Part 4: Add Routing

In your router configuration file (usually `App.tsx` or `router.tsx`), add these routes:

```typescript
import FacebookPageDetail from './components/FacebookPageDetail';
import InstagramAccountDetail from './components/InstagramAccountDetail';
import MetaAdsDetail from './components/MetaAdsDetail';

// Add these routes to your router
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
}
```

## Part 5: Add Navigation Links

In your marketing project detail page, add buttons to navigate:

```typescript
import { Link, useParams } from 'react-router-dom';

function YourMarketingDetailPage() {
  const { marketingReference } = useParams();

  return (
    <div>
      {/* Your existing content */}

      <div className="flex gap-4 mt-6">
        <Link to={`/marketing/${marketingReference}/facebook`} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Facebook Analytics
        </Link>
        <Link to={`/marketing/${marketingReference}/instagram`} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          Instagram Analytics
        </Link>
        <Link to={`/marketing/${marketingReference}/meta-ads`} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          Meta Ads Analytics
        </Link>
      </div>
    </div>
  );
}
```

---

## Summary Checklist

Use this checklist to ensure you've completed everything:

- [ ] Created 3 edge function files in `supabase/functions/`
- [ ] Deployed all 3 edge functions
- [ ] Created 3 React component files
- [ ] Added routes to your router configuration
- [ ] Added navigation buttons in your marketing detail page
- [ ] Verified `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Tested each page loads without errors

---

## Testing

Test each endpoint by visiting these URLs in your app:
- `/marketing/MAR001/facebook`
- `/marketing/MAR001/instagram`
- `/marketing/MAR001/meta-ads`

(Replace `MAR001` with an actual marketing reference from your database)

---

**That's it! You now have complete instructions to implement all three marketing detail pages in your Bolt project!**
