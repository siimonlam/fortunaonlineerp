import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accountId, clientNumber, marketingReference, limit = 25 } = await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "Account ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: systemToken } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "meta_system_user_token")
      .maybeSingle();

    if (!systemToken) {
      return new Response(
        JSON.stringify({
          error: "No access token available",
          details: "Please configure a system token in Settings"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = systemToken.value;

    console.log(`Fetching posts for account ${accountId}`);

    const mediaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
    );

    if (!mediaResponse.ok) {
      const error = await mediaResponse.json();
      console.error(`Failed to fetch media:`, JSON.stringify(error, null, 2));
      return new Response(
        JSON.stringify({
          error: "Failed to fetch posts",
          details: error.error?.message || "Unknown error"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mediaData = await mediaResponse.json();
    const posts: MediaItem[] = mediaData.data || [];

    console.log(`Found ${posts.length} posts`);

    const syncedPosts: any[] = [];
    const failedPosts: string[] = [];

    for (const post of posts) {
      try {
        const { data: postData, error: postError } = await supabase
          .from("instagram_posts")
          .upsert({
            media_id: post.id,
            date: post.timestamp,
            caption: post.caption || "",
            media_type: post.media_type,
            media_url: post.media_url || "",
            permalink: post.permalink || "",
            thumbnail_url: post.thumbnail_url || "",
            likes_count: post.like_count || 0,
            comments_count: post.comments_count || 0,
            account_id: accountId,
            client_number: clientNumber || null,
            marketing_reference: marketingReference || null,
          }, {
            onConflict: "media_id",
          })
          .select()
          .single();

        if (postError) {
          console.error(`Failed to save post ${post.id}:`, postError);
          failedPosts.push(post.id);
          continue;
        }

        console.log(`Fetching insights for post ${post.id}`);

        const insightsResponse = await fetch(
          `https://graph.facebook.com/v21.0/${post.id}/insights?metric=engagement,impressions,reach,saved${post.media_type === 'VIDEO' || post.media_type === 'REELS' ? ',video_views' : ''}&access_token=${accessToken}`
        );

        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json();
          const insights = insightsData.data || [];

          const metricsData: any = {
            media_id: post.id,
            account_id: accountId,
            client_number: clientNumber || null,
            marketing_reference: marketingReference || null,
            date: new Date().toISOString(),
            impressions: 0,
            reach: 0,
            engagement: 0,
            saved: 0,
            video_views: 0,
            shares: 0,
          };

          insights.forEach((metric: any) => {
            const value = metric.values?.[0]?.value || 0;
            switch (metric.name) {
              case 'impressions':
                metricsData.impressions = value;
                break;
              case 'reach':
                metricsData.reach = value;
                break;
              case 'engagement':
                metricsData.engagement = value;
                break;
              case 'saved':
                metricsData.saved = value;
                break;
              case 'video_views':
                metricsData.video_views = value;
                break;
            }
          });

          const { error: metricsError } = await supabase
            .from("instagram_post_metrics")
            .upsert(metricsData, {
              onConflict: "media_id,date",
            });

          if (metricsError) {
            console.error(`Failed to save metrics for post ${post.id}:`, metricsError);
          }
        } else {
          console.log(`Could not fetch insights for post ${post.id} (may not be available yet)`);
        }

        syncedPosts.push(postData);
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
        failedPosts.push(post.id);
      }
    }

    let message = `Synced ${syncedPosts.length} post(s) with metrics`;
    if (failedPosts.length > 0) {
      message += `. Failed to sync ${failedPosts.length} post(s)`;
    }

    console.log('Sync complete:', message);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        posts: syncedPosts,
        failedPosts,
        total: posts.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing Instagram posts:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});