import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { company_code, client_id } = await req.json();

    if (!company_code) {
      return new Response(
        JSON.stringify({ error: 'Company code is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const folders = [
      'Register of Directors',
      'Register of Members',
      'Register of Company Secretaries',
      'Register of Significant Controllers',
      'Certificates',
      'Forms (CR, IRD)',
      'Share Certificates',
      'Resolutions',
      'Others',
    ];

    const placeholderContent = new Uint8Array([]);

    for (const folder of folders) {
      const folderPath = `${company_code}/${folder}/.keep`;
      await supabase.storage
        .from('comsec-documents')
        .upload(folderPath, placeholderContent, {
          contentType: 'text/plain',
          upsert: false,
        });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Folders created successfully', company_code }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating folders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
