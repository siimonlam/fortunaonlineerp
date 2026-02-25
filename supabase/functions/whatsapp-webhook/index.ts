import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Handle webhook verification (GET request)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      // You should set this verify token in your Meta App settings
      const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "my_verify_token_12345";

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified");
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      } else {
        console.error("Webhook verification failed");
        return new Response("Forbidden", { status: 403 });
      }
    }

    // Handle incoming messages (POST request)
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Received webhook:", JSON.stringify(body, null, 2));

      // Process WhatsApp webhook payload
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === "messages") {
              const value = change.value;

              // Process incoming messages
              if (value.messages) {
                for (const message of value.messages) {
                  await processIncomingMessage(message, value, supabaseUrl, supabaseKey);
                }
              }

              // Process message status updates
              if (value.statuses) {
                for (const status of value.statuses) {
                  await updateMessageStatus(status, supabaseUrl, supabaseKey);
                }
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Webhook processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Method not allowed", { status: 405 });

  } catch (error) {
    console.error("Error in whatsapp-webhook function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function processIncomingMessage(message: any, value: any, supabaseUrl: string, supabaseKey: string) {
  try {
    const contact = value.contacts?.[0];
    const metadata = value.metadata;

    // Extract message details
    const messageType = message.type;
    let textBody = '';
    let mediaUrl = null;

    if (messageType === 'text') {
      textBody = message.text?.body || '';
    } else if (messageType === 'image') {
      mediaUrl = message.image?.id;
      textBody = message.image?.caption || '';
    } else if (messageType === 'video') {
      mediaUrl = message.video?.id;
      textBody = message.video?.caption || '';
    } else if (messageType === 'audio') {
      mediaUrl = message.audio?.id;
    } else if (messageType === 'document') {
      mediaUrl = message.document?.id;
      textBody = message.document?.caption || message.document?.filename || '';
    }

    // Find the phone number record
    const phoneNumberResponse = await fetch(
      `${supabaseUrl}/rest/v1/whatsapp_phone_numbers?phone_number_id=eq.${metadata.phone_number_id}&select=id`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const phoneNumbers = await phoneNumberResponse.json();
    const whatsappPhoneNumberId = phoneNumbers[0]?.id;

    // Store or update contact
    const contactPhone = message.from;
    const contactName = contact?.profile?.name;

    const contactUpsertResponse = await fetch(
      `${supabaseUrl}/rest/v1/whatsapp_contacts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          phone_number: contactPhone,
          profile_name: contactName,
          name: contactName,
          last_message_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        }),
      }
    );

    // Store the message
    const messageData = {
      whatsapp_phone_number_id: whatsappPhoneNumberId,
      contact_phone: contactPhone,
      message_id: message.id,
      direction: 'inbound',
      message_type: messageType,
      message_content: message,
      text_body: textBody,
      media_url: mediaUrl,
      status: 'delivered',
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    };

    const messageResponse = await fetch(
      `${supabaseUrl}/rest/v1/whatsapp_messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify(messageData),
      }
    );

    if (!messageResponse.ok) {
      console.error("Failed to store message:", await messageResponse.text());
    } else {
      console.log("Message stored successfully");
    }

  } catch (error) {
    console.error("Error processing incoming message:", error);
  }
}

async function updateMessageStatus(status: any, supabaseUrl: string, supabaseKey: string) {
  try {
    const messageId = status.id;
    const newStatus = status.status; // sent, delivered, read, failed

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/whatsapp_messages?message_id=eq.${messageId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      }
    );

    if (updateResponse.ok) {
      console.log(`Message ${messageId} status updated to ${newStatus}`);
    }

  } catch (error) {
    console.error("Error updating message status:", error);
  }
}