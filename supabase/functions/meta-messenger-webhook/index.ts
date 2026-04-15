import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERIFY_TOKEN = "meta_messenger_verify_token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();

      if (body.object !== "page") {
        return new Response("Not a page event", { status: 400, headers: corsHeaders });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      for (const entry of body.entry || []) {
        const pageId: string = entry.id;

        for (const event of entry.messaging || []) {
          if (!event.message) continue;

          const psid: string = event.sender.id;
          const mid: string = event.message.mid;
          const text: string = event.message.text || "";
          const attachments = event.message.attachments || null;
          const timestamp = new Date(event.timestamp).toISOString();

          const { data: existing } = await supabase
            .from("meta_messenger_messages")
            .select("id")
            .eq("mid", mid)
            .maybeSingle();

          if (existing) continue;

          await supabase.from("meta_messenger_messages").insert({
            page_id: pageId,
            psid,
            mid,
            direction: "inbound",
            text_body: text,
            attachments,
            status: "received",
            timestamp,
          });

          const { data: contact } = await supabase
            .from("meta_messenger_contacts")
            .select("id")
            .eq("page_id", pageId)
            .eq("psid", psid)
            .maybeSingle();

          if (contact) {
            await supabase
              .from("meta_messenger_contacts")
              .update({ last_message_at: timestamp })
              .eq("id", contact.id);
          } else {
            const { data: pageData } = await supabase
              .from("meta_messenger_pages")
              .select("access_token")
              .eq("page_id", pageId)
              .maybeSingle();

            let contactName = `User ${psid.slice(0, 8)}`;
            let profilePic: string | null = null;

            if (pageData?.access_token) {
              try {
                const profileRes = await fetch(
                  `https://graph.facebook.com/v18.0/${psid}?fields=name,profile_pic&access_token=${pageData.access_token}`
                );
                if (profileRes.ok) {
                  const profile = await profileRes.json();
                  contactName = profile.name || contactName;
                  profilePic = profile.profile_pic || null;
                }
              } catch {
              }
            }

            await supabase.from("meta_messenger_contacts").insert({
              page_id: pageId,
              psid,
              name: contactName,
              profile_pic: profilePic,
              last_message_at: timestamp,
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Webhook error:", err);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
