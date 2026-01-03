import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhatsAppRequest {
  phone: string;
  message: string;
  files?: {
    id: string;
    name: string;
    mimeType: string;
    size?: number;
  }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { phone, message, files }: WhatsAppRequest = await req.json();

    if (!phone) {
      throw new Error("Phone number is required");
    }

    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"])
      .limit(2);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch WhatsApp credentials");
    }

    const phoneNumberId = settings?.find(
      (s) => s.key === "whatsapp_phone_number_id"
    )?.value;
    const accessToken = settings?.find(
      (s) => s.key === "whatsapp_access_token"
    )?.value;

    if (!phoneNumberId || !accessToken) {
      throw new Error(
        "WhatsApp credentials not configured. Please configure in Admin → Settings"
      );
    }

    const cleanPhone = phone.replace(/[^\d]/g, "");

    if (files && files.length > 0) {
      const { data: oauth } = await supabase
        .from("google_oauth_tokens")
        .select("access_token, refresh_token, expires_at, email")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!oauth) {
        throw new Error("Google OAuth not configured");
      }

      let currentAccessToken = oauth.access_token;
      const now = new Date().getTime();
      const expiresAt = new Date(oauth.expires_at).getTime();

      if (now >= expiresAt - 300000) {
        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
              client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
              refresh_token: oauth.refresh_token,
              grant_type: "refresh_token",
            }),
          }
        );

        if (!tokenResponse.ok) {
          throw new Error("Failed to refresh Google access token");
        }

        const tokenData = await tokenResponse.json();
        currentAccessToken = tokenData.access_token;

        const newExpiresAt = new Date(
          now + tokenData.expires_in * 1000
        ).toISOString();

        await supabase
          .from("google_oauth_tokens")
          .update({
            access_token: currentAccessToken,
            expires_at: newExpiresAt,
          })
          .eq("email", oauth.email);
      }

      for (const file of files) {
        const fileResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${currentAccessToken}`,
            },
          }
        );

        if (!fileResponse.ok) {
          console.error(`Failed to download file ${file.name}`);
          continue;
        }

        const fileData = await fileResponse.blob();
        const mediaType = file.mimeType?.includes("image")
          ? "image"
          : file.mimeType?.includes("video")
          ? "video"
          : file.mimeType?.includes("audio")
          ? "audio"
          : "document";

        const formData = new FormData();
        formData.append(
          "file",
          fileData,
          file.name
        );
        formData.append("messaging_product", "whatsapp");

        const uploadResponse = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          console.error("WhatsApp media upload error:", errorData);
          throw new Error(
            `Failed to upload media: ${errorData.error?.message || "Unknown error"}`
          );
        }

        const uploadResult = await uploadResponse.json();
        const mediaId = uploadResult.id;

        const messagePayload: any = {
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: mediaType,
        };

        messagePayload[mediaType] = {
          id: mediaId,
        };

        if (message && files.indexOf(file) === 0) {
          messagePayload[mediaType].caption = message;
        }

        const sendResponse = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(messagePayload),
          }
        );

        if (!sendResponse.ok) {
          const errorData = await sendResponse.json();
          console.error("WhatsApp send error:", errorData);
          throw new Error(
            `Failed to send WhatsApp message: ${errorData.error?.message || "Unknown error"}`
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Files sent successfully via WhatsApp",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (message) {
      const messagePayload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: {
          body: message,
        },
      };

      const sendResponse = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        }
      );

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        console.error("WhatsApp send error:", errorData);
        throw new Error(
          `Failed to send WhatsApp message: ${errorData.error?.message || "Unknown error"}`
        );
      }

      const result = await sendResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          message: "WhatsApp message sent successfully",
          result,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      throw new Error("Either message or files must be provided");
    }
  } catch (error: any) {
    console.error("Error in send-whatsapp function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to send WhatsApp message",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
