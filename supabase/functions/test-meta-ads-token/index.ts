import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accountId } = await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "accountId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokenData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "meta_ads_access_token")
      .maybeSingle();

    if (!tokenData?.value) {
      return new Response(
        JSON.stringify({ error: "No Meta Ads token found in system_settings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = tokenData.value;
    const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    const testResults: any = {
      accountId,
      formattedAccountId,
      tests: []
    };

    console.log("=== STARTING META ADS API DIAGNOSTIC ===");
    console.log(`Account ID: ${accountId}`);
    console.log(`Formatted Account ID: ${formattedAccountId}`);

    // TEST 1: Debug token to see permissions
    console.log("\nTEST 1: Checking token permissions");
    const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`;
    try {
      const debugResponse = await fetch(debugUrl);
      const debugData = await debugResponse.json();
      console.log("Debug response:", JSON.stringify(debugData, null, 2));

      testResults.tests.push({
        test: "Token Debug",
        status: debugResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
        response: debugData
      });
    } catch (err) {
      console.error("Test 1 error:", err);
      testResults.tests.push({
        test: "Token Debug",
        status: "❌ ERROR",
        error: err.message
      });
    }

    // TEST 2: Get account info
    console.log("\nTEST 2: Fetching account info");
    const accountUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}?fields=id,name,account_status,currency&access_token=${token}`;
    try {
      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json();
      console.log("Account response:", JSON.stringify(accountData, null, 2));

      testResults.tests.push({
        test: "Account Info",
        status: accountResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
        response: accountData
      });
    } catch (err) {
      console.error("Test 2 error:", err);
      testResults.tests.push({
        test: "Account Info",
        status: "❌ ERROR",
        error: err.message
      });
    }

    // TEST 3: Get campaigns
    console.log("\nTEST 3: Fetching campaigns");
    const campaignsUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/campaigns?fields=id,name,status,objective&limit=5&access_token=${token}`;
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      console.log("Campaigns response:", JSON.stringify(campaignsData, null, 2));

      testResults.tests.push({
        test: "Campaigns",
        status: campaignsResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
        response: campaignsData,
        count: campaignsData.data?.length || 0
      });

      // TEST 4: If we have campaigns, try to get ads from first campaign
      if (campaignsData.data && campaignsData.data.length > 0) {
        const firstCampaign = campaignsData.data[0];
        console.log(`\nTEST 4: Fetching ads from campaign "${firstCampaign.name}" (${firstCampaign.id})`);

        const adsUrl = `https://graph.facebook.com/v21.0/${firstCampaign.id}/ads?fields=id,name,adset_id,status&access_token=${token}`;
        try {
          const adsResponse = await fetch(adsUrl);
          const adsData = await adsResponse.json();
          console.log("Ads response:", JSON.stringify(adsData, null, 2));

          testResults.tests.push({
            test: `Ads from Campaign "${firstCampaign.name}"`,
            status: adsResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
            response: adsData,
            count: adsData.data?.length || 0
          });

          // TEST 5: If we have ads, try to get insights from first ad
          if (adsData.data && adsData.data.length > 0) {
            const firstAd = adsData.data[0];
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const until = new Date().toISOString().split('T')[0];

            console.log(`\nTEST 5: Fetching insights from ad "${firstAd.name}" (${firstAd.id})`);
            console.log(`Date range: ${since} to ${until}`);

            const insightsUrl = `https://graph.facebook.com/v21.0/${firstAd.id}/insights?fields=impressions,clicks,spend&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
            try {
              const insightsResponse = await fetch(insightsUrl);
              const insightsData = await insightsResponse.json();
              console.log("Insights response:", JSON.stringify(insightsData, null, 2));

              testResults.tests.push({
                test: `Insights from Ad "${firstAd.name}"`,
                status: insightsResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
                response: insightsData,
                count: insightsData.data?.length || 0
              });
            } catch (err) {
              console.error("Test 5 error:", err);
              testResults.tests.push({
                test: "Ad Insights",
                status: "❌ ERROR",
                error: err.message
              });
            }
          } else {
            testResults.tests.push({
              test: "Ad Insights",
              status: "⚠️ SKIPPED",
              reason: "No ads found in campaign"
            });
          }
        } catch (err) {
          console.error("Test 4 error:", err);
          testResults.tests.push({
            test: "Campaign Ads",
            status: "❌ ERROR",
            error: err.message
          });
        }
      } else {
        testResults.tests.push({
          test: "Campaign Ads",
          status: "⚠️ SKIPPED",
          reason: "No campaigns found in account"
        });
      }
    } catch (err) {
      console.error("Test 3 error:", err);
      testResults.tests.push({
        test: "Campaigns",
        status: "❌ ERROR",
        error: err.message
      });
    }

    console.log("\n=== DIAGNOSTIC COMPLETE ===");

    return new Response(
      JSON.stringify(testResults, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error testing Meta Ads token:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
