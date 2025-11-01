import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StatusChangePayload {
  project_id: string;
  project_title: string;
  old_status: string;
  new_status: string;
  changed_by_email: string;
  recipient_emails: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: StatusChangePayload = await req.json();

    console.log("Status change notification:", {
      project: payload.project_title,
      from: payload.old_status,
      to: payload.new_status,
      recipients: payload.recipient_emails,
    });

    const emailContent = `
Project Status Update

Project: ${payload.project_title}
Status Changed: ${payload.old_status} → ${payload.new_status}
Changed By: ${payload.changed_by_email}

This is an automated notification from your project management system.
    `;

    console.log("Email would be sent to:", payload.recipient_emails);
    console.log("Email content:", emailContent);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email notification logged (email service not configured)",
        recipients: payload.recipient_emails,
        preview: emailContent,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error processing email notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
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