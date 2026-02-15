import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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
        JSON.stringify({ error: "marketingReference or pageId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let query = supabase
      .from("facebook_accounts")
      .select(`
        *,
        facebook_posts!facebook_posts_page_id_fkey (
          id,
          post_id,
          message,
          permalink_url,
          created_time,
          post_type,
          facebook_post_metrics (
            likes,
            comments,
            shares,
            reactions,
            reach,
            impressions,
            engagement,
            video_views
          )
        ),
        facebook_page_insights (
          date,
          page_impressions,
          page_impressions_unique,
          page_impressions_paid,
          page_impressions_organic,
          page_engaged_users,
          page_post_engagements,
          page_consumptions,
          page_consumptions_unique,
          page_fan_adds,
          page_fan_removes,
          page_views_total
        ),
        facebook_page_demographics (
          age_range,
          gender,
          country,
          city,
          value,
          metric_type
        )
      `)
      .order("created_time", { foreignTable: "facebook_posts", ascending: false })
      .limit(20, { foreignTable: "facebook_posts" });

    if (marketingReference) {
      query = query.eq("marketing_reference", marketingReference);
    } else if (pageId) {
      query = query.eq("page_id", pageId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Facebook page not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching Facebook page details:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
