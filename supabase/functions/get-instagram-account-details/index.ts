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
    const accountId = url.searchParams.get("accountId");

    if (!marketingReference && !accountId) {
      return new Response(
        JSON.stringify({ error: "marketingReference or accountId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let query = supabase
      .from("instagram_accounts")
      .select(`
        *,
        instagram_posts!instagram_posts_account_id_fkey (
          id,
          media_id,
          caption,
          media_type,
          media_url,
          permalink,
          timestamp,
          instagram_post_metrics (
            likes,
            comments,
            shares,
            saves,
            reach,
            impressions,
            engagement,
            video_views,
            plays
          )
        )
      `)
      .order("timestamp", { foreignTable: "instagram_posts", ascending: false })
      .limit(20, { foreignTable: "instagram_posts" });

    if (marketingReference) {
      query = query.eq("marketing_reference", marketingReference);
    } else if (accountId) {
      query = query.eq("account_id", accountId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Instagram account not found" }),
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
    console.error("Error fetching Instagram account details:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
