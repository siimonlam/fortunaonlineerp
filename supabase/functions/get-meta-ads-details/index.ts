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
      .from("meta_ad_accounts")
      .select(`
        *,
        meta_campaigns!meta_campaigns_account_id_fkey (
          id,
          campaign_id,
          name,
          status,
          objective,
          created_time,
          meta_adsets!meta_adsets_campaign_id_fkey (
            id,
            adset_id,
            name,
            status,
            optimization_goal,
            billing_event,
            bid_amount,
            daily_budget,
            lifetime_budget,
            meta_ads!meta_ads_adset_id_fkey (
              id,
              ad_id,
              name,
              status,
              creative_id,
              meta_ad_insights (
                date_start,
                date_stop,
                impressions,
                clicks,
                spend,
                reach,
                frequency,
                ctr,
                cpc,
                cpm,
                cpp
              )
            )
          )
        ),
        meta_ad_monthly_insights (
          month,
          impressions,
          clicks,
          spend,
          reach,
          ctr,
          cpc,
          cpm
        )
      `)
      .order("created_time", { foreignTable: "meta_campaigns", ascending: false })
      .limit(10, { foreignTable: "meta_campaigns" });

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
        JSON.stringify({ error: "Meta Ad account not found" }),
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
    console.error("Error fetching Meta Ads details:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
