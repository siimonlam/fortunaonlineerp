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

    // Get system token
    const { data: tokenData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "meta_system_user_token")
      .maybeSingle();

    if (!tokenData?.value) {
      return new Response(
        JSON.stringify({ error: "No token found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = tokenData.value;

    // Get a test page ID
    const { data: pageData } = await supabase
      .from("facebook_accounts")
      .select("page_id, page_name")
      .limit(1)
      .maybeSingle();

    if (!pageData) {
      return new Response(
        JSON.stringify({ error: "No Facebook pages found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testResults: any = {
      pageId: pageData.page_id,
      pageName: pageData.page_name,
      tests: []
    };

    // TEST 1: Debug token to see permissions
    console.log("TEST 1: Checking token permissions");
    const debugUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${token}&access_token=${token}`;
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();

    testResults.tests.push({
      test: "Token Debug",
      status: debugResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
      response: debugData
    });

    // TEST 2: Get page basic info
    console.log("TEST 2: Fetching page basic info");
    const pageUrl = `https://graph.facebook.com/v24.0/${pageData.page_id}?fields=id,name,fan_count,followers_count&access_token=${token}`;
    const pageResponse = await fetch(pageUrl);
    const pageInfo = await pageResponse.json();

    testResults.tests.push({
      test: "Page Basic Info",
      status: pageResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
      response: pageInfo
    });

    // TEST 3: Try to get page insights
    console.log("TEST 3: Fetching page insights (page_impressions)");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sinceDate = yesterday.toISOString().split('T')[0];

    const insightUrl = `https://graph.facebook.com/v24.0/${pageData.page_id}/insights?metric=page_impressions&period=day&since=${sinceDate}&until=${sinceDate}&access_token=${token}`;
    const insightResponse = await fetch(insightUrl);
    const insightData = await insightResponse.json();

    testResults.tests.push({
      test: "Page Insights (page_impressions)",
      status: insightResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
      response: insightData
    });

    // TEST 4: Check if token can access the page
    console.log("TEST 4: Checking page access permissions");
    const accessUrl = `https://graph.facebook.com/v24.0/me/accounts?access_token=${token}`;
    const accessResponse = await fetch(accessUrl);
    const accessData = await accessResponse.json();

    testResults.tests.push({
      test: "Page Access (me/accounts)",
      status: accessResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
      response: accessData
    });

    // TEST 5: Check app scoped user ID
    console.log("TEST 5: Checking app scoped user");
    const meUrl = `https://graph.facebook.com/v24.0/me?access_token=${token}`;
    const meResponse = await fetch(meUrl);
    const meData = await meResponse.json();

    testResults.tests.push({
      test: "Token Owner (me)",
      status: meResponse.ok ? "✅ SUCCESS" : "❌ FAILED",
      response: meData
    });

    return new Response(
      JSON.stringify(testResults, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error testing token:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});