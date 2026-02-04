import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { accountId } = await req.json();

    const { data: tokenData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'meta_ads_access_token')
      .maybeSingle();

    if (!tokenData?.value) {
      throw new Error('Meta Ads access token not configured');
    }

    const accessToken = tokenData.value;
    const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    // Get campaigns
    const campaignsUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/campaigns?fields=id,name,objective,status&access_token=${accessToken}`;
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    console.log('Campaigns:', JSON.stringify(campaignsData, null, 2));

    const results: any = {
      accountId,
      campaigns: []
    };

    if (!campaignsData.data || campaignsData.data.length === 0) {
      return new Response(JSON.stringify({ error: 'No campaigns found', results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For each campaign, get insights with actions
    for (const campaign of campaignsData.data.slice(0, 5)) { // Limit to first 5 campaigns
      console.log(`\n=== Campaign: ${campaign.name} (${campaign.objective}) ===`);

      const since = '2026-01-01';
      const until = '2026-01-31';

      const insightsUrl = `https://graph.facebook.com/v21.0/${campaign.id}/insights?fields=campaign_name,spend,impressions,clicks,actions&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;

      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      console.log(`Insights for ${campaign.name}:`, JSON.stringify(insightsData, null, 2));

      const campaignResult: any = {
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        insights: insightsData.data || [],
        allActionTypes: new Set()
      };

      // Collect all unique action types
      if (insightsData.data && insightsData.data.length > 0) {
        for (const insight of insightsData.data) {
          if (insight.actions && Array.isArray(insight.actions)) {
            for (const action of insight.actions) {
              campaignResult.allActionTypes.add(action.action_type);
            }
          }
        }
      }

      campaignResult.allActionTypes = Array.from(campaignResult.allActionTypes);
      results.campaigns.push(campaignResult);
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
