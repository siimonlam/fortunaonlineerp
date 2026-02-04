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
    await delay(100);
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

    // Helper function to get result action type based on campaign objective
    const getResultActionTypes = (objective: string | null): string[] => {
      if (!objective) return [];

      // Map campaign objectives to their primary result action types
      switch (objective.toUpperCase()) {
        case 'OUTCOME_TRAFFIC':
        case 'LINK_CLICKS':
          return ['link_click', 'landing_page_view'];

        case 'OUTCOME_ENGAGEMENT':
        case 'POST_ENGAGEMENT':
        case 'PAGE_LIKES':
          return ['post_engagement', 'page_engagement', 'like', 'onsite_conversion.post_save'];

        case 'OUTCOME_LEADS':
        case 'LEAD_GENERATION':
          return ['lead', 'onsite_conversion.lead_grouped'];

        case 'OUTCOME_SALES':
        case 'CONVERSIONS':
          return ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];

        case 'OUTCOME_APP_PROMOTION':
        case 'APP_INSTALLS':
        case 'MOBILE_APP_INSTALLS':
          return ['app_install', 'mobile_app_install'];

        case 'VIDEO_VIEWS':
          return ['video_view', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p100_watched_actions'];

        case 'BRAND_AWARENESS':
        case 'REACH':
          return ['reach', 'frequency'];

        case 'MESSAGES':
          return ['onsite_conversion.messaging_conversation_started_7d'];

        default:
          // Fallback to conversion types if objective is unknown
          return ['purchase', 'lead', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.post_save', 'omni_purchase'];
      }
    };

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

    // Limit to first 1 campaign to prevent resource exhaustion
    const campaignsToProcess = campaigns.slice(0, 1);
    const hasMore = campaigns.length > 1;

    let totalSynced = 0;
    let totalAds = 0;
    let totalAdSets = 0;
    let totalCampaignsProcessed = 0;
    const errors: string[] = [];

    console.log(`\n========================================`);
    console.log(`Starting sync for campaign 1 of ${campaigns.length}`);
    console.log(`Date range: ${since} to ${until}`);
    if (hasMore) {
      console.log(`WARNING: Processing only 1 campaign per request to avoid resource limits`);
      console.log(`${campaigns.length - 1} campaigns remaining - please sync again`);
    }
    console.log(`========================================\n`);

    for (let i = 0; i < campaignsToProcess.length; i++) {
      const campaign = campaignsToProcess[i];
      console.log(`\n[${i + 1}/${campaignsToProcess.length}] Processing campaign: ${campaign.name} (${campaign.campaign_id})`);

      // First, fetch and save all adsets for this campaign
      const adsetsUrl = `https://graph.facebook.com/v21.0/${campaign.campaign_id}/adsets?fields=id,name,status,daily_budget,lifetime_budget,targeting,billing_event,optimization_goal,bid_amount,created_time,updated_time&access_token=${accessToken}`;
      const adsetsResponse = await fetchWithRateLimit(adsetsUrl);

      if (!adsetsResponse.ok) {
        const errorData = await adsetsResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errorMsg = `Campaign ${campaign.name} (${campaign.campaign_id}): ${errorData.error?.message || 'Failed to fetch adsets'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        continue;
      }

      const adsetsData = await adsetsResponse.json();
      const adsets = adsetsData.data || [];

      console.log(`Campaign "${campaign.name}" has ${adsets.length} ad sets`);
      totalCampaignsProcessed++;
      totalAdSets += adsets.length;

      // Batch save all adsets at once
      if (adsets.length > 0) {
        const adsetRecords = adsets.map((adset: any) => ({
          adset_id: adset.id,
          campaign_id: campaign.campaign_id,
          account_id: accountId,
          name: adset.name,
          status: adset.status,
          daily_budget: adset.daily_budget,
          lifetime_budget: adset.lifetime_budget,
          targeting: adset.targeting ? JSON.stringify(adset.targeting) : null,
          billing_event: adset.billing_event,
          optimization_goal: adset.optimization_goal,
          bid_amount: adset.bid_amount,
          created_time: adset.created_time,
          updated_time: adset.updated_time,
          client_number: campaign.client_number,
          marketing_reference: campaign.marketing_reference,
          updated_at: new Date().toISOString()
        }));

        await supabase
          .from('meta_adsets')
          .upsert(adsetRecords, { onConflict: 'adset_id' });
      }

      // Now fetch ads for each adset
      for (const adset of adsets) {
        console.log(`  Fetching ads for adset: ${adset.name} (${adset.id})`);
        const adsUrl = `https://graph.facebook.com/v21.0/${adset.id}/ads?fields=id,name,status,creative{id,name,title,body,image_url,video_id,thumbnail_url,object_story_spec,effective_object_story_id,link_url,call_to_action_type,effective_object_url}&access_token=${accessToken}`;
        const adsResponse = await fetchWithRateLimit(adsUrl);

        if (!adsResponse.ok) {
          const errorData = await adsResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
          const errorMsg = `AdSet ${adset.name} (${adset.id}): ${errorData.error?.message || 'Failed to fetch ads'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        const adsData = await adsResponse.json();
        const ads = adsData.data || [];

        console.log(`  AdSet "${adset.name}" has ${ads.length} ads`);
        totalAds += ads.length;

        for (const ad of ads) {
          // Save ad with creative info
          await supabase
            .from('meta_ads')
            .upsert({
              ad_id: ad.id,
              adset_id: adset.id,
              campaign_id: campaign.campaign_id,
              account_id: accountId,
              name: ad.name,
              status: ad.status,
              creative_id: ad.creative?.id || null,
              client_number: campaign.client_number,
              marketing_reference: campaign.marketing_reference,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'ad_id'
            });

          // Save complete creative details if available
          if (ad.creative?.id) {
            // Determine ad format
            let adFormat = 'unknown';
            if (ad.creative.video_id) {
              adFormat = 'video';
            } else if (ad.creative.image_url) {
              adFormat = 'image';
            } else if (ad.creative.object_story_spec) {
              const spec = ad.creative.object_story_spec;
              if (spec.link_data?.child_attachments) {
                adFormat = 'carousel';
              } else if (spec.video_data) {
                adFormat = 'video';
              } else if (spec.photo_data) {
                adFormat = 'image';
              }
            }

            await supabase
              .from('meta_ad_creatives')
              .upsert({
                creative_id: ad.creative.id,
                ad_id: ad.id,
                account_id: accountId,
                name: ad.creative.name || null,
                title: ad.creative.title || null,
                body: ad.creative.body || null,
                image_url: ad.creative.image_url || null,
                video_id: ad.creative.video_id || null,
                thumbnail_url: ad.creative.thumbnail_url || null,
                link_url: ad.creative.link_url || null,
                effective_object_url: ad.creative.effective_object_url || null,
                call_to_action_type: ad.creative.call_to_action_type || null,
                object_story_spec: ad.creative.object_story_spec ? JSON.stringify(ad.creative.object_story_spec) : null,
                ad_format: adFormat,
                client_number: campaign.client_number,
                marketing_reference: campaign.marketing_reference,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'creative_id'
              });
          }

          console.log(`    Fetching insights for ad: ${ad.name} (${ad.id})`);
          const insightsUrl = `https://graph.facebook.com/v21.0/${ad.id}/insights?fields=impressions,reach,frequency,clicks,unique_clicks,ctr,unique_ctr,inline_link_clicks,inline_link_click_ctr,spend,cpc,cpm,cpp,video_views,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,conversions,conversion_values,cost_per_conversion,actions,social_spend,website_ctr,outbound_clicks,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`;

          console.log(`    Insights URL: ${insightsUrl.substring(0, 150)}...`);

          const insightsResponse = await fetchWithRateLimit(insightsUrl);

          if (!insightsResponse.ok) {
            const errorData = await insightsResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
            const errorMsg = `Ad ${ad.name} (${ad.id}): HTTP ${insightsResponse.status} - ${errorData.error?.message || 'Failed to fetch insights'}`;
            console.error(errorMsg);
            console.error('Full error response:', JSON.stringify(errorData, null, 2));
            errors.push(errorMsg);
            continue;
          }

          const insightsData = await insightsResponse.json();
          const insights = insightsData.data || [];

          console.log(`    Ad "${ad.name}" has ${insights.length} insight records`);

          if (insights.length === 0) {
            console.log(`    WARNING: No insights data returned for ad ${ad.id}. This could mean:`);
            console.log(`      - The ad has no impressions/spend in the date range ${since} to ${until}`);
            console.log(`      - The ad was not active during this period`);
            console.log(`      - The ad is too new to have metrics`);
          }

          for (const insight of insights) {
            const videoP25 = insight.video_p25_watched_actions?.[0]?.value || 0;
            const videoP50 = insight.video_p50_watched_actions?.[0]?.value || 0;
            const videoP75 = insight.video_p75_watched_actions?.[0]?.value || 0;
            const videoP100 = insight.video_p100_watched_actions?.[0]?.value || 0;
            const videoAvgTime = insight.video_avg_time_watched_actions?.[0]?.value || 0;

            let results = 0;
            let resultType: string[] = [];
            if (insight.actions && Array.isArray(insight.actions)) {
              const validActionTypes = getResultActionTypes(campaign.objective);

              // Sum ALL matching action types from the valid list
              for (const actionType of validActionTypes) {
                const resultActions = insight.actions.filter((a: any) => a.action_type === actionType);
                for (const resultAction of resultActions) {
                  const value = parseInt(resultAction.value || '0');
                  if (value > 0) {
                    results += value;
                    if (!resultType.includes(resultAction.action_type)) {
                      resultType.push(resultAction.action_type);
                    }
                  }
                }
              }
            }

            console.log(`    Ad ${ad.id} on ${insight.date_start}: spend=${insight.spend}, impressions=${insight.impressions}, clicks=${insight.clicks}, results=${results} (${resultType || 'none'})`);

            await supabase
              .from('meta_ad_insights')
              .upsert({
                ad_id: ad.id,
                adset_id: adset.id,
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
                result_type: resultType.length > 0 ? resultType.join(', ') : null,
                client_number: campaign.client_number,
                marketing_reference: campaign.marketing_reference,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'ad_id,date'
              });

            totalSynced++;
          }

          // Skip demographics sync to save resources
          // Demographics can be fetched separately if needed
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`SYNC COMPLETE`);
    console.log(`Campaigns processed: ${totalCampaignsProcessed}/${campaigns.length}`);
    console.log(`Total ad sets found: ${totalAdSets}`);
    console.log(`Total ads found: ${totalAds}`);
    console.log(`Total insight records synced: ${totalSynced}`);
    console.log(`Errors encountered: ${errors.length}`);
    console.log(`========================================\n`);

    const message = hasMore
      ? `Synced ${totalSynced} insights records from ${totalAds} ads. Processed ${totalCampaignsProcessed} of ${campaigns.length} campaigns. ${campaigns.length - totalCampaignsProcessed} campaigns remaining - please sync again.`
      : errors.length === 0
        ? `Successfully synced ${totalSynced} insights records from ${totalAds} ads in ${totalAdSets} ad sets across ${totalCampaignsProcessed} campaigns`
        : `Synced ${totalSynced} insights records with ${errors.length} errors`;

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message,
        synced: totalSynced,
        campaigns: totalCampaignsProcessed,
        totalCampaigns: campaigns.length,
        totalAdSets,
        totalAds,
        hasMore,
        remainingCampaigns: campaigns.length - totalCampaignsProcessed,
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
