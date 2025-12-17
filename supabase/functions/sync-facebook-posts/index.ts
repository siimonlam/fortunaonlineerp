import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FacebookPost {
  id: string;
  message?: string;
  type?: string;
  status_type?: string;
  full_picture?: string;
  permalink_url?: string;
  created_time: string;
  likes?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
  shares?: { count: number };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pageId, limit = 25 } = await req.json();

    if (!pageId) {
      return new Response(
        JSON.stringify({ error: "Page ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up marketing project info from junction table
    const { data: junctionData } = await supabase
      .from("marketing_facebook_accounts")
      .select("marketing_reference")
      .eq("page_id", pageId)
      .maybeSingle();

    let marketingReference = null;
    let clientNumber = null;

    if (junctionData?.marketing_reference) {
      marketingReference = junctionData.marketing_reference;

      // Get client_number from marketing_projects
      const { data: projectData } = await supabase
        .from("marketing_projects")
        .select("client_number")
        .eq("project_reference", marketingReference)
        .maybeSingle();

      clientNumber = projectData?.client_number || null;
      console.log(`Page ${pageId} is linked to marketing project ${marketingReference} (client: ${clientNumber})`);
    } else {
      console.log(`Page ${pageId} is not linked to any marketing project`);
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

    console.log(`Fetching posts for page ${pageId}`);

    const postsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,message,type,status_type,full_picture,permalink_url,created_time,likes.summary(true),comments.summary(true),shares&limit=${limit}&access_token=${accessToken}`
    );

    if (!postsResponse.ok) {
      const error = await postsResponse.json();
      console.error(`Failed to fetch posts:`, JSON.stringify(error, null, 2));
      return new Response(
        JSON.stringify({
          error: "Failed to fetch posts",
          details: error.error?.message || "Unknown error"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const postsData = await postsResponse.json();
    const posts: FacebookPost[] = postsData.data || [];

    console.log(`Found ${posts.length} posts`);

    const syncedPosts: any[] = [];
    const failedPosts: string[] = [];

    for (const post of posts) {
      try {
        const { data: existingPost } = await supabase
          .from("facebook_posts")
          .select("post_id, marketing_reference, client_number")
          .eq("post_id", post.id)
          .maybeSingle();

        const postDataToUpsert: any = {
          post_id: post.id,
          page_id: pageId,
          date: post.created_time,
          message: post.message || "",
          type: post.type || "",
          status_type: post.status_type || "",
          full_picture: post.full_picture || "",
          permalink_url: post.permalink_url || "",
          likes_count: post.likes?.summary?.total_count || 0,
          comments_count: post.comments?.summary?.total_count || 0,
          shares_count: post.shares?.count || 0,
          account_id: pageId,
        };

        // Only set marketing_reference and client_number if they're not already set
        if (!existingPost || !existingPost.marketing_reference) {
          postDataToUpsert.client_number = clientNumber;
          postDataToUpsert.marketing_reference = marketingReference;
        }

        const { data: postData, error: postError } = await supabase
          .from("facebook_posts")
          .upsert(postDataToUpsert, {
            onConflict: "post_id",
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
          `https://graph.facebook.com/v21.0/${post.id}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_clicks_by_type,post_reactions_by_type_total,post_negative_feedback,post_video_views&access_token=${accessToken}`
        );

        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json();
          const insights = insightsData.data || [];

          const { data: existingMetrics } = await supabase
            .from("facebook_post_metrics")
            .select("post_id, marketing_reference, client_number")
            .eq("post_id", post.id)
            .maybeSingle();

          const metricsData: any = {
            post_id: post.id,
            account_id: pageId,
            date: new Date().toISOString(),
            impressions: 0,
            reach: 0,
            engagement: 0,
            engaged_users: 0,
            reactions: post.likes?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0,
            shares: post.shares?.count || 0,
            video_views: 0,
            link_clicks: 0,
            photo_clicks: 0,
            negative_feedback: 0,
            reaction_love: {},
            reaction_haha: {},
            reaction_wow: {},
            reaction_sad: {},
            reaction_angry: {},
          };

          // Only set marketing_reference and client_number if they're not already set
          if (!existingMetrics || !existingMetrics.marketing_reference) {
            metricsData.client_number = clientNumber;
            metricsData.marketing_reference = marketingReference;
          }

          insights.forEach((metric: any) => {
            const value = metric.values?.[0]?.value || 0;
            switch (metric.name) {
              case 'post_impressions':
                metricsData.impressions = value;
                break;
              case 'post_impressions_unique':
                metricsData.reach = value;
                break;
              case 'post_engaged_users':
                metricsData.engaged_users = value;
                metricsData.engagement = value;
                break;
              case 'post_clicks':
                metricsData.link_clicks = value;
                break;
              case 'post_clicks_by_type':
                if (typeof value === 'object' && value !== null) {
                  metricsData.link_clicks = value.link_clicks || value['link clicks'] || 0;
                  metricsData.photo_clicks = value.photo_view || value['photo view'] || 0;
                }
                break;
              case 'post_reactions_by_type_total':
                if (typeof value === 'object' && value !== null) {
                  metricsData.reaction_love = { count: value.love || 0 };
                  metricsData.reaction_haha = { count: value.haha || 0 };
                  metricsData.reaction_wow = { count: value.wow || 0 };
                  metricsData.reaction_sad = { count: value.sad || 0 };
                  metricsData.reaction_angry = { count: value.angry || 0 };
                }
                break;
              case 'post_negative_feedback':
                metricsData.negative_feedback = value;
                break;
              case 'post_video_views':
                metricsData.video_views = value;
                break;
            }
          });

          const { error: metricsError } = await supabase
            .from("facebook_post_metrics")
            .upsert(metricsData, {
              onConflict: "post_id,date",
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
    console.error("Error syncing Facebook posts:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});