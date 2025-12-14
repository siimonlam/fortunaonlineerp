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

    if (!tokenToUse) {
      const { data: systemToken, error: tokenError } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "meta_system_user_token")
        .maybeSingle();

      if (tokenError || !systemToken) {
        return new Response(
          JSON.stringify({ error: "No access token provided and no system token configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      tokenToUse = systemToken.value;
      useSystemUser = true;
    }

    let pagesEndpoint = `https://graph.facebook.com/v21.0/me/accounts?access_token=${tokenToUse}`;

    if (useSystemUser) {
      const { data: systemUserId, error: userIdError } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "meta_system_user_id")
        .maybeSingle();

      if (userIdError || !systemUserId) {
        return new Response(
          JSON.stringify({ error: "System user ID not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      pagesEndpoint = `https://graph.facebook.com/v21.0/${systemUserId.value}/accounts?access_token=${tokenToUse}`;
    }

    const pagesResponse = await fetch(pagesEndpoint);

    if (!pagesResponse.ok) {
      const error = await pagesResponse.json();
      return new Response(
        JSON.stringify({ error: "Failed to fetch Facebook pages", details: error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pagesData = await pagesResponse.json();
    const pages: FacebookPage[] = pagesData.data || [];

    if (pages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No Facebook pages found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const syncedAccounts: InstagramAccount[] = [];

    for (const page of pages) {
      try {
        const igAccountResponse = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${tokenToUse}`
        );

        if (!igAccountResponse.ok) continue;

        const igAccountData = await igAccountResponse.json();
        const igBusinessAccount = igAccountData.instagram_business_account;

        if (!igBusinessAccount) continue;

        const igDetailsResponse = await fetch(
          `https://graph.facebook.com/v21.0/${igBusinessAccount.id}?fields=id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count&access_token=${tokenToUse}`
        );

        if (!igDetailsResponse.ok) continue;

        const igDetails = await igDetailsResponse.json();

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
            client_number: clientNumber || null,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: "account_id",
          })
          .select()
          .single();

        if (!error && data) {
          syncedAccounts.push(data);
        }
      } catch (error) {
        console.error(`Error processing page ${page.id}:`, error);
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncedAccounts.length} Instagram account(s)`,
        accounts: syncedAccounts,
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