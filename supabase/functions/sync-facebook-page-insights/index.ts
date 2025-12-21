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

    // Get access token from system settings or from the page
    let accessToken: string | null = null;

    // First try to get from system settings
    const { data: systemToken } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "meta_system_user_token")
      .maybeSingle();

    if (systemToken?.value) {
      accessToken = systemToken.value;
    } else {
      const { data: oauthToken } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "meta_oauth_user_token")
        .maybeSingle();

      if (oauthToken?.value) {
        accessToken = oauthToken.value;
      }
    }

    if (!accessToken) {
      // Try to get from the page's stored access_token
      const { data: pageData } = await supabase
        .from("facebook_accounts")
        .select("access_token, client_number, marketing_reference")
        .eq("page_id", pageId)
        .maybeSingle();

      if (pageData?.access_token) {
        accessToken = pageData.access_token;
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "No access token available",
          details: "Please sync Facebook accounts first or configure access tokens"
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

    // Start with the most basic metrics that are guaranteed to work
    // Reference: https://developers.facebook.com/docs/graph-api/reference/v24.0/insights
    const dailyMetrics = [
      'page_impressions',           // Total Impressions
      'page_impressions_unique',    // Reach (unique users)
      'page_impressions_organic',   // Organic Impressions
      'page_impressions_paid',      // Paid Impressions
      'page_fan_adds',              // New page likes
      'page_fan_removes',           // Page unlikes
    ];

    const lifetimeMetrics = [
      'page_fans_gender_age',              // Demographics Age/Gender
      'page_fans_country',                 // Demographics Country
    ];

    // Fetch daily metrics
    const metricsParam = dailyMetrics.join(',');
    const insightsUrl = `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${metricsParam}&period=day&since=${sinceDate}&until=${untilDate}&access_token=${accessToken}`;

    console.log(`Fetching daily insights: ${insightsUrl.replace(accessToken, 'REDACTED')}`);

    const insightsResponse = await fetch(insightsUrl);

    if (!insightsResponse.ok) {
      const error = await insightsResponse.json();
      console.error('Insights API error:', JSON.stringify(error, null, 2));
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch insights',
          details: error.error?.message || 'Unknown error',
          fbError: error
        }),
        { status: insightsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const insightsData = await insightsResponse.json();
    console.log(`Fetched ${insightsData.data?.length || 0} daily metrics`);

    // Fetch lifetime metrics (demographics)
    const lifetimeMetricsParam = lifetimeMetrics.join(',');
    const lifetimeUrl = `https://graph.facebook.com/v24.0/${pageId}/insights?metric=${lifetimeMetricsParam}&period=lifetime&access_token=${accessToken}`;

    console.log(`Fetching lifetime metrics: ${lifetimeUrl.replace(accessToken, 'REDACTED')}`);

    const lifetimeResponse = await fetch(lifetimeUrl);
    let demographicData: any = null;

    if (lifetimeResponse.ok) {
      demographicData = await lifetimeResponse.json();
      console.log(`Fetched ${demographicData.data?.length || 0} lifetime metrics`);
    } else {
      const error = await lifetimeResponse.json();
      console.error('Lifetime metrics error:', JSON.stringify(error, null, 2));
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
            };
          }

          // Map the metric values
          switch (metric.name) {
            case 'page_impressions':
              metricsMap[date].page_impressions = value.value || 0;
              break;
            case 'page_impressions_unique':
              metricsMap[date].page_impressions_unique = value.value || 0;
              break;
            case 'page_impressions_organic':
              metricsMap[date].page_impressions_organic = value.value || 0;
              break;
            case 'page_impressions_paid':
              metricsMap[date].page_impressions_paid = value.value || 0;
              break;
            case 'page_fan_adds':
              metricsMap[date].page_fan_adds = value.value || 0;
              break;
            case 'page_fan_removes':
              metricsMap[date].page_fan_removes = value.value || 0;
              break;
          }
        }
      }
    }

    // Calculate net growth for each date
    for (const date in metricsMap) {
      const adds = metricsMap[date].page_fan_adds || 0;
      const removes = metricsMap[date].page_fan_removes || 0;
      metricsMap[date].net_growth = adds - removes;
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
        if (metric.name === 'page_fans_gender_age' && metric.values?.[0]?.value) {
          demoRecord.age_gender_breakdown = metric.values[0].value;
        }
        if (metric.name === 'page_fans_country' && metric.values?.[0]?.value) {
          demoRecord.country_breakdown = metric.values[0].value;
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
        console.log(`Stored demographics for ${demoDate}`);
      } else {
        console.error('Error storing demographics:', error);
      }
    }

    // Update the facebook_accounts table with aggregated totals
    // Calculate 7-day net growth and 28-day reach/engagement
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

    // Fetch aggregated data
    const { data: last7Days } = await supabase
      .from('facebook_page_insights')
      .select('net_growth')
      .eq('page_id', pageId)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    const { data: last28Days } = await supabase
      .from('facebook_page_insights')
      .select('page_impressions_unique, page_impressions')
      .eq('page_id', pageId)
      .gte('date', twentyEightDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    let netGrowth7d = 0;
    if (last7Days) {
      netGrowth7d = last7Days.reduce((sum, record) => sum + (record.net_growth || 0), 0);
    }

    let totalReach28d = 0;
    let totalImpressions28d = 0;
    if (last28Days) {
      totalReach28d = last28Days.reduce((sum, record) => sum + (record.page_impressions_unique || 0), 0);
      totalImpressions28d = last28Days.reduce((sum, record) => sum + (record.page_impressions || 0), 0);
    }

    // Update facebook_accounts with aggregated data
    await supabase
      .from('facebook_accounts')
      .update({
        net_growth_7d: netGrowth7d,
        total_reach_28d: totalReach28d,
        updated_at: timestamp,
      })
      .eq('page_id', pageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fetched insights for page ${pageId}`,
        insightsStored: insightsRecords.length,
        demographicsStored,
        summary: {
          netGrowth7d,
          totalReach28d,
          totalImpressions28d,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing Facebook page insights:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
