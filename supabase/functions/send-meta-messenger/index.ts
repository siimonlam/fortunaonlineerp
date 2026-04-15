import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { page_id, psid, text } = await req.json();

    if (!page_id || !psid || !text) {
      return new Response(JSON.stringify({ error: "page_id, psid, and text are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: page, error: pageErr } = await supabase
      .from("meta_messenger_pages")
      .select("access_token, page_name")
      .eq("page_id", page_id)
      .eq("is_active", true)
      .maybeSingle();

    if (pageErr || !page) {
      return new Response(JSON.stringify({ error: "Page not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fbRes = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${page.access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          message: { text },
          messaging_type: "RESPONSE",
        }),
      }
    );

    const fbData = await fbRes.json();

    if (!fbRes.ok) {
      return new Response(JSON.stringify({ error: fbData.error?.message || "Facebook API error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mid = fbData.message_id || `out_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const authHeader = req.headers.get("Authorization");
    let sentBy: string | null = null;
    if (authHeader) {
      const userSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userSupabase.auth.getUser();
      sentBy = user?.id || null;
    }

    await supabase.from("meta_messenger_messages").insert({
      page_id,
      psid,
      mid,
      direction: "outbound",
      text_body: text,
      status: "sent",
      sent_by: sentBy,
      timestamp,
    });

    await supabase
      .from("meta_messenger_contacts")
      .update({ last_message_at: timestamp })
      .eq("page_id", page_id)
      .eq("psid", psid);

    return new Response(JSON.stringify({ success: true, message_id: mid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send messenger error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
