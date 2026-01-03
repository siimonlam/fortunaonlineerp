import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  accountId: string;
  datePreset?: 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';
  customDateRange?: {
    since: string; // YYYY-MM-DD
    until: string; // YYYY-MM-DD
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

    let timeRange: string;
    if (customDateRange) {
      timeRange = JSON.stringify({ since: customDateRange.since, until: customDateRange.until });
    } else {
      timeRange = `{"date_preset":"${datePreset}"}`;
    }

    console.log(`\n========================================`);
    console.log(`Starting MONTHLY sync for account: ${formattedAccountId}`);
    console.log(`Date preset: ${datePreset}`);
    if (customDateRange) {
      console.log(`Custom range: ${customDateRange.since} to ${customDateRange.until}`);
    }
    console.log(`========================================\n`);

    let totalInsightsUpserted = 0;
    let totalDemographicsUpserted = 0;
    let totalAdSetsProcessed = 0;
    const errors: string[] = [];

    const baseFields = [
      'adset_id',
      'campaign_id',
      'impressions',
      'reach',
      'spend',
      'clicks',
      'cpc',
      'ctr',
      'cpm',
      'inline_link_clicks',
      'outbound_clicks',
      'video_views',
      'conversions',
      'actions',
      'date_start',
      'date_stop'
    ].join(',');

    let nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=adset&fields=${baseFields}&time_range=${timeRange}&time_increment=monthly&limit=25&access_token=${accessToken}`;

    console.log('=== FETCHING GENERAL MONTHLY INSIGHTS ===\n');

    let pageCount = 0;
    while (nextPageUrl) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      const response = await fetchWithRetry(nextPageUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errorMsg = `Failed to fetch insights (page ${pageCount}): ${errorData.error?.message || response.statusText}`;
        console.error(errorMsg);
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

          const { data: adsetData } = await supabase
            .from('meta_adsets')
            .select('client_number, marketing_reference')
            .eq('adset_id', adsetId)
            .maybeSingle();

          const record = {
            account_id: accountId,
            campaign_id: insight.campaign_id || null,
            adset_id: adsetId,
            month_year: monthYear,
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
            video_views: parseInt(insight.video_views || '0'),
            inline_link_clicks: parseInt(insight.inline_link_clicks || '0'),
            outbound_clicks: parseInt(insight.outbound_clicks || '0'),
            actions: insight.actions ? JSON.stringify(insight.actions) : null,
            client_number: adsetData?.client_number || null,
            marketing_reference: adsetData?.marketing_reference || null,
            updated_at: new Date().toISOString()
          };

          const { error: upsertError } = await supabase
            .from('meta_monthly_insights')
            .upsert(record, {
              onConflict: 'adset_id,month_year',
              ignoreDuplicates: false
            });

          if (upsertError) {
            console.error(`Error upserting insight for adset ${adsetId}:`, upsertError.message);
            errors.push(`Adset ${adsetId}: ${upsertError.message}`);
          } else {
            totalInsightsUpserted++;
            totalAdSetsProcessed++;
            console.log(`  ✓ Upserted: AdSet ${adsetId}, Month ${monthYear}, Spend: $${record.spend}, Impressions: ${record.impressions}`);
          }
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
    }

    console.log('\n=== FETCHING DEMOGRAPHIC BREAKDOWNS ===\n');

    nextPageUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=adset&fields=adset_id,campaign_id,impressions,reach,spend,clicks,conversions,date_start,date_stop&breakdowns=age,gender&time_range=${timeRange}&time_increment=monthly&limit=25&access_token=${accessToken}`;

    pageCount = 0;
    while (nextPageUrl) {
      pageCount++;
      console.log(`Fetching demographics page ${pageCount}...`);

      const response = await fetchWithRetry(nextPageUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errorMsg = `Failed to fetch demographics (page ${pageCount}): ${errorData.error?.message || response.statusText}`;
        console.error(errorMsg);
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

          const { data: adsetData } = await supabase
            .from('meta_adsets')
            .select('client_number, marketing_reference')
            .eq('adset_id', adsetId)
            .maybeSingle();

          let results = 0;
          if (demo.actions && Array.isArray(demo.actions)) {
            const resultAction = demo.actions.find((a: any) =>
              a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
              a.action_type === 'onsite_conversion.post_save' ||
              a.action_type === 'lead' ||
              a.action_type === 'omni_purchase'
            );
            if (resultAction) {
              results = parseInt(resultAction.value || '0');
            }
          }

          const record = {
            account_id: accountId,
            campaign_id: demo.campaign_id || null,
            adset_id: adsetId,
            month_year: monthYear,
            age_group: ageGroup,
            gender: gender,
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

          const { error: upsertError } = await supabase
            .from('meta_monthly_demographics')
            .upsert(record, {
              onConflict: 'adset_id,month_year,age_group,gender',
              ignoreDuplicates: false
            });

          if (upsertError) {
            console.error(`Error upserting demographic for adset ${adsetId}:`, upsertError.message);
            errors.push(`Adset ${adsetId} demographic: ${upsertError.message}`);
          } else {
            totalDemographicsUpserted++;
            console.log(`  ✓ Upserted: AdSet ${adsetId}, Month ${monthYear}, Age ${ageGroup}, Gender ${gender}, Spend: $${record.spend}`);
          }
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
    }

    console.log(`\n========================================`);
    console.log(`MONTHLY SYNC COMPLETE`);
    console.log(`Ad Sets Processed: ${totalAdSetsProcessed}`);
    console.log(`Monthly Insights Upserted: ${totalInsightsUpserted}`);
    console.log(`Monthly Demographics Upserted: ${totalDemographicsUpserted}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`========================================\n`);

    const message = errors.length === 0
      ? `Successfully synced ${totalInsightsUpserted} monthly insights and ${totalDemographicsUpserted} demographic records for ${totalAdSetsProcessed} ad sets`
      : `Synced ${totalInsightsUpserted} insights and ${totalDemographicsUpserted} demographics with ${errors.length} errors`;

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message,
        insightsUpserted: totalInsightsUpserted,
        demographicsUpserted: totalDemographicsUpserted,
        adSetsProcessed: totalAdSetsProcessed,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
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