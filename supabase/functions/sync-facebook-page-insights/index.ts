import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InsightValue {
  value: number;
  end_time: string;
}

interface InsightData {
  name: string;
  period: string;
  values: InsightValue[];
  title?: string;
  description?: string;
  id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pageId, since, until } = await req.json();

    if (!pageId) {
      return new Response(
        JSON.stringify({ error: "pageId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token - MUST use system token for insights (page tokens don't have permissions)
    let accessToken: string | null = null;

    // Priority: meta_system_user_token (most reliable for insights)
    const { data: systemToken } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "meta_system_user_token")
      .maybeSingle();

    if (systemToken?.value) {
      accessToken = systemToken.value;
      console.log("Using meta_system_user_token");
    } else {
      // Fallback to facebook_access_token
      const { data: facebookToken } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "facebook_access_token")
        .maybeSingle();

      if (facebookToken?.value) {
        accessToken = facebookToken.value;
        console.log("Using facebook_access_token");
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "No system access token available",
          details: "Please configure meta_system_user_token in settings. Page tokens don't have insights permissions."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client_number and marketing_reference for this page
    const { data: pageData } = await supabase
      .from("facebook_accounts")
      .select("client_number, marketing_reference, page_id")
      .eq("page_id", pageId)
      .maybeSingle();

    const clientNumber = pageData?.client_number || null;
    const marketingReference = pageData?.marketing_reference || null;

    // Set date range - default to yesterday if not provided
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sinceDate = since || yesterday.toISOString().split('T')[0];
    const untilDate = until || yesterday.toISOString().split('T')[0];

    console.log(`Fetching insights for page ${pageId} from ${sinceDate} to ${untilDate}`);

    // === STEP 1: Fetch Page Fields (followers_count, fan_count) ===
    // These are direct page fields, not metrics
    const pageFieldsUrl = `https://graph.facebook.com/v24.0/${pageId}?fields=followers_count,fan_count&access_token=${accessToken}`;
    console.log(`Fetching page fields: ${pageFieldsUrl.replace(accessToken, 'REDACTED')}`);

    const pageFieldsResponse = await fetch(pageFieldsUrl);
    if (!pageFieldsResponse.ok) {
      const error = await pageFieldsResponse.json();
      console.error('❌ API ERROR - Page Fields:', JSON.stringify(error, null, 2));

      // Check for common errors
      if (error.error?.code === 190) {
        return new Response(
          JSON.stringify({
            error: '❌ ACCESS TOKEN INVALID OR EXPIRED',
            details: 'The Meta access token is not working. Please reconnect your Facebook account.',
            errorCode: error.error?.code,
            errorType: error.error?.type,
            fbError: error
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error: '❌ Failed to fetch page fields',
          details: error.error?.message || 'Unknown error',
          errorCode: error.error?.code,
          fbError: error
        }),
        { status: pageFieldsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pageFields = await pageFieldsResponse.json();
    console.log(`✅ Fetched page fields:`, pageFields);

    // === STEP 2: Fetch Daily Metrics ===
    // Using v24.0 valid daily metrics
    const dailyMetrics = [
      'page_impressions',                  // Total Impressions (day, week, days_28)
      'page_impressions_unique',           // Total Reach (day, week, days_28)
      'page_daily_follows_unique',         // New Followers (day)
      'page_daily_unfollows_unique',       // Unfollows (day)
      'page_impressions_organic_v2',       // Organic Reach (day, days_28)
      'page_impressions_paid',             // Paid Reach (day, days_28)
      'page_post_engagements',             // Engagement (day, days_28)
    ];

    // Fetch metrics individually to identify and skip invalid ones
    const insightsData: { data: InsightData[] } = { data: [] };
    const invalidMetrics: string[] = [];

    for (const metric of dailyMetrics) {
      const metricUrl = `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${metric}&period=day&since=${sinceDate}&until=${untilDate}&access_token=${accessToken}`;

      try {
        const metricResponse = await fetch(metricUrl);

        if (!metricResponse.ok) {
          const error = await metricResponse.json();

          // Check for auth errors - these should fail the entire request
          if (error.error?.code === 190) {
            return new Response(
              JSON.stringify({
                error: '❌ ACCESS TOKEN INVALID OR EXPIRED',
                details: 'The Meta access token is not working. Please reconnect your Facebook account.',
                errorCode: error.error?.code,
                errorType: error.error?.type,
                fbError: error
              }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // For invalid metric errors, log and skip
          if (error.error?.code === 100) {
            console.warn(`⚠️ Metric '${metric}' is invalid for this page - skipping. Error: ${error.error?.message}`);
            invalidMetrics.push(metric);
            continue;
          }

          // Other errors
          console.error(`❌ Error fetching metric '${metric}':`, error);
          continue;
        }

        const metricData = await metricResponse.json();
        if (metricData.data && metricData.data.length > 0) {
          insightsData.data.push(...metricData.data);
          console.log(`✅ Fetched metric: ${metric}`);
        }
      } catch (err) {
        console.error(`❌ Exception fetching metric '${metric}':`, err);
      }
    }

    console.log(`✅ Successfully fetched ${insightsData.data.length} metrics (${dailyMetrics.length - invalidMetrics.length}/${dailyMetrics.length} valid)`);
    if (invalidMetrics.length > 0) {
      console.log(`⚠️ Invalid metrics skipped: ${invalidMetrics.join(', ')}`);
    }

    // === STEP 3: Fetch Demographics (days_28 period) ===
    const demographicMetrics = [
      'page_impressions_by_age_gender_unique',  // Demographics (Age/Sex) - days_28
      'page_impressions_by_country_unique',     // Demographics (Country) - days_28
    ];

    const demographicMetricsParam = demographicMetrics.join(',');
    const demographicUrl = `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${demographicMetricsParam}&period=days_28&access_token=${accessToken}`;

    console.log(`Fetching demographic metrics: ${demographicUrl.replace(accessToken, 'REDACTED')}`);

    const demographicResponse = await fetch(demographicUrl);
    let demographicData: any = null;

    if (demographicResponse.ok) {
      demographicData = await demographicResponse.json();
      console.log(`✅ Fetched ${demographicData.data?.length || 0} demographic metrics`);
    } else {
      const error = await demographicResponse.json();
      console.error('⚠️ Demographic metrics error:', JSON.stringify(error, null, 2));

      if (error.error?.code === 190) {
        console.error('❌ ACCESS TOKEN INVALID OR EXPIRED for demographics');
      }
    }

    // Process and store insights data
    const metricsMap: { [date: string]: any } = {};

    // Process daily metrics
    if (insightsData.data) {
      for (const metric of insightsData.data) {
        for (const value of metric.values) {
          const date = value.end_time.split('T')[0];

          if (!metricsMap[date]) {
            metricsMap[date] = {
              page_id: pageId,
              account_id: pageId,
              client_number: clientNumber,
              marketing_reference: marketingReference,
              date: date,
              // Initialize with page field values (same for all dates in this fetch)
              page_fans: pageFields.fan_count || 0,  // Total Likes
            };
          }

          // Map the metric values - using v24.0 metric names
          switch (metric.name) {
            case 'page_impressions':
              metricsMap[date].page_impressions = value.value || 0;  // Total Impressions
              break;
            case 'page_impressions_unique':
              metricsMap[date].page_impressions_unique = value.value || 0;  // Total Reach
              break;
            case 'page_daily_follows_unique':
              metricsMap[date].page_fan_adds = value.value || 0;  // New Followers
              break;
            case 'page_daily_unfollows_unique':
              metricsMap[date].page_fan_removes = value.value || 0;  // Unfollows
              break;
            case 'page_impressions_organic_v2':
              metricsMap[date].page_impressions_organic = value.value || 0;  // Organic Reach
              break;
            case 'page_impressions_paid':
              metricsMap[date].page_impressions_paid = value.value || 0;  // Paid Reach
              break;
            case 'page_post_engagements':
              metricsMap[date].page_post_engagements = value.value || 0;  // Engagement
              break;
          }
        }
      }
    }

    // Calculate derived fields for each date
    for (const date in metricsMap) {
      const record = metricsMap[date];

      // Calculate net growth (new followers - unfollows)
      record.net_growth = (record.page_fan_adds || 0) - (record.page_fan_removes || 0);

      // Calculate engagement rate (engaged users / reach * 100)
      if (record.page_impressions_unique > 0) {
        record.engagement_rate = ((record.page_post_engagements || 0) / record.page_impressions_unique * 100).toFixed(2);
      } else {
        record.engagement_rate = 0;
      }
    }

    // Store daily insights
    const insightsRecords = Object.values(metricsMap);
    const timestamp = new Date().toISOString();

    if (insightsRecords.length > 0) {
      for (const record of insightsRecords) {
        const { error } = await supabase
          .from('facebook_page_insights')
          .upsert({
            ...record,
            updated_at: timestamp,
          }, {
            onConflict: 'page_id,date',
          });

        if (error) {
          console.error(`Error storing insight for ${record.date}:`, error);
        }
      }
      console.log(`Stored ${insightsRecords.length} insight records`);
    }

    // Process and store demographics
    let demographicsStored = false;
    if (demographicData?.data) {
      const demoDate = untilDate; // Use the latest date for demographics
      const demoRecord: any = {
        page_id: pageId,
        account_id: pageId,
        client_number: clientNumber,
        marketing_reference: marketingReference,
        date: demoDate,
        age_gender_breakdown: {},
        country_breakdown: {},
      };

      for (const metric of demographicData.data) {
        // Using v24.0 demographic metric names
        if (metric.name === 'page_impressions_by_age_gender_unique' && metric.values?.[0]?.value) {
          demoRecord.age_gender_breakdown = metric.values[0].value;
          console.log('✅ Stored age/gender demographics');
        }
        if (metric.name === 'page_impressions_by_country_unique' && metric.values?.[0]?.value) {
          demoRecord.country_breakdown = metric.values[0].value;
          console.log('✅ Stored country demographics');
        }
      }

      const { error } = await supabase
        .from('facebook_page_demographics')
        .upsert({
          ...demoRecord,
          updated_at: timestamp,
        }, {
          onConflict: 'page_id,date',
        });

      if (!error) {
        demographicsStored = true;
        console.log(`✅ Stored demographics for ${demoDate}`);
      } else {
        console.error('❌ Error storing demographics:', error);
      }
    }

    // Update the facebook_accounts table with aggregated totals
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch aggregated data for last 28 days
    const { data: last28Days } = await supabase
      .from('facebook_page_insights')
      .select('page_impressions_unique, page_impressions, page_post_engagements')
      .eq('page_id', pageId)
      .gte('date', twentyEightDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    // Fetch aggregated data for last 7 days (for net growth)
    const { data: last7Days } = await supabase
      .from('facebook_page_insights')
      .select('net_growth')
      .eq('page_id', pageId)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    let totalReach28d = 0;
    let totalImpressions28d = 0;
    let totalEngagement28d = 0;
    if (last28Days) {
      totalReach28d = last28Days.reduce((sum, record) => sum + (record.page_impressions_unique || 0), 0);
      totalImpressions28d = last28Days.reduce((sum, record) => sum + (record.page_impressions || 0), 0);
      totalEngagement28d = last28Days.reduce((sum, record) => sum + (record.page_post_engagements || 0), 0);
    }

    let netGrowth7d = 0;
    if (last7Days) {
      netGrowth7d = last7Days.reduce((sum, record) => sum + (record.net_growth || 0), 0);
    }

    // Calculate engagement rate
    const engagementRate = totalReach28d > 0 ? (totalEngagement28d / totalReach28d * 100).toFixed(2) : 0;

    // Update facebook_accounts with aggregated data and page fields
    await supabase
      .from('facebook_accounts')
      .update({
        total_page_likes: pageFields.fan_count || 0,  // Total Likes from page field
        total_reach_28d: totalReach28d,
        total_engagement_28d: totalEngagement28d,
        engagement_rate: engagementRate,
        net_growth_7d: netGrowth7d,
        updated_at: timestamp,
      })
      .eq('page_id', pageId);

    console.log(`✅ Updated facebook_accounts with aggregated data`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Successfully fetched insights for page ${pageId}`,
        insightsStored: insightsRecords.length,
        demographicsStored,
        invalidMetrics: invalidMetrics.length > 0 ? invalidMetrics : undefined,
        pageFields: {
          followers_count: pageFields.followers_count || 0,
          fan_count: pageFields.fan_count || 0,
        },
        summary: {
          totalReach28d,
          totalImpressions28d,
          totalEngagement28d,
          engagementRate,
          netGrowth7d,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ CRITICAL ERROR syncing Facebook page insights:", error);

    // Check if this is a network error or auth error
    let errorMessage = error.message || "Internal server error";
    let errorDetails = "An unexpected error occurred while fetching insights";

    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      errorDetails = "Network error - Unable to connect to Facebook API. Please check your internet connection.";
    } else if (errorMessage.includes('token') || errorMessage.includes('auth')) {
      errorDetails = "Authentication error - The access token may be invalid or expired.";
    }

    return new Response(
      JSON.stringify({
        error: `❌ ${errorMessage}`,
        details: errorDetails,
        debug: {
          message: error.message,
          stack: error.stack,
        }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});