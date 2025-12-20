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
  reactions?: { summary: { total_count: number } };
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

    const requestBody = await req.json();
    console.log('Request body:', requestBody);

    const { pageId, limit = 25 } = requestBody;

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

    // Try to get page-specific access token first
    const { data: pageData } = await supabase
      .from("facebook_accounts")
      .select("access_token")
      .eq("page_id", pageId)
      .maybeSingle();

    let accessToken = pageData?.access_token || null;

    if (!accessToken) {
      // Try system user token
      const { data: systemToken } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "meta_system_user_token")
        .maybeSingle();

      if (systemToken) {
        accessToken = systemToken.value;
      } else {
        // Fallback to OAuth user token
        const { data: oauthToken } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "meta_oauth_user_token")
          .maybeSingle();

        if (oauthToken) {
          accessToken = oauthToken.value;
        } else {
          return new Response(
            JSON.stringify({
              error: "No access token available",
              details: "Please connect your Facebook account via OAuth or configure a system token in Settings"
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    console.log(`Using ${pageData?.access_token ? 'page-specific' : 'global'} access token`);

    console.log(`Fetching posts for page ${pageId}`);

    const postsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed?fields=id,message,created_time&limit=${limit}&access_token=${accessToken}`
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

        // Fetch post details using attachments field (non-deprecated approach)
        let reactionsCount = 0;
        let commentsCount = 0;
        let sharesCount = 0;
        let fullPicture = '';
        let postType = '';
        let statusType = '';
        let permalinkUrl = '';

        try {
          const detailsResponse = await fetch(
            `https://graph.facebook.com/v21.0/${post.id}?fields=attachments,permalink_url,reactions.summary(true),comments.summary(true),shares&access_token=${accessToken}`
          );
          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json();
            reactionsCount = detailsData.reactions?.summary?.total_count || 0;
            commentsCount = detailsData.comments?.summary?.total_count || 0;
            sharesCount = detailsData.shares?.count || 0;
            permalinkUrl = detailsData.permalink_url || '';

            // Extract type and media from attachments
            if (detailsData.attachments?.data?.[0]) {
              const attachment = detailsData.attachments.data[0];
              postType = attachment.type || '';

              // Get the best quality image
              if (attachment.media?.image?.src) {
                fullPicture = attachment.media.image.src;
              } else if (attachment.media_type === 'photo' && attachment.media?.source) {
                fullPicture = attachment.media.source;
              }

              // status_type is not available in attachments, leave empty
              statusType = '';
            }
          }
        } catch (e) {
          console.log(`Could not fetch details for post ${post.id}`);
        }

        const postDataToUpsert: any = {
          post_id: post.id,
          page_id: pageId,
          date: post.created_time,
          message: post.message || "",
          type: postType,
          status_type: statusType,
          full_picture: fullPicture,
          permalink_url: permalinkUrl,
          likes_count: reactionsCount,
          comments_count: commentsCount,
          shares_count: sharesCount,
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
            reactions: reactionsCount,
            comments: commentsCount,
            shares: sharesCount,
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

    // Fetch page-level insights
    console.log(`Fetching page insights for ${pageId}`);
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const since = Math.floor(yesterday.getTime() / 1000);
      const until = Math.floor(today.getTime() / 1000);

      // Fetch page insights (using only valid metrics)
      const pageInsightsResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_fans,page_fan_adds,page_fan_removes,page_impressions,page_impressions_unique,page_impressions_organic,page_impressions_paid,page_post_engagements,page_engaged_users&period=day&since=${since}&until=${until}&access_token=${accessToken}`
      );

      if (pageInsightsResponse.ok) {
        const insightsData = await pageInsightsResponse.json();
        const metrics = insightsData.data || [];

        console.log(`Page insights API returned ${metrics.length} metrics`);

        const pageMetrics: any = {
          page_id: pageId,
          account_id: pageId,
          client_number: clientNumber,
          marketing_reference: marketingReference,
          date: yesterday.toISOString().split('T')[0],
          page_fans: 0,
          page_fan_adds: 0,
          page_fan_removes: 0,
          net_growth: 0,
          page_impressions: 0,
          page_impressions_unique: 0,
          page_impressions_organic: 0,
          page_impressions_paid: 0,
          page_post_engagements: 0,
          page_engaged_users: 0,
          page_posts_impressions: 0,
          page_posts_impressions_unique: 0,
          page_video_views: 0,
          page_video_views_unique: 0,
        };

        metrics.forEach((metric: any) => {
          const value = metric.values?.[0]?.value || 0;
          switch (metric.name) {
            case 'page_fans':
              pageMetrics.page_fans = value;
              break;
            case 'page_fan_adds':
            case 'page_fan_adds_unique':
              pageMetrics.page_fan_adds = value;
              break;
            case 'page_fan_removes':
            case 'page_fan_removes_unique':
              pageMetrics.page_fan_removes = value;
              break;
            case 'page_impressions':
              pageMetrics.page_impressions = value;
              break;
            case 'page_impressions_unique':
              pageMetrics.page_impressions_unique = value;
              break;
            case 'page_impressions_organic':
              pageMetrics.page_impressions_organic = value;
              break;
            case 'page_impressions_paid':
              pageMetrics.page_impressions_paid = value;
              break;
            case 'page_post_engagements':
              pageMetrics.page_post_engagements = value;
              break;
            case 'page_engaged_users':
              pageMetrics.page_engaged_users = value;
              break;
            case 'page_posts_impressions':
              pageMetrics.page_posts_impressions = value;
              break;
            case 'page_posts_impressions_unique':
              pageMetrics.page_posts_impressions_unique = value;
              break;
            case 'page_video_views':
              pageMetrics.page_video_views = value;
              break;
            case 'page_video_views_unique':
              pageMetrics.page_video_views_unique = value;
              break;
          }
        });

        pageMetrics.net_growth = pageMetrics.page_fan_adds - pageMetrics.page_fan_removes;
        pageMetrics.engagement_rate = pageMetrics.page_impressions_unique > 0
          ? ((pageMetrics.page_engaged_users / pageMetrics.page_impressions_unique) * 100).toFixed(2)
          : 0;

        const { data: insertedInsights, error: insightsError } = await supabase
          .from("facebook_page_insights")
          .upsert(pageMetrics, { onConflict: "page_id,date" });

        if (insightsError) {
          console.error(`Failed to save page insights:`, insightsError);
        } else {
          console.log(`Saved page insights for ${pageId}`, pageMetrics);
        }

        // Update facebook_accounts with latest totals
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);

        const { data: last7DaysData } = await supabase
          .from("facebook_page_insights")
          .select("page_fan_adds, page_fan_removes")
          .eq("page_id", pageId)
          .gte("date", last7Days.toISOString().split('T')[0])
          .order("date", { ascending: false });

        const netGrowth7d = (last7DaysData || []).reduce((sum, day) =>
          sum + (day.page_fan_adds || 0) - (day.page_fan_removes || 0), 0
        );

        await supabase
          .from("facebook_accounts")
          .update({
            total_page_likes: pageMetrics.page_fans,
            engagement_rate: pageMetrics.engagement_rate,
            net_growth_7d: netGrowth7d,
            last_updated: new Date().toISOString(),
          })
          .eq("page_id", pageId);

        console.log(`Updated facebook_accounts totals for ${pageId}`);
      } else {
        const errorData = await pageInsightsResponse.json();
        console.error(`Failed to fetch page insights from Facebook API:`, JSON.stringify(errorData, null, 2));
      }

      // Fetch demographics (using only valid metrics)
      const demographicsResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_fans_gender_age,page_fans_country,page_fans_city&period=lifetime&access_token=${accessToken}`
      );

      if (demographicsResponse.ok) {
        const demoData = await demographicsResponse.json();
        const metrics = demoData.data || [];

        console.log(`Demographics API returned ${metrics.length} metrics`);

        const demographics: any = {
          page_id: pageId,
          account_id: pageId,
          client_number: clientNumber,
          marketing_reference: marketingReference,
          date: yesterday.toISOString().split('T')[0],
          age_gender_breakdown: {},
          country_breakdown: {},
          city_breakdown: {},
          device_breakdown: {},
        };

        metrics.forEach((metric: any) => {
          const value = metric.values?.[0]?.value || {};
          switch (metric.name) {
            case 'page_fans_gender_age':
              demographics.age_gender_breakdown = value;
              break;
            case 'page_fans_country':
              demographics.country_breakdown = value;
              break;
            case 'page_fans_city':
              demographics.city_breakdown = value;
              break;
            case 'page_views_logged_in_unique':
              if (typeof value === 'object') {
                demographics.device_breakdown = value;
              }
              break;
          }
        });

        const { error: demoError } = await supabase
          .from("facebook_page_demographics")
          .upsert(demographics, { onConflict: "page_id,date" });

        if (demoError) {
          console.error(`Failed to save demographics:`, demoError);
        } else {
          console.log(`Saved demographics for ${pageId}`);
        }
      } else {
        const demoErrorData = await demographicsResponse.json();
        console.error(`Failed to fetch demographics from Facebook API:`, JSON.stringify(demoErrorData, null, 2));
      }
    } catch (error) {
      console.error(`Failed to fetch page insights:`, error);
      console.error(`Error details:`, error instanceof Error ? error.message : String(error));
      // Don't fail the entire sync if page insights fail
    }

    let message = `Synced ${syncedPosts.length} post(s) with metrics and page insights`;
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