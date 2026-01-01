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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_date', now)
      .order('scheduled_date', { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending emails to process', processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];

    for (const email of pendingEmails) {
      try {
        const emailFunctionUrl = `${supabaseUrl}/functions/v1/send-smtp-email`;

        const response = await fetch(emailFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            to: email.recipient_emails,
            subject: email.subject,
            body: email.body,
            html: false,
          }),
        });

        const result = await response.json();

        if (result.success) {
          await supabase
            .from('scheduled_emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', email.id);

          results.push({ id: email.id, status: 'sent' });
        } else {
          await supabase
            .from('scheduled_emails')
            .update({
              status: 'failed',
              error_message: result.error || 'Unknown error',
            })
            .eq('id', email.id);

          results.push({ id: email.id, status: 'failed', error: result.error });
        }
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);

        await supabase
          .from('scheduled_emails')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', email.id);

        results.push({ id: email.id, status: 'failed', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} emails`,
        processed: results.length,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error processing scheduled emails:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});