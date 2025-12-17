import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FacebookPage {
  id: string;
  name: string;
  username?: string;
  access_token?: string;
  followers_count?: number;
  fan_count?: number;
  category?: string;
  verification_status?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accessToken, clientNumber } = await req.json();

    let tokenToUse = accessToken;

    if (accessToken) {
      await supabase
        .from("system_settings")
        .upsert({
          key: "meta_oauth_user_token",
          value: accessToken,
          description: "OAuth user access token for Facebook API"
        }, {
          onConflict: "key"
        });
      console.log('Saved OAuth user token to system settings');
    }

    if (!tokenToUse) {
      const { data: systemToken } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "meta_system_user_token")
        .maybeSingle();

      if (systemToken) {
        tokenToUse = systemToken.value;
      } else {
        const { data: oauthToken } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "meta_oauth_user_token")
          .maybeSingle();

        if (oauthToken) {
          tokenToUse = oauthToken.value;
        } else {
          return new Response(
            JSON.stringify({
              error: "No access token available",
              details: "Please connect your Facebook account via OAuth or configure a system token"
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const { data: pageIdsData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "facebook_page_ids")
      .maybeSingle();

    if (!pageIdsData || !pageIdsData.value) {
      return new Response(
        JSON.stringify({
          error: "Facebook Page IDs not configured",
          helpText: "Please configure Facebook Page IDs in Settings"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pageIds = pageIdsData.value.split(',').map((id: string) => id.trim()).filter((id: string) => id);

    if (pageIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No Facebook Page IDs found",
          helpText: "Please add Facebook Page IDs in Settings"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${pageIds.length} Facebook page(s)`);

    const syncedAccounts: FacebookPage[] = [];
    const failedAccounts: string[] = [];

    for (const pageId of pageIds) {
      try {
        console.log(`Fetching Facebook page: ${pageId}`);
        const pageResponse = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,username,access_token,followers_count,fan_count,category,verification_status&access_token=${tokenToUse}`
        );

        if (!pageResponse.ok) {
          const error = await pageResponse.json();
          console.error(`Failed to fetch page ${pageId}:`, JSON.stringify(error, null, 2));
          failedAccounts.push(`${pageId} (${error.error?.message || 'Unknown error'})`);
          continue;
        }

        const pageDetails = await pageResponse.json();

        const { data, error } = await supabase
          .from("facebook_accounts")
          .upsert({
            page_id: pageDetails.id,
            name: pageDetails.name || "",
            username: pageDetails.username || "",
            access_token: pageDetails.access_token || "",
            followers_count: pageDetails.followers_count || 0,
            fan_count: pageDetails.fan_count || 0,
            category: pageDetails.category || "",
            verification_status: pageDetails.verification_status || "",
            client_number: clientNumber || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "page_id",
          })
          .select()
          .single();

        if (!error && data) {
          syncedAccounts.push(data);
        } else if (error) {
          console.error(`Database error for page ${pageId}:`, error);
          failedAccounts.push(pageId);
        }
      } catch (error) {
        console.error(`Error processing page ${pageId}:`, error);
        failedAccounts.push(pageId);
      }
    }

    let message = `Synced ${syncedAccounts.length} Facebook page(s)`;
    if (failedAccounts.length > 0) {
      message += `. Failed to sync ${failedAccounts.length} page(s): ${failedAccounts.join(', ')}`;
    }

    console.log('Sync complete:', message);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        accounts: syncedAccounts,
        failedAccounts,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing Facebook accounts:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});