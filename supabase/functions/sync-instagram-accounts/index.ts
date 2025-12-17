import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  website?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
  };
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
    let useSystemUser = false;

    if (accessToken) {
      await supabase
        .from("system_settings")
        .upsert({
          key: "meta_oauth_user_token",
          value: accessToken,
          description: "OAuth user access token for Instagram API"
        }, {
          onConflict: "key"
        });
      console.log('Saved OAuth user token to system settings');
    }

    if (!tokenToUse) {
      // Try system user token first
      const { data: systemToken } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "meta_system_user_token")
        .maybeSingle();

      if (systemToken) {
        tokenToUse = systemToken.value;
        useSystemUser = true;
      } else {
        // Fallback to OAuth user token
        const { data: oauthToken } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "meta_oauth_user_token")
          .maybeSingle();

        if (oauthToken) {
          tokenToUse = oauthToken.value;
          useSystemUser = false;
        } else {
          return new Response(
            JSON.stringify({
              error: "No access token available",
              details: "Please connect your Instagram account via OAuth or configure a system token"
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const { data: accountIdsData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "instagram_account_ids")
      .maybeSingle();

    if (!accountIdsData || !accountIdsData.value) {
      return new Response(
        JSON.stringify({
          error: "Instagram Account IDs not configured",
          helpText: "Please configure Instagram Account IDs in Settings"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountIds = accountIdsData.value.split(',').map((id: string) => id.trim()).filter((id: string) => id);

    if (accountIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No Instagram Account IDs found",
          helpText: "Please add Instagram Account IDs in Settings"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${accountIds.length} Instagram account(s)`);

    const syncedAccounts: InstagramAccount[] = [];
    const failedAccounts: string[] = [];

    for (const accountId of accountIds) {
      try {
        console.log(`Fetching Instagram account: ${accountId}`);
        const igDetailsResponse = await fetch(
          `https://graph.facebook.com/v21.0/${accountId}?fields=id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count&access_token=${tokenToUse}`
        );

        if (!igDetailsResponse.ok) {
          const error = await igDetailsResponse.json();
          console.error(`Failed to fetch account ${accountId}:`, JSON.stringify(error, null, 2));
          failedAccounts.push(`${accountId} (${error.error?.message || 'Unknown error'})`);
          continue;
        }

        const igDetails = await igDetailsResponse.json();

        // Check if this account is linked to a marketing project via junction table
        const { data: junctionData } = await supabase
          .from("marketing_instagram_accounts")
          .select("marketing_reference")
          .eq("account_id", igDetails.id)
          .maybeSingle();

        let inheritedClientNumber = clientNumber;
        let inheritedMarketingReference = null;

        if (junctionData?.marketing_reference) {
          // Get client_number from marketing_projects
          const { data: projectData } = await supabase
            .from("marketing_projects")
            .select("client_number, project_reference")
            .eq("project_reference", junctionData.marketing_reference)
            .maybeSingle();

          if (projectData) {
            inheritedClientNumber = projectData.client_number;
            inheritedMarketingReference = projectData.project_reference;
            console.log(`Account ${igDetails.id} inherits client_number: ${inheritedClientNumber}, marketing_reference: ${inheritedMarketingReference}`);
          }
        }

        const { data, error } = await supabase
          .from("instagram_accounts")
          .upsert({
            account_id: igDetails.id,
            username: igDetails.username,
            name: igDetails.name || "",
            biography: igDetails.biography || "",
            profile_picture_url: igDetails.profile_picture_url || "",
            website: igDetails.website || "",
            followers_count: igDetails.followers_count || 0,
            follows_count: igDetails.follows_count || 0,
            media_count: igDetails.media_count || 0,
            client_number: inheritedClientNumber || null,
            marketing_reference: inheritedMarketingReference || null,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: "account_id",
          })
          .select()
          .single();

        if (!error && data) {
          syncedAccounts.push(data);
        } else if (error) {
          console.error(`Database error for account ${accountId}:`, error);
          failedAccounts.push(accountId);
        }
      } catch (error) {
        console.error(`Error processing account ${accountId}:`, error);
        failedAccounts.push(accountId);
      }
    }

    let message = `Synced ${syncedAccounts.length} Instagram account(s)`;
    if (failedAccounts.length > 0) {
      message += `. Failed to sync ${failedAccounts.length} account(s): ${failedAccounts.join(', ')}`;
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
    console.error("Error syncing Instagram accounts:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});