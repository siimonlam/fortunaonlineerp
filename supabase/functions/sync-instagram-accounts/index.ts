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

    console.log('Fetching pages from:', pagesEndpoint.replace(/access_token=[^&]*/, 'access_token=REDACTED'));
    const pagesResponse = await fetch(pagesEndpoint);

    if (!pagesResponse.ok) {
      const error = await pagesResponse.json();
      console.error('Failed to fetch pages:', error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Facebook pages", details: error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pagesData = await pagesResponse.json();
    const pages: FacebookPage[] = pagesData.data || [];
    console.log(`Found ${pages.length} Facebook page(s)`);

    if (pages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No Facebook pages found",
          details: "Make sure your Facebook account has Pages associated with it"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const syncedAccounts: InstagramAccount[] = [];
    const pagesWithoutInstagram: string[] = [];

    for (const page of pages) {
      try {
        console.log(`Checking page: ${page.name} (${page.id})`);
        const igAccountResponse = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${tokenToUse}`
        );

        if (!igAccountResponse.ok) {
          console.error(`Failed to fetch IG account for page ${page.name}`);
          continue;
        }

        const igAccountData = await igAccountResponse.json();
        const igBusinessAccount = igAccountData.instagram_business_account;

        if (!igBusinessAccount) {
          console.log(`No Instagram Business account linked to page: ${page.name}`);
          pagesWithoutInstagram.push(page.name);
          continue;
        }

        console.log(`Found Instagram Business account: ${igBusinessAccount.id}`);

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

    let message = `Synced ${syncedAccounts.length} Instagram account(s)`;
    if (pagesWithoutInstagram.length > 0) {
      message += `. ${pagesWithoutInstagram.length} Facebook page(s) without Instagram Business accounts: ${pagesWithoutInstagram.join(', ')}`;
    }

    console.log('Sync complete:', message);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        accounts: syncedAccounts,
        pagesWithoutInstagram,
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