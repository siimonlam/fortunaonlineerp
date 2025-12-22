import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncRequest {
  accountId: string;
  campaignIds?: string[];
  dateRange?: {
    since: string;
    until: string;
  };
}

// Helper to add delay between API calls to respect rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to make rate-limited API calls with retry logic
async function fetchWithRateLimit(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);

    // Check rate limit headers
    const rateLimitRemaining = response.headers.get('x-app-usage') || response.headers.get('x-ad-account-usage');

    if (response.status === 429 || (response.status === 400 && rateLimitRemaining)) {
      // Rate limited - wait and retry
      const waitTime = Math.min(1000 * Math.pow(2, i), 30000); // Exponential backoff, max 30 seconds
      console.log(`Rate limited, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
      await delay(waitTime);
      continue;
    }

    // Add small delay between all requests to avoid hitting limits
    await delay(200);
    return response;
  }

  // Final attempt
  return await fetch(url);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { accountId, campaignIds, dateRange }: SyncRequest = await req.json();

    if (!accountId) {
      throw new Error('Account ID is required');
    }

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

    const since = dateRange?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = dateRange?.until || new Date().toISOString().split('T')[0];

    let campaigns: any[] = [];

    if (campaignIds && campaignIds.length > 0) {
      const { data } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('account_id', accountId)
        .in('campaign_id', campaignIds);

      campaigns = data || [];
    } else {
      const { data } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('account_id', accountId);

      campaigns = data || [];
    }

    if (campaigns.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No campaigns found to sync insights for',
          synced: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let totalSynced = 0;
    let totalAds = 0;
    let totalCampaignsProcessed = 0;
    const errors: string[] = [];

    console.log(`\n========================================`);
    console.log(`Starting sync for ${campaigns.length} campaigns`);
    console.log(`Date range: ${since} to ${until}`);
    console.log(`========================================\n`);

    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      console.log(`\n[${i + 1}/${campaigns.length}] Processing campaign: ${campaign.name} (${campaign.campaign_id})`);
      const adsUrl = `https://graph.facebook.com/v21.0/${campaign.campaign_id}/ads?fields=id,name,adset_id&access_token=${accessToken}`;
      const adsResponse = await fetchWithRateLimit(adsUrl);

      if (!adsResponse.ok) {
        const errorData = await adsResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errorMsg = `Campaign ${campaign.name} (${campaign.campaign_id}): ${errorData.error?.message || 'Failed to fetch ads'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        continue;
      }

      const adsData = await adsResponse.json();
      const ads = adsData.data || [];

      console.log(`Campaign "${campaign.name}" has ${ads.length} ads`);
      totalCampaignsProcessed++;
      totalAds += ads.length;

      for (const ad of ads) {
        await supabase
          .from('meta_ads')
          .upsert({
            ad_id: ad.id,
            adset_id: ad.adset_id,
            campaign_id: campaign.campaign_id,
            account_id: accountId,
            name: ad.name,
            client_number: campaign.client_number,
            marketing_reference: campaign.marketing_reference,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'ad_id'
          });

        console.log(`  Fetching insights for ad: ${ad.name} (${ad.id})`);
        const insightsUrl = `https://graph.facebook.com/v21.0/${ad.id}/insights?fields=impressions,reach,frequency,clicks,unique_clicks,ctr,unique_ctr,inline_link_clicks,inline_link_click_ctr,spend,cpc,cpm,cpp,video_views,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,conversions,conversion_values,cost_per_conversion,actions,social_spend,website_ctr,outbound_clicks,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`;

        const insightsResponse = await fetchWithRateLimit(insightsUrl);

        if (!insightsResponse.ok) {
          const errorData = await insightsResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
          const errorMsg = `Ad ${ad.name} (${ad.id}): ${errorData.error?.message || 'Failed to fetch insights'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        const insightsData = await insightsResponse.json();
        const insights = insightsData.data || [];

        console.log(`Ad "${ad.name}" has ${insights.length} insight records`);

        for (const insight of insights) {
          const videoP25 = insight.video_p25_watched_actions?.[0]?.value || 0;
          const videoP50 = insight.video_p50_watched_actions?.[0]?.value || 0;
          const videoP75 = insight.video_p75_watched_actions?.[0]?.value || 0;
          const videoP100 = insight.video_p100_watched_actions?.[0]?.value || 0;
          const videoAvgTime = insight.video_avg_time_watched_actions?.[0]?.value || 0;

          let results = 0;
          let resultType = null;
          if (insight.actions && Array.isArray(insight.actions)) {
            const resultAction = insight.actions.find((a: any) =>
              a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
              a.action_type === 'onsite_conversion.post_save' ||
              a.action_type === 'lead' ||
              a.action_type === 'omni_purchase'
            );
            if (resultAction) {
              results = parseInt(resultAction.value || '0');
              resultType = resultAction.action_type;
            }
          }

          console.log(`Ad ${ad.id} on ${insight.date_start}: spend=${insight.spend}, impressions=${insight.impressions}, clicks=${insight.clicks}, results=${results}`);

          await supabase
            .from('meta_ad_insights')
            .upsert({
              ad_id: ad.id,
              adset_id: ad.adset_id,
              campaign_id: campaign.campaign_id,
              account_id: accountId,
              date: insight.date_start,
              impressions: parseInt(insight.impressions || '0'),
              reach: parseInt(insight.reach || '0'),
              frequency: parseFloat(insight.frequency || '0'),
              clicks: parseInt(insight.clicks || '0'),
              unique_clicks: parseInt(insight.unique_clicks || '0'),
              ctr: parseFloat(insight.ctr || '0'),
              unique_ctr: parseFloat(insight.unique_ctr || '0'),
              inline_link_clicks: parseInt(insight.inline_link_clicks || '0'),
              inline_link_click_ctr: parseFloat(insight.inline_link_click_ctr || '0'),
              spend: parseFloat(insight.spend || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              cpm: parseFloat(insight.cpm || '0'),
              cpp: parseFloat(insight.cpp || '0'),
              video_views: parseInt(insight.video_views || '0'),
              video_avg_time_watched_actions: parseFloat(videoAvgTime),
              video_p25_watched_actions: parseInt(videoP25),
              video_p50_watched_actions: parseInt(videoP50),
              video_p75_watched_actions: parseInt(videoP75),
              video_p100_watched_actions: parseInt(videoP100),
              conversions: parseInt(insight.conversions || '0'),
              conversion_values: parseFloat(insight.conversion_values || '0'),
              cost_per_conversion: parseFloat(insight.cost_per_conversion || '0'),
              actions: insight.actions ? JSON.stringify(insight.actions) : null,
              social_spend: parseFloat(insight.social_spend || '0'),
              website_ctr: parseFloat(insight.website_ctr || '0'),
              outbound_clicks: parseInt(insight.outbound_clicks || '0'),
              quality_ranking: insight.quality_ranking || null,
              engagement_rate_ranking: insight.engagement_rate_ranking || null,
              conversion_rate_ranking: insight.conversion_rate_ranking || null,
              results,
              result_type: resultType,
              client_number: campaign.client_number,
              marketing_reference: campaign.marketing_reference,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'ad_id,date'
            });

          totalSynced++;
        }

        console.log(`  Fetching demographics for ad: ${ad.name}`);
        const demographicsUrl = `https://graph.facebook.com/v21.0/${ad.id}/insights?fields=impressions,clicks,spend,actions&breakdowns=age,gender,country&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`;

        const demographicsResponse = await fetchWithRateLimit(demographicsUrl);

        if (demographicsResponse.ok) {
          const demographicsData = await demographicsResponse.json();
          const demographics = demographicsData.data || [];

          for (const demo of demographics) {
            let demoResults = 0;
            if (demo.actions && Array.isArray(demo.actions)) {
              const resultAction = demo.actions.find((a: any) =>
                a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                a.action_type === 'onsite_conversion.post_save' ||
                a.action_type === 'lead' ||
                a.action_type === 'omni_purchase'
              );
              if (resultAction) {
                demoResults = parseInt(resultAction.value || '0');
              }
            }

            await supabase
              .from('meta_ad_insights_demographics')
              .upsert({
                ad_id: ad.id,
                date: demo.date_start,
                age: demo.age || null,
                gender: demo.gender || null,
                country: demo.country || null,
                impressions: parseInt(demo.impressions || '0'),
                clicks: parseInt(demo.clicks || '0'),
                spend: parseFloat(demo.spend || '0'),
                conversions: 0,
                results: demoResults,
                client_number: campaign.client_number,
                marketing_reference: campaign.marketing_reference,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'ad_id,date,age,gender,country'
              });
          }
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`SYNC COMPLETE`);
    console.log(`Campaigns processed: ${totalCampaignsProcessed}/${campaigns.length}`);
    console.log(`Total ads found: ${totalAds}`);
    console.log(`Total insight records synced: ${totalSynced}`);
    console.log(`Errors encountered: ${errors.length}`);
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message: errors.length === 0
          ? `Successfully synced ${totalSynced} insights records from ${totalAds} ads across ${totalCampaignsProcessed} campaigns`
          : `Synced ${totalSynced} insights records with ${errors.length} errors`,
        synced: totalSynced,
        campaigns: totalCampaignsProcessed,
        totalAds,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        hasMoreErrors: errors.length > 10
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error syncing Meta Ads insights:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});