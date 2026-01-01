import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  const secure = settings.smtp_secure === 'true';

  const auth = btoa(`${settings.smtp_user}:${settings.smtp_password}`);

  const emailContent = payload.html
    ? `Content-Type: text/html; charset=utf-8\r\n\r\n${payload.body}`
    : `Content-Type: text/plain; charset=utf-8\r\n\r\n${payload.body}`;

  const message = [
    `From: ${settings.smtp_from_name} <${settings.smtp_from_email}>`,
    `To: ${payload.to.join(', ')}`,
    `Subject: ${payload.subject}`,
    emailContent
  ].join('\r\n');

  try {
    const conn = await Deno.connect({
      hostname: settings.smtp_host,
      port: port,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    if (secure && port === 465) {
      const tlsConn = await Deno.startTls(conn, { hostname: settings.smtp_host });
      await sendSmtpCommands(tlsConn, encoder, decoder, settings, message, auth);
    } else {
      await sendSmtpCommands(conn, encoder, decoder, settings, message, auth, port === 587);
    }

    return { success: true };
  } catch (error) {
    console.error('SMTP Error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

async function sendSmtpCommands(
  conn: any,
  encoder: TextEncoder,
  decoder: TextDecoder,
  settings: Record<string, string>,
  message: string,
  auth: string,
  startTls = false
) {
  const readResponse = async () => {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    return decoder.decode(buffer.subarray(0, n));
  };

  const sendCommand = async (command: string) => {
    await conn.write(encoder.encode(command + '\r\n'));
    return await readResponse();
  };

  await readResponse();

  await sendCommand(`EHLO ${settings.smtp_host}`);

  if (startTls) {
    await sendCommand('STARTTLS');
    const tlsConn = await Deno.startTls(conn, { hostname: settings.smtp_host });
    await sendSmtpCommands(tlsConn, encoder, decoder, settings, message, auth, false);
    return;
  }

  await sendCommand('AUTH LOGIN');
  await sendCommand(btoa(settings.smtp_user));
  await sendCommand(btoa(settings.smtp_password));
  await sendCommand(`MAIL FROM:<${settings.smtp_from_email}>`);

  const recipients = message.match(/To: (.+)/)?.[1].split(', ') || [];
  for (const recipient of recipients) {
    const email = recipient.match(/<(.+)>|(.+)/)?.[1] || recipient.trim();
    await sendCommand(`RCPT TO:<${email}>`);
  }

  await sendCommand('DATA');
  await conn.write(encoder.encode(message + '\r\n.\r\n'));
  await readResponse();
  await sendCommand('QUIT');

  conn.close();
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

    const settings = await getSmtpSettings(supabase);
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