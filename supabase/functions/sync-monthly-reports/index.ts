import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  accountId: string;
  datePreset?: 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_12_months';
  customDateRange?: {
    since: string;
    until: string;
  };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const waitTime = Math.min(1000 * Math.pow(2, i), 30000);
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
        await delay(waitTime);
        continue;
      }

      if (response.status >= 500) {
        const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
        console.log(`Server error (${response.status}), waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
        await delay(waitTime);
        continue;
      }

      await delay(100);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`Request failed, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
      await delay(waitTime);
    }
  }

  return await fetch(url);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
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

    let requestBody: SyncRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { accountId, datePreset = 'last_month', customDateRange } = requestBody;

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

    let timeRangeParam: string;
    if (customDateRange) {
      const timeRangeObj = JSON.stringify({ since: customDateRange.since, until: customDateRange.until });
      timeRangeParam = `time_range=${encodeURIComponent(timeRangeObj)}`;
    } else if (datePreset === 'last_6_months') {
      const today = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(today.getMonth() - 6);

      const since = sixMonthsAgo.toISOString().split('T')[0];
      const until = today.toISOString().split('T')[0];

      const timeRangeObj = JSON.stringify({ since, until });
      timeRangeParam = `time_range=${encodeURIComponent(timeRangeObj)}`;
    } else if (datePreset === 'last_12_months') {
      const today = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(today.getMonth() - 12);

      const since = twelveMonthsAgo.toISOString().split('T')[0];
      const until = today.toISOString().split('T')[0];

      const timeRangeObj = JSON.stringify({ since, until });
      timeRangeParam = `time_range=${encodeURIComponent(timeRangeObj)}`;
    } else {
      timeRangeParam = `date_preset=${datePreset}`;
    }

    console.log(`\n========================================`);
    console.log(`Starting MONTHLY sync for account: ${formattedAccountId}`);
    console.log(`Date preset: ${datePreset}`);
    if (customDateRange) {
      console.log(`Custom range: ${customDateRange.since} to ${customDateRange.until}`);
    } else if (datePreset === 'last_6_months') {
      const today = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(today.getMonth() - 6);
      console.log(`Calculated range: ${sixMonthsAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
    } else if (datePreset === 'last_12_months') {
      const today = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(today.getMonth() - 12);
      console.log(`Calculated range: ${twelveMonthsAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
    }
    console.log(`========================================\n`);

    let totalInsightsUpserted = 0;
    let totalDemographicsUpserted = 0;
    let totalAdSetsProcessed = 0;
    const errors: string[] = [];

    console.log('Fetching metadata for account...');
    const { data: allAdsets } = await supabase
      .from('meta_adsets')
      .select('adset_id, name, client_number, marketing_reference, campaign_id')
      .eq('account_id', accountId);

    const { data: allCampaigns } = await supabase
      .from('meta_campaigns')
      .select('campaign_id, name, objective')
      .eq('account_id', accountId);

    const { data: accountData } = await supabase
      .from('meta_ad_accounts')
      .select('account_name')
      .eq('account_id', accountId)
      .maybeSingle();

    const adsetMap = new Map((allAdsets || []).map(a => [a.adset_id, a]));
    const campaignMap = new Map((allCampaigns || []).map(c => [c.campaign_id, c]));
    console.log(`Loaded ${adsetMap.size} adsets, ${campaignMap.size} campaigns\n`);

    // Priority-based result calculation system
    // Returns a prioritized array where the most important metric is first
    // Logic: Find the first metric with value > 0 and STOP (do not sum)
    const getResultActionTypes = (objective: string | null): string[] => {
      if (!objective) {
        return ['omni_purchase', 'purchase', 'lead', 'link_click', 'post_engagement'];
      }

      switch (objective.toUpperCase()) {
        case 'OUTCOME_SALES':
        case 'CONVERSIONS':
          // Priority: If actual Purchases exist, use that. If 0, fallback to Checkouts. If 0, fallback to Carts
          return [
            'omni_purchase',
            'purchase',
            'offsite_conversion.fb_pixel_purchase',
            'initiate_checkout',
            'add_to_cart'
          ];

        case 'OUTCOME_LEADS':
        case 'LEAD_GENERATION':
          return [
            'on_facebook_lead',
            'lead',
            'offsite_conversion.fb_pixel_lead',
            'contact'
          ];

        case 'OUTCOME_TRAFFIC':
        case 'LINK_CLICKS':
          // Priority: Link Clicks is the standard volume metric
          return [
            'link_click',
            'outbound_click',
            'landing_page_view'
          ];

        case 'OUTCOME_ENGAGEMENT':
        case 'POST_ENGAGEMENT':
        case 'PAGE_LIKES':
          return [
            'post_engagement',
            'page_engagement',
            'video_view',
            'like'
          ];

        case 'OUTCOME_APP_PROMOTION':
        case 'APP_INSTALLS':
        case 'MOBILE_APP_INSTALLS':
          return [
            'mobile_app_install',
            'app_install'
          ];

        case 'VIDEO_VIEWS':
          return ['video_view', 'video_p100_watched_actions', 'video_p75_watched_actions', 'video_p50_watched_actions'];

        case 'BRAND_AWARENESS':
        case 'OUTCOME_AWARENESS':
        case 'REACH':
          return [
            'estimated_ad_recallers',
            'reach'
          ];

        case 'MESSAGES':
          return ['onsite_conversion.messaging_conversation_started_7d'];

        default:
          return ['omni_purchase', 'purchase', 'lead', 'link_click', 'post_engagement'];
      }
    };

    // Calculate results using priority system - Find First Match (do NOT sum)
    const calculateResults = (actions: any[], objective: string | null): { value: number, type: string | null } => {
      if (!actions || !Array.isArray(actions) || actions.length === 0) {
        return { value: 0, type: null };
      }

      const validActionTypes = getResultActionTypes(objective);

      // Take ONLY the first matching action type with value > 0 (highest priority)
      for (const actionType of validActionTypes) {
        const action = actions.find((a: any) => a.action_type === actionType);
        if (action) {
          const value = parseInt(action.value || '0');
          if (value > 0) {
            // Return the first match - this is the primary action
            return { value, type: actionType };
          }
        }
      }

      // No matches found with value > 0
      return { value: 0, type: null };
    };

    // Calculate objective-specific metrics based on campaign objective
    // Only ONE objective column should have a value - determined by the campaign objective
    const calculateObjectiveMetrics = (actions: any[], objective: string | null) => {
      // Initialize all metrics to 0
      const metrics = {
        sales: 0,
        sales_purchase: 0,
        sales_initiate_checkout: 0,
        sales_add_to_cart: 0,
        leads: 0,
        traffic: 0,
        engagement: 0,
        awareness: 0,
        app_installs: 0
      };

      if (!actions || !Array.isArray(actions) || actions.length === 0) {
        return metrics;
      }

      if (!objective) {
        // No objective defined - default to sales
        objective = 'OUTCOME_SALES';
      }

      const upperObjective = objective.toUpperCase();

      // Determine which single objective column to populate based on campaign objective
      if (upperObjective === 'OUTCOME_SALES' || upperObjective === 'CONVERSIONS') {
        // Sales - Use ONLY omni_ action types (do NOT sum all purchase types)

        // Purchase - ONLY omni_purchase
        const purchaseAction = actions.find((a: any) => a.action_type === 'omni_purchase');
        if (purchaseAction) {
          metrics.sales_purchase = parseInt(purchaseAction.value || '0');
        }

        // Initiate Checkout - use initiate_checkout
        const checkoutAction = actions.find((a: any) => a.action_type === 'initiate_checkout');
        if (checkoutAction) {
          metrics.sales_initiate_checkout = parseInt(checkoutAction.value || '0');
        }

        // Add to Cart - ONLY omni_add_to_cart
        const cartAction = actions.find((a: any) => a.action_type === 'omni_add_to_cart');
        if (cartAction) {
          metrics.sales_add_to_cart = parseInt(cartAction.value || '0');
        }

        // Sales = Sum of all 3 sales metrics
        metrics.sales = metrics.sales_purchase + metrics.sales_initiate_checkout + metrics.sales_add_to_cart;
      } else if (upperObjective === 'OUTCOME_LEADS' || upperObjective === 'LEAD_GENERATION') {
        // Leads - Priority: on_facebook_lead, lead, pixel lead, contact
        const leadsPriority = ['on_facebook_lead', 'lead', 'offsite_conversion.fb_pixel_lead', 'contact'];
        for (const actionType of leadsPriority) {
          const action = actions.find((a: any) => a.action_type === actionType);
          if (action && parseInt(action.value || '0') > 0) {
            metrics.leads = parseInt(action.value);
            break;
          }
        }
      } else if (upperObjective === 'OUTCOME_TRAFFIC' || upperObjective === 'LINK_CLICKS') {
        // Traffic - Priority: link clicks, outbound clicks, landing page views
        const trafficPriority = ['link_click', 'outbound_click', 'landing_page_view'];
        for (const actionType of trafficPriority) {
          const action = actions.find((a: any) => a.action_type === actionType);
          if (action && parseInt(action.value || '0') > 0) {
            metrics.traffic = parseInt(action.value);
            break;
          }
        }
      } else if (upperObjective === 'OUTCOME_ENGAGEMENT' || upperObjective === 'POST_ENGAGEMENT' || upperObjective === 'PAGE_LIKES') {
        // Engagement - Priority: post engagement, page engagement, video views, likes
        const engagementPriority = ['post_engagement', 'page_engagement', 'video_view', 'like'];
        for (const actionType of engagementPriority) {
          const action = actions.find((a: any) => a.action_type === actionType);
          if (action && parseInt(action.value || '0') > 0) {
            metrics.engagement = parseInt(action.value);
            break;
          }
        }
      } else if (upperObjective === 'BRAND_AWARENESS' || upperObjective === 'OUTCOME_AWARENESS' || upperObjective === 'REACH') {
        // Awareness - Priority: estimated ad recallers, reach
        const awarenessPriority = ['estimated_ad_recallers', 'reach'];
        for (const actionType of awarenessPriority) {
          const action = actions.find((a: any) => a.action_type === actionType);
          if (action && parseInt(action.value || '0') > 0) {
            metrics.awareness = parseInt(action.value);
            break;
          }
        }
      } else if (upperObjective === 'OUTCOME_APP_PROMOTION' || upperObjective === 'APP_INSTALLS' || upperObjective === 'MOBILE_APP_INSTALLS') {
        // App Installs - Priority: mobile app install, app install
        const appPriority = ['mobile_app_install', 'app_install'];
        for (const actionType of appPriority) {
          const action = actions.find((a: any) => a.action_type === actionType);
          if (action && parseInt(action.value || '0') > 0) {
            metrics.app_installs = parseInt(action.value);
            break;
          }
        }
      } else if (upperObjective === 'VIDEO_VIEWS') {
        // Video views maps to engagement
        const videoViewAction = actions.find((a: any) => a.action_type === 'video_view');
        if (videoViewAction) {
          metrics.engagement = parseInt(videoViewAction.value || '0');
        }
      } else if (upperObjective === 'MESSAGES') {
        // Messages maps to leads
        const messagesAction = actions.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
        if (messagesAction) {
          metrics.leads = parseInt(messagesAction.value || '0');
        }
      } else {
        // Unknown objective - default to sales
        const salesPriority = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'initiate_checkout', 'add_to_cart'];
        for (const actionType of salesPriority) {
          const action = actions.find((a: any) => a.action_type === actionType);
          if (action && parseInt(action.value || '0') > 0) {
            metrics.sales = parseInt(action.value);
            break;
          }
        }
      }

      return metrics;
    };

    const baseFields = [
      'adset_id',
      'adset_name',
      'campaign_id',
      'campaign_name',
      'impressions',
      'reach',
      'spend',
      'clicks',
      'cpc',
      'ctr',
      'cpm',
      'inline_link_clicks',
      'outbound_clicks',
      'conversions',
      'actions',
      'date_start',
      'date_stop'
    ].join(',');

    let nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=adset&fields=${baseFields}&${timeRangeParam}&time_increment=monthly&limit=25&access_token=${accessToken}`;

    console.log('=== FETCHING GENERAL MONTHLY INSIGHTS ===\n');
    console.log('Initial URL:', nextPageUrl.replace(accessToken, 'REDACTED'));

    const insightsToUpsert: any[] = [];
    let pageCount = 0;

    while (nextPageUrl) {
      try {
        pageCount++;
        console.log(`Fetching page ${pageCount}...`);

        const response = await fetchWithRetry(nextPageUrl);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          const errorMsg = `Failed to fetch insights (page ${pageCount}): ${errorData.error?.message || response.statusText}`;
          console.error(errorMsg);
          console.error('Full error:', errorText);
          errors.push(errorMsg);
          break;
        }

        const data = await response.json();
        const insights = data.data || [];

        console.log(`Page ${pageCount}: ${insights.length} records`);

        for (const insight of insights) {
          try {
            const monthYear = insight.date_start;
            const adsetId = insight.adset_id;

            const adsetData = adsetMap.get(adsetId);
            // Try to get campaign objective directly from insight.campaign_id first, fall back to adsetMap lookup
            let campaignData = null;
            if (insight.campaign_id) {
              campaignData = campaignMap.get(insight.campaign_id);
            }
            if (!campaignData && adsetData?.campaign_id) {
              campaignData = campaignMap.get(adsetData.campaign_id);
            }
            const campaignObjective = campaignData?.objective || null;

            const resultData = calculateResults(insight.actions, campaignObjective);
            const results = resultData.value;
            const resultType = resultData.type;

            // Calculate objective-specific metrics (only ONE objective will have a value)
            const objectiveMetrics = calculateObjectiveMetrics(insight.actions, campaignObjective);

            const record = {
              account_id: accountId,
              campaign_id: insight.campaign_id || null,
              adset_id: adsetId,
              month_year: monthYear,
              adset_name: insight.adset_name || adsetData?.name || null,
              campaign_name: insight.campaign_name || null,
              account_name: accountData?.account_name || null,
              spend: parseFloat(insight.spend || '0'),
              impressions: parseInt(insight.impressions || '0'),
              clicks: parseInt(insight.clicks || '0'),
              reach: parseInt(insight.reach || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              ctr: parseFloat(insight.ctr || '0'),
              cpm: parseFloat(insight.cpm || '0'),
              conversions: parseInt(insight.conversions || '0'),
              results: results,
              result_type: resultType,
              sales: objectiveMetrics.sales,
              sales_purchase: objectiveMetrics.sales_purchase,
              sales_initiate_checkout: objectiveMetrics.sales_initiate_checkout,
              sales_add_to_cart: objectiveMetrics.sales_add_to_cart,
              leads: objectiveMetrics.leads,
              traffic: objectiveMetrics.traffic,
              engagement: objectiveMetrics.engagement,
              awareness: objectiveMetrics.awareness,
              app_installs: objectiveMetrics.app_installs,
              inline_link_clicks: parseInt(insight.inline_link_clicks || '0'),
              outbound_clicks: parseInt(insight.outbound_clicks || '0'),
              actions: insight.actions || null,
              client_number: adsetData?.client_number || null,
              marketing_reference: adsetData?.marketing_reference || null,
              updated_at: new Date().toISOString()
            };

            insightsToUpsert.push(record);
            totalAdSetsProcessed++;
          } catch (error: any) {
            console.error(`Error processing insight record:`, error.message);
            errors.push(`Record processing error: ${error.message}`);
          }
        }

        nextPageUrl = data.paging?.next || null;

        if (nextPageUrl) {
          console.log(`More pages available, continuing...\n`);
          await delay(200);
        } else {
          console.log(`No more pages. General insights complete.\n`);
        }
      } catch (pageError: any) {
        console.error(`Error processing page ${pageCount}:`, pageError.message);
        errors.push(`Page ${pageCount} error: ${pageError.message}`);
        break;
      }
    }

    if (insightsToUpsert.length > 0) {
      console.log(`\nUpserting ${insightsToUpsert.length} insights to database...`);
      const { error: bulkUpsertError } = await supabase
        .from('meta_monthly_insights')
        .upsert(insightsToUpsert, {
          onConflict: 'adset_id,month_year',
          ignoreDuplicates: false
        });

      if (bulkUpsertError) {
        console.error('Bulk upsert error:', bulkUpsertError.message);
        errors.push(`Bulk upsert error: ${bulkUpsertError.message}`);
      } else {
        totalInsightsUpserted = insightsToUpsert.length;
        console.log(`✓ Successfully upserted ${totalInsightsUpserted} insights\n`);
      }
    }

    console.log('\n=== FETCHING DEMOGRAPHIC BREAKDOWNS ===\n');

    nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=adset&fields=adset_id,adset_name,campaign_id,campaign_name,impressions,reach,spend,clicks,conversions,actions,date_start,date_stop&breakdowns=age,gender&${timeRangeParam}&time_increment=monthly&limit=25&access_token=${accessToken}`;

    const demographicsToUpsert: any[] = [];
    pageCount = 0;

    while (nextPageUrl) {
      try {
        pageCount++;
        console.log(`Fetching demographics page ${pageCount}...`);

        const response = await fetchWithRetry(nextPageUrl);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          const errorMsg = `Failed to fetch demographics (page ${pageCount}): ${errorData.error?.message || response.statusText}`;
          console.error(errorMsg);
          console.error('Full error:', errorText);
          errors.push(errorMsg);
          break;
        }

        const data = await response.json();
        const demographics = data.data || [];

        console.log(`Demographics page ${pageCount}: ${demographics.length} records`);

        for (const demo of demographics) {
          try {
            const monthYear = demo.date_start;
            const adsetId = demo.adset_id;
            const ageGroup = demo.age || 'unknown';
            const gender = demo.gender || 'unknown';

            const adsetData = adsetMap.get(adsetId);
            // Try to get campaign objective directly from demo.campaign_id first, fall back to adsetMap lookup
            let campaignData = null;
            if (demo.campaign_id) {
              campaignData = campaignMap.get(demo.campaign_id);
            }
            if (!campaignData && adsetData?.campaign_id) {
              campaignData = campaignMap.get(adsetData.campaign_id);
            }
            const campaignObjective = campaignData?.objective || null;

            const resultData = calculateResults(demo.actions, campaignObjective);
            const results = resultData.value;
            const resultType = resultData.type;

            // Calculate objective-specific metrics (only ONE objective will have a value)
            const objectiveMetrics = calculateObjectiveMetrics(demo.actions, campaignObjective);

            const record = {
              account_id: accountId,
              campaign_id: demo.campaign_id || null,
              adset_id: adsetId,
              adset_name: demo.adset_name || adsetData?.name || null,
              month_year: monthYear,
              age_group: ageGroup,
              gender: gender,
              country: null,
              spend: parseFloat(demo.spend || '0'),
              impressions: parseInt(demo.impressions || '0'),
              clicks: parseInt(demo.clicks || '0'),
              reach: parseInt(demo.reach || '0'),
              conversions: parseInt(demo.conversions || '0'),
              results: results,
              result_type: resultType,
              actions: demo.actions || null,
              sales: objectiveMetrics.sales,
              sales_purchase: objectiveMetrics.sales_purchase,
              sales_initiate_checkout: objectiveMetrics.sales_initiate_checkout,
              sales_add_to_cart: objectiveMetrics.sales_add_to_cart,
              leads: objectiveMetrics.leads,
              traffic: objectiveMetrics.traffic,
              engagement: objectiveMetrics.engagement,
              awareness: objectiveMetrics.awareness,
              app_installs: objectiveMetrics.app_installs,
              client_number: adsetData?.client_number || null,
              marketing_reference: adsetData?.marketing_reference || null,
              updated_at: new Date().toISOString()
            };

            demographicsToUpsert.push(record);
          } catch (error: any) {
            console.error(`Error processing demographic record:`, error.message);
            errors.push(`Demographic processing error: ${error.message}`);
          }
        }

        nextPageUrl = data.paging?.next || null;

        if (nextPageUrl) {
          console.log(`More demographics pages available, continuing...\n`);
          await delay(200);
        } else {
          console.log(`No more pages. Demographics complete.\n`);
        }
      } catch (pageError: any) {
        console.error(`Error processing demographics page ${pageCount}:`, pageError.message);
        errors.push(`Demographics page ${pageCount} error: ${pageError.message}`);
        break;
      }
    }

    if (demographicsToUpsert.length > 0) {
      console.log(`\nUpserting ${demographicsToUpsert.length} demographics to database...`);
      const { error: bulkUpsertError } = await supabase
        .from('meta_monthly_demographics')
        .upsert(demographicsToUpsert, {
          onConflict: 'adset_id,month_year,age_group,gender',
          ignoreDuplicates: false
        });

      if (bulkUpsertError) {
        console.error('Bulk demographics upsert error:', bulkUpsertError.message);
        errors.push(`Bulk demographics upsert error: ${bulkUpsertError.message}`);
      } else {
        totalDemographicsUpserted = demographicsToUpsert.length;
        console.log(`✓ Successfully upserted ${totalDemographicsUpserted} demographics\n`);
      }
    }

    console.log('\n=== FETCHING AD-LEVEL INSIGHTS FOR CREATIVES ===\n');

    // First, fetch all ads with their creatives
    let adsNextUrl: string | null = `https://graph.facebook.com/v21.0/${formattedAccountId}/ads?fields=id,name,adset_id,campaign_id,creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,effective_object_story_id}&status=[ACTIVE,PAUSED]&limit=100&access_token=${accessToken}`;
    const adsToUpsert: any[] = [];
    const creativesToUpsert: any[] = [];
    const creativeIds = new Set<string>();
    const encounteredAdsetIds = new Set<string>();
    const encounteredCampaignIds = new Set<string>();
    let adsPageCount = 0;

    while (adsNextUrl) {
      try {
        adsPageCount++;
        console.log(`Fetching ads page ${adsPageCount}...`);

        const response = await fetchWithRetry(adsNextUrl);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to fetch ads (page ${adsPageCount}):`, errorText);
          break;
        }

        const data = await response.json();
        const ads = data.data || [];

        console.log(`Ads page ${adsPageCount}: ${ads.length} ads`);

        for (const ad of ads) {
          const creative = ad.creative;
          const adsetData = adsetMap.get(ad.adset_id);

          // Track encountered adset and campaign IDs
          if (ad.adset_id) encounteredAdsetIds.add(ad.adset_id);
          if (ad.campaign_id) encounteredCampaignIds.add(ad.campaign_id);

          // Store ad with client_number and marketing_reference from adset
          adsToUpsert.push({
            account_id: accountId,
            ad_id: ad.id,
            name: ad.name,
            adset_id: ad.adset_id,
            campaign_id: ad.campaign_id,
            creative_id: creative?.id || null,
            status: ad.status,
            client_number: adsetData?.client_number || null,
            marketing_reference: adsetData?.marketing_reference || null,
            updated_at: new Date().toISOString()
          });

          // Store creative if present and not already added
          if (creative && creative.id && !creativeIds.has(creative.id)) {
            creativeIds.add(creative.id);

            let adFormat = 'unknown';
            let imageUrl = creative.image_url || '';
            let thumbnailUrl = creative.thumbnail_url || '';

            if (creative.object_story_spec) {
              const spec = creative.object_story_spec;
              if (spec.video_data) adFormat = 'video';
              else if (spec.link_data) adFormat = 'link';
              else if (spec.photo_data) adFormat = 'image';
            }

            creativesToUpsert.push({
              account_id: accountId,
              creative_id: creative.id,
              name: creative.name || creative.title || 'Untitled',
              title: creative.title || '',
              body: creative.body || '',
              image_url: imageUrl,
              thumbnail_url: thumbnailUrl,
              video_id: creative.video_id || null,
              ad_format: adFormat,
              updated_at: new Date().toISOString()
            });
          }
        }

        adsNextUrl = data.paging?.next || null;

        if (adsNextUrl) {
          await delay(200);
        }
      } catch (error: any) {
        console.error(`Error fetching ads page ${adsPageCount}:`, error.message);
        errors.push(`Ads page ${adsPageCount} error: ${error.message}`);
        break;
      }
    }

    // CRITICAL: Create stub records for missing campaigns and adsets BEFORE inserting ads
    if (adsToUpsert.length > 0) {
      console.log(`\nPre-processing dependencies for ${adsToUpsert.length} ads...`);

      // Step 1: Create stub campaigns for any missing campaign IDs
      const missingCampaignIds = [...encounteredCampaignIds].filter(id => !campaignMap.has(id));
      if (missingCampaignIds.length > 0) {
        console.log(`Creating ${missingCampaignIds.length} stub campaign records...`);
        try {
          const campaignStubs = missingCampaignIds.map(campaignId => ({
            campaign_id: campaignId,
            account_id: accountId,
            name: `Campaign ${campaignId} (Auto-created)`,
            status: 'UNKNOWN',
            updated_at: new Date().toISOString()
          }));

          const { error: campaignStubError } = await supabase
            .from('meta_campaigns')
            .upsert(campaignStubs, {
              onConflict: 'campaign_id',
              ignoreDuplicates: true
            });

          if (campaignStubError) {
            console.error('Campaign stub creation error:', campaignStubError.message);
            errors.push(`Campaign stub creation error: ${campaignStubError.message}`);
          } else {
            console.log(`✓ Created ${missingCampaignIds.length} campaign stubs`);
            // Update campaignMap to avoid re-creating
            missingCampaignIds.forEach(id => campaignMap.set(id, { campaign_id: id, name: `Campaign ${id} (Auto-created)`, objective: null }));
          }
        } catch (error: any) {
          console.error('Error creating campaign stubs:', error.message);
          errors.push(`Campaign stub error: ${error.message}`);
        }
      }

      // Step 2: Create stub adsets for any missing adset IDs
      const missingAdsetIds = [...encounteredAdsetIds].filter(id => !adsetMap.has(id));
      if (missingAdsetIds.length > 0) {
        console.log(`Creating ${missingAdsetIds.length} stub adset records...`);
        try {
          const adsetStubs = missingAdsetIds.map(adsetId => {
            // Find the ad that references this adset to get campaign_id
            const ad = adsToUpsert.find(a => a.adset_id === adsetId);
            return {
              adset_id: adsetId,
              campaign_id: ad?.campaign_id || null,
              account_id: accountId,
              name: `AdSet ${adsetId} (Auto-created)`,
              status: 'UNKNOWN',
              client_number: ad?.client_number || null,
              marketing_reference: ad?.marketing_reference || null,
              updated_at: new Date().toISOString()
            };
          });

          const { error: adsetStubError } = await supabase
            .from('meta_adsets')
            .upsert(adsetStubs, {
              onConflict: 'adset_id',
              ignoreDuplicates: true
            });

          if (adsetStubError) {
            console.error('AdSet stub creation error:', adsetStubError.message);
            errors.push(`AdSet stub creation error: ${adsetStubError.message}`);
            // If stub creation fails, we cannot safely insert ads - skip them
            console.error('⚠️ Skipping ad insertion due to stub creation failure');
            adsToUpsert.length = 0; // Clear the array to prevent insertion
          } else {
            console.log(`✓ Created ${missingAdsetIds.length} adset stubs`);
            // Update adsetMap to avoid re-creating
            missingAdsetIds.forEach(id => {
              const ad = adsToUpsert.find(a => a.adset_id === id);
              adsetMap.set(id, {
                adset_id: id,
                name: `AdSet ${id} (Auto-created)`,
                client_number: ad?.client_number || null,
                marketing_reference: ad?.marketing_reference || null,
                campaign_id: ad?.campaign_id || null
              });
            });
          }
        } catch (error: any) {
          console.error('Error creating adset stubs:', error.message);
          errors.push(`AdSet stub error: ${error.message}`);
          // If stub creation fails, skip ad insertion
          console.error('⚠️ Skipping ad insertion due to stub creation failure');
          adsToUpsert.length = 0;
        }
      }
    }

    // Now upsert ads (only if stub creation succeeded or wasn't needed)
    if (adsToUpsert.length > 0) {
      console.log(`\nUpserting ${adsToUpsert.length} ads...`);
      const { error: adsError } = await supabase
        .from('meta_ads')
        .upsert(adsToUpsert, {
          onConflict: 'ad_id',
          ignoreDuplicates: false
        });

      if (adsError) {
        console.error('Ads upsert error:', adsError.message);
        errors.push(`Ads upsert error: ${adsError.message}`);
      } else {
        console.log(`✓ Successfully upserted ${adsToUpsert.length} ads`);
      }
    }

    // Upsert creatives
    if (creativesToUpsert.length > 0) {
      console.log(`Upserting ${creativesToUpsert.length} creatives...`);
      const { error: creativesError } = await supabase
        .from('meta_ad_creatives')
        .upsert(creativesToUpsert, {
          onConflict: 'creative_id',
          ignoreDuplicates: false
        });

      if (creativesError) {
        console.error('Creatives upsert error:', creativesError.message);
        errors.push(`Creatives upsert error: ${creativesError.message}`);
      } else {
        console.log(`✓ Successfully upserted ${creativesToUpsert.length} creatives\n`);
      }
    }

    console.log('\n=== FETCHING PLATFORM BREAKDOWNS ===\n');

    let totalPlatformUpserted = 0;
    nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=adset&fields=adset_id,campaign_id,impressions,reach,spend,clicks,conversions,actions,ctr,cpc,cpm,date_start,date_stop&breakdowns=publisher_platform&${timeRangeParam}&time_increment=monthly&limit=25&access_token=${accessToken}`;

    const platformsToUpsert: any[] = [];
    pageCount = 0;

    while (nextPageUrl) {
      try {
        pageCount++;
        console.log(`Fetching platform page ${pageCount}...`);

        const response = await fetchWithRetry(nextPageUrl);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          const errorMsg = `Failed to fetch platform data (page ${pageCount}): ${errorData.error?.message || response.statusText}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          break;
        }

        const data = await response.json();
        const platforms = data.data || [];

        console.log(`Platform page ${pageCount}: ${platforms.length} records`);

        for (const platform of platforms) {
          try {
            const monthYear = platform.date_start;
            const adsetId = platform.adset_id;
            const publisherPlatform = platform.publisher_platform || 'unknown';

            const adsetData = adsetMap.get(adsetId);
            // Try to get campaign objective directly from platform.campaign_id first, fall back to adsetMap lookup
            let campaignData = null;
            if (platform.campaign_id) {
              campaignData = campaignMap.get(platform.campaign_id);
            }
            if (!campaignData && adsetData?.campaign_id) {
              campaignData = campaignMap.get(adsetData.campaign_id);
            }
            const campaignObjective = campaignData?.objective || null;

            const resultData = calculateResults(platform.actions, campaignObjective);
            const results = resultData.value;

            // Calculate objective-specific metrics (only ONE objective will have a value)
            const objectiveMetrics = calculateObjectiveMetrics(platform.actions, campaignObjective);

            const record = {
              account_id: accountId,
              campaign_id: platform.campaign_id || null,
              adset_id: adsetId,
              month_year: monthYear,
              publisher_platform: publisherPlatform,
              impressions: parseInt(platform.impressions || '0'),
              reach: parseInt(platform.reach || '0'),
              clicks: parseInt(platform.clicks || '0'),
              spend: parseFloat(platform.spend || '0'),
              results: results,
              sales: objectiveMetrics.sales,
              sales_purchase: objectiveMetrics.sales_purchase || 0,
              sales_initiate_checkout: objectiveMetrics.sales_initiate_checkout || 0,
              sales_add_to_cart: objectiveMetrics.sales_add_to_cart || 0,
              leads: objectiveMetrics.leads,
              traffic: objectiveMetrics.traffic,
              engagement: objectiveMetrics.engagement,
              awareness: objectiveMetrics.awareness,
              app_installs: objectiveMetrics.app_installs,
              ctr: parseFloat(platform.ctr || '0'),
              cpc: parseFloat(platform.cpc || '0'),
              cpm: parseFloat(platform.cpm || '0'),
              conversions: parseInt(platform.conversions || '0'),
              client_number: adsetData?.client_number || null,
              marketing_reference: adsetData?.marketing_reference || null,
              updated_at: new Date().toISOString()
            };

            platformsToUpsert.push(record);
          } catch (error: any) {
            console.error(`Error processing platform record:`, error.message);
            errors.push(`Platform processing error: ${error.message}`);
          }
        }

        nextPageUrl = data.paging?.next || null;

        if (nextPageUrl) {
          console.log(`More platform pages available, continuing...\n`);
          await delay(200);
        } else {
          console.log(`No more pages. Platform sync complete.\n`);
        }
      } catch (pageError: any) {
        console.error(`Error processing platform page ${pageCount}:`, pageError.message);
        errors.push(`Platform page error: ${pageError.message}`);
        break;
      }
    }

    if (platformsToUpsert.length > 0) {
      console.log(`Upserting ${platformsToUpsert.length} platform records...`);
      const { error: platformUpsertError } = await supabase
        .from('meta_platform_insights')
        .upsert(platformsToUpsert, {
          onConflict: 'account_id,campaign_id,adset_id,month_year,publisher_platform',
          ignoreDuplicates: false
        });

      if (platformUpsertError) {
        console.error('Platform upsert error:', platformUpsertError);
        errors.push(`Platform upsert error: ${platformUpsertError.message}`);
      } else {
        totalPlatformUpserted = platformsToUpsert.length;
        console.log(`✓ Successfully upserted ${totalPlatformUpserted} platform records\n`);
      }
    }

    console.log('\n=== FETCHING AD-LEVEL INSIGHTS FOR CREATIVES ===\n');

    let totalAdInsightsUpserted = 0;
    // Note: Using safe field list - removed 'conversions' as it can cause "Invalid parameter" errors in some API versions
    nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=ad&fields=ad_id,adset_id,campaign_id,impressions,reach,spend,clicks,ctr,cpc,cpm,actions,date_start,date_stop&${timeRangeParam}&time_increment=monthly&limit=100&access_token=${accessToken}`;

    const adInsightsToUpsert: any[] = [];
    pageCount = 0;

    // Get existing ads data from database for client_number and marketing_reference
    const { data: existingAds } = await supabase
      .from('meta_ads')
      .select('ad_id, client_number, marketing_reference')
      .eq('account_id', accountId);

    const adsMap = new Map((existingAds || []).map(a => [a.ad_id, a]));

    while (nextPageUrl) {
      try {
        pageCount++;
        console.log(`Fetching ad insights page ${pageCount}...`);

        const response = await fetchWithRetry(nextPageUrl);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          const errorMsg = `Failed to fetch ad insights (page ${pageCount}): ${errorData.error?.message || response.statusText}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          break;
        }

        const data = await response.json();
        const insights = data.data || [];

        console.log(`Ad insights page ${pageCount}: ${insights.length} records`);

        for (const insight of insights) {
          try {
            if (!insight.date_start) {
              console.log(`Skipping insight with no date_start`);
              continue;
            }

            const adData = adsMap.get(insight.ad_id);

            const record: any = {
              ad_id: insight.ad_id,
              adset_id: insight.adset_id,
              campaign_id: insight.campaign_id,
              account_id: accountId,
              date: insight.date_start,
              impressions: parseInt(insight.impressions || '0'),
              reach: parseInt(insight.reach || '0'),
              clicks: parseInt(insight.clicks || '0'),
              spend: parseFloat(insight.spend || '0'),
              ctr: parseFloat(insight.ctr || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              cpm: parseFloat(insight.cpm || '0'),
              conversions: parseInt(insight.conversions || '0'),
              client_number: adData?.client_number || null,
              marketing_reference: adData?.marketing_reference || null,
              updated_at: new Date().toISOString()
            };

            // Parse actions to get results using priority system
            // Get campaign objective for this ad
            const adsetData = adsetMap.get(insight.adset_id);
            let campaignData = null;
            if (insight.campaign_id) {
              campaignData = campaignMap.get(insight.campaign_id);
            }
            if (!campaignData && adsetData?.campaign_id) {
              campaignData = campaignMap.get(adsetData.campaign_id);
            }
            const campaignObjective = campaignData?.objective || null;

            const resultData = calculateResults(insight.actions, campaignObjective);
            record.results = resultData.value;
            record.result_type = resultData.type;

            // Calculate objective-specific metrics (only ONE objective will have a value)
            const objectiveMetrics = calculateObjectiveMetrics(insight.actions, campaignObjective);
            record.sales = objectiveMetrics.sales;
            record.sales_purchase = objectiveMetrics.sales_purchase;
            record.sales_initiate_checkout = objectiveMetrics.sales_initiate_checkout;
            record.sales_add_to_cart = objectiveMetrics.sales_add_to_cart;
            record.leads = objectiveMetrics.leads;
            record.traffic = objectiveMetrics.traffic;
            record.engagement = objectiveMetrics.engagement;
            record.awareness = objectiveMetrics.awareness;
            record.app_installs = objectiveMetrics.app_installs;

            adInsightsToUpsert.push(record);
          } catch (error: any) {
            console.error(`Error processing ad insight record:`, error.message);
            errors.push(`Ad insight processing error: ${error.message}`);
          }
        }

        nextPageUrl = data.paging?.next || null;

        if (nextPageUrl) {
          console.log(`More ad insight pages available, continuing...\n`);
          await delay(200);
        } else {
          console.log(`No more pages. Ad insights sync complete.\n`);
        }
      } catch (pageError: any) {
        console.error(`Error processing ad insights page ${pageCount}:`, pageError.message);
        errors.push(`Ad insights page error: ${pageError.message}`);
        break;
      }
    }

    if (adInsightsToUpsert.length > 0) {
      console.log(`Upserting ${adInsightsToUpsert.length} ad insight records...`);

      // First, ensure all referenced campaigns, adsets, and ads exist
      const uniqueCampaignIds = [...new Set(adInsightsToUpsert.map(r => r.campaign_id).filter(Boolean))];
      const uniqueAdsetIds = [...new Set(adInsightsToUpsert.map(r => r.adset_id).filter(Boolean))];
      const uniqueAdIds = [...new Set(adInsightsToUpsert.map(r => r.ad_id))];

      // Create stub campaigns first (only for missing ones)
      const missingCampaignStubs: any[] = [];
      for (const campaignId of uniqueCampaignIds) {
        if (!campaignMap.has(campaignId)) {
          const insightRecord = adInsightsToUpsert.find(r => r.campaign_id === campaignId);
          missingCampaignStubs.push({
            campaign_id: campaignId,
            account_id: accountId,
            name: `Campaign ${campaignId} (Historical)`,
            status: 'UNKNOWN',
            client_number: insightRecord?.client_number || null,
            marketing_reference: insightRecord?.marketing_reference || null,
            updated_at: new Date().toISOString()
          });
        }
      }

      if (missingCampaignStubs.length > 0) {
        console.log(`Creating ${missingCampaignStubs.length} stub records for missing campaigns...`);
        const { error: campaignStubError } = await supabase
          .from('meta_campaigns')
          .upsert(missingCampaignStubs, {
            onConflict: 'campaign_id',
            ignoreDuplicates: true
          });

        if (campaignStubError) {
          console.error(`Error creating campaign stubs:`, campaignStubError);
        } else {
          console.log(`✓ Created ${missingCampaignStubs.length} campaign stub records`);
        }
      }

      // Create stub adsets second (only for missing ones)
      const missingAdsetStubs: any[] = [];
      for (const adsetId of uniqueAdsetIds) {
        if (!adsetMap.has(adsetId)) {
          const insightRecord = adInsightsToUpsert.find(r => r.adset_id === adsetId);
          missingAdsetStubs.push({
            adset_id: adsetId,
            campaign_id: insightRecord?.campaign_id || null,
            account_id: accountId,
            name: `AdSet ${adsetId} (Historical)`,
            status: 'UNKNOWN',
            client_number: insightRecord?.client_number || null,
            marketing_reference: insightRecord?.marketing_reference || null,
            updated_at: new Date().toISOString()
          });
        }
      }

      if (missingAdsetStubs.length > 0) {
        console.log(`Creating ${missingAdsetStubs.length} stub records for missing adsets...`);
        const { error: adsetStubError } = await supabase
          .from('meta_adsets')
          .upsert(missingAdsetStubs, {
            onConflict: 'adset_id',
            ignoreDuplicates: true
          });

        if (adsetStubError) {
          console.error(`Error creating adset stubs:`, adsetStubError);
        } else {
          console.log(`✓ Created ${missingAdsetStubs.length} adset stub records`);
        }
      }

      // Create stub ads last (only for missing ones)
      const missingAdStubs: any[] = [];
      for (const adId of uniqueAdIds) {
        if (!adsMap.has(adId)) {
          const insightRecord = adInsightsToUpsert.find(r => r.ad_id === adId);
          missingAdStubs.push({
            ad_id: adId,
            adset_id: insightRecord?.adset_id || null,
            campaign_id: insightRecord?.campaign_id || null,
            account_id: accountId,
            name: `Ad ${adId} (Historical)`,
            status: 'UNKNOWN',
            client_number: insightRecord?.client_number || null,
            marketing_reference: insightRecord?.marketing_reference || null,
            updated_at: new Date().toISOString()
          });
        }
      }

      if (missingAdStubs.length > 0) {
        console.log(`Creating ${missingAdStubs.length} stub records for missing ads...`);
        const { error: stubError } = await supabase
          .from('meta_ads')
          .upsert(missingAdStubs, {
            onConflict: 'ad_id',
            ignoreDuplicates: true
          });

        if (stubError) {
          console.error(`Error creating ad stubs:`, stubError);
          errors.push(`Ad stub creation error: ${stubError.message}`);
        } else {
          console.log(`✓ Created ${missingAdStubs.length} ad stub records`);
        }
      }

      // Batch upsert in chunks to avoid conflicts
      const batchSize = 100;
      for (let i = 0; i < adInsightsToUpsert.length; i += batchSize) {
        const batch = adInsightsToUpsert.slice(i, i + batchSize);
        const { error: adInsightsUpsertError } = await supabase
          .from('meta_ad_insights')
          .upsert(batch, {
            onConflict: 'ad_id,date',
            ignoreDuplicates: false
          });

        if (adInsightsUpsertError) {
          console.error(`Ad insights batch upsert error (${i}-${i+batch.length}):`, adInsightsUpsertError);
          errors.push(`Ad insights upsert error: ${adInsightsUpsertError.message}`);
        } else {
          totalAdInsightsUpserted += batch.length;
          console.log(`✓ Upserted batch ${i}-${i+batch.length} (${batch.length} records)`);
        }
      }

      console.log(`✓ Successfully upserted ${totalAdInsightsUpserted} ad insight records total\n`);
    } else {
      console.log(`⚠ No ad insights to upsert\n`);
    }

    console.log(`\n========================================`);
    console.log(`MONTHLY SYNC COMPLETE`);
    console.log(`Ad Sets Processed: ${totalAdSetsProcessed}`);
    console.log(`Monthly Insights Upserted: ${totalInsightsUpserted}`);
    console.log(`Monthly Demographics Upserted: ${totalDemographicsUpserted}`);
    console.log(`Platform Insights Upserted: ${totalPlatformUpserted}`);
    console.log(`Ad Insights Upserted: ${totalAdInsightsUpserted}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`========================================\n`);

    const { data: campaigns } = await supabase
      .from('meta_campaigns')
      .select('campaign_id, name, objective, status')
      .eq('account_id', accountId);

    const { data: adSets } = await supabase
      .from('meta_adsets')
      .select('adset_id, name, status, campaign_id')
      .eq('account_id', accountId);

    const message = errors.length === 0
      ? `Successfully synced ${totalInsightsUpserted} monthly insights, ${totalDemographicsUpserted} demographic records, and ${totalPlatformUpserted} platform records for ${totalAdSetsProcessed} ad sets`
      : `Synced ${totalInsightsUpserted} insights, ${totalDemographicsUpserted} demographics, and ${totalPlatformUpserted} platform records with ${errors.length} errors`;

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message,
        campaigns: campaigns || [],
        adSets: adSets || [],
        totalInsightsSynced: totalInsightsUpserted,
        totalDemographicsSynced: totalDemographicsUpserted,
        totalPlatformSynced: totalPlatformUpserted,
        datePreset: customDateRange ? 'custom' : datePreset,
        errors: errors.length > 0 ? errors : [],
        hasMoreErrors: errors.length > 10
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error: any) {
    console.error('Error syncing monthly reports:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        stack: error.stack
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});