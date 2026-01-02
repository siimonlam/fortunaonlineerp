import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailPayload {
  to: string[];
  subject: string;
  body: string;
  html?: boolean;
  smtpSettings?: {
    smtp_host: string;
    smtp_port: string;
    smtp_secure: string;
    smtp_user: string;
    smtp_password: string;
    smtp_from_email: string;
    smtp_from_name: string;
  };
  attachments?: Array<{
    filename: string;
    content: string;
    encoding?: string;
    contentType?: string;
  }>;
}

async function getSmtpSettings(supabase: any) {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name']);

  if (error) throw new Error(`Failed to fetch SMTP settings: ${error.message}`);

  const settings: Record<string, string> = {};
  data?.forEach((row: { key: string; value: string }) => {
    settings[row.key] = row.value;
  });

  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password || !settings.smtp_from_email) {
    throw new Error('SMTP settings not configured. Please configure SMTP settings in the admin panel.');
  }

  return settings;
}

async function sendEmail(settings: Record<string, string>, payload: EmailPayload) {
  const port = parseInt(settings.smtp_port || '587');

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: port,
      secure: settings.smtp_secure === 'true' && port === 465,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      },
    });

    const emailMessage: any = {
      from: `${settings.smtp_from_name} <${settings.smtp_from_email}>`,
      to: payload.to.join(', '),
      subject: payload.subject,
    };

    if (payload.html) {
      emailMessage.html = payload.body;
    } else {
      emailMessage.text = payload.body;
    }

    if (payload.attachments && payload.attachments.length > 0) {
      emailMessage.attachments = payload.attachments;
    }

    await transporter.sendMail(emailMessage);

    return { success: true };
  } catch (error) {
    console.error('SMTP Error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: EmailPayload = await req.json();

    if (!payload.to || payload.to.length === 0) {
      throw new Error('Recipient email addresses are required');
    }
    if (!payload.subject) {
      throw new Error('Email subject is required');
    }
    if (!payload.body) {
      throw new Error('Email body is required');
    }

    const settings = payload.smtpSettings
      ? {
          smtp_host: payload.smtpSettings.smtp_host,
          smtp_port: payload.smtpSettings.smtp_port,
          smtp_secure: payload.smtpSettings.smtp_secure,
          smtp_user: payload.smtpSettings.smtp_user,
          smtp_password: payload.smtpSettings.smtp_password,
          smtp_from_email: payload.smtpSettings.smtp_from_email,
          smtp_from_name: payload.smtpSettings.smtp_from_name,
        }
      : await getSmtpSettings(supabase);

    const result = await sendEmail(settings, payload);

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
