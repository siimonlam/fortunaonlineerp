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

    const { accountId, datePreset = 'last_month', customDateRange }: SyncRequest = await req.json();

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

    // Helper function to get result action type based on campaign objective
    const getResultActionTypes = (objective: string | null): string[] => {
      if (!objective) return [];

      // Map campaign objectives to their primary result action types
      switch (objective.toUpperCase()) {
        case 'OUTCOME_TRAFFIC':
        case 'LINK_CLICKS':
          return [
            'link_click',
            'landing_page_view',
            'omni_landing_page_view',
            'outbound_click',
            'offsite_conversion.fb_pixel_view_content',
            'onsite_conversion.flow_complete',
            'onsite_web_view_content',
            'view_content'
          ];

        case 'OUTCOME_ENGAGEMENT':
        case 'POST_ENGAGEMENT':
        case 'PAGE_LIKES':
          return ['post_engagement', 'page_engagement', 'like', 'onsite_conversion.post_net_like', 'onsite_conversion.post_save', 'video_view', 'post_reaction', 'comment', 'post'];

        case 'OUTCOME_LEADS':
        case 'LEAD_GENERATION':
          return [
            'lead',
            'onsite_conversion.lead_grouped',
            'offsite_conversion.fb_pixel_lead',
            'onsite_conversion.messaging_conversation_started_7d',
            'leadgen_grouped'
          ];

        case 'OUTCOME_SALES':
        case 'CONVERSIONS':
          return [
            // Purchase actions (including omni cross-channel)
            'purchase',
            'omni_purchase',
            'web_in_store_purchase',
            'offsite_conversion.fb_pixel_purchase',
            'onsite_conversion.purchase',
            'offsite_conversion.custom',
            // Cart actions (including omni)
            'add_to_cart',
            'omni_add_to_cart',
            'offsite_conversion.fb_pixel_add_to_cart',
            'onsite_conversion.add_to_cart',
            'onsite_web_add_to_cart',
            'onsite_web_app_add_to_cart',
            // Checkout actions (including omni)
            'initiate_checkout',
            'omni_initiated_checkout',
            'offsite_conversion.fb_pixel_initiate_checkout',
            // Other conversion actions
            'offsite_conversion.fb_pixel_complete_registration',
            'offsite_conversion.fb_pixel_add_payment_info',
            'offsite_conversion.fb_pixel_view_content',
            'onsite_conversion.post_save',
            'view_content',
            'onsite_web_view_content'
          ];

        case 'OUTCOME_APP_PROMOTION':
        case 'APP_INSTALLS':
        case 'MOBILE_APP_INSTALLS':
          return ['app_install', 'mobile_app_install'];

        case 'VIDEO_VIEWS':
          return ['video_view', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p100_watched_actions'];

        case 'BRAND_AWARENESS':
        case 'OUTCOME_AWARENESS':
        case 'REACH':
          return ['reach', 'frequency', 'estimated_ad_recallers'];

        case 'MESSAGES':
          return ['onsite_conversion.messaging_conversation_started_7d'];

        default:
          // Fallback to conversion types if objective is unknown
          return ['purchase', 'lead', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.post_save', 'omni_purchase'];
      }
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

            let results = 0;
            let resultType: string[] = [];
            if (insight.actions && Array.isArray(insight.actions)) {
              const validActionTypes = getResultActionTypes(campaignObjective);

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
              result_type: resultType.length > 0 ? resultType.join(', ') : null,
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

    nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=adset&fields=adset_id,campaign_id,impressions,reach,spend,clicks,conversions,actions,date_start,date_stop&breakdowns=age,gender&${timeRangeParam}&time_increment=monthly&limit=25&access_token=${accessToken}`;

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

            let results = 0;
            if (demo.actions && Array.isArray(demo.actions)) {
              const validActionTypes = getResultActionTypes(campaignObjective);

              // Sum ALL matching action types from the valid list
              for (const actionType of validActionTypes) {
                const resultActions = demo.actions.filter((a: any) => a.action_type === actionType);
                for (const resultAction of resultActions) {
                  const value = parseInt(resultAction.value || '0');
                  if (value > 0) {
                    results += value;
                  }
                }
              }
            }

            const record = {
              account_id: accountId,
              campaign_id: demo.campaign_id || null,
              adset_id: adsetId,
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

          // Store ad
          adsToUpsert.push({
            account_id: accountId,
            ad_id: ad.id,
            name: ad.name,
            adset_id: ad.adset_id,
            campaign_id: ad.campaign_id,
            creative_id: creative?.id || null,
            status: ad.status,
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

    // Upsert ads
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

            let results = 0;
            if (platform.actions && Array.isArray(platform.actions)) {
              const validActionTypes = getResultActionTypes(campaignObjective);

              // Sum ALL matching action types from the valid list
              for (const actionType of validActionTypes) {
                const resultActions = platform.actions.filter((a: any) => a.action_type === actionType);
                for (const resultAction of resultActions) {
                  const value = parseInt(resultAction.value || '0');
                  if (value > 0) {
                    results += value;
                  }
                }
              }
            }

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
    nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=ad&fields=ad_id,adset_id,campaign_id,impressions,reach,spend,clicks,conversions,actions,ctr,cpc,cpm,date_start,date_stop&${timeRangeParam}&time_increment=monthly&limit=100&access_token=${accessToken}`;

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

            // Parse actions to get results
            if (insight.actions && Array.isArray(insight.actions)) {
              let results = 0;
              let resultType = '';

              const preferredActions = [
                'onsite_conversion.post_save',
                'omni_purchase',
                'purchase',
                'lead',
                'complete_registration',
                'add_to_cart',
                'initiate_checkout',
                'link_click',
                'landing_page_view',
                'post_engagement',
                'page_engagement'
              ];

              for (const actionType of preferredActions) {
                const action = insight.actions.find((a: any) => a.action_type === actionType);
                if (action) {
                  results = parseInt(action.value || '0');
                  resultType = actionType;
                  break;
                }
              }

              record.results = results;
              record.result_type = resultType;
            }

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