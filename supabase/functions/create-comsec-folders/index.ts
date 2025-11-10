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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { company_code, client_id } = await req.json();

    console.log('Creating folders for company:', company_code, 'client:', client_id);

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

    const placeholderContent = new Blob([''], { type: 'text/plain' });
    const errors = [];

    for (const folder of folders) {
      const folderPath = `${company_code}/${folder}/.keep`;
      console.log('Creating folder:', folderPath);
      
      const { data, error } = await supabase.storage
        .from('comsec-documents')
        .upload(folderPath, placeholderContent, {
          contentType: 'text/plain',
          upsert: true,
        });

      if (error) {
        console.error('Error creating folder', folderPath, ':', error);
        errors.push({ folder, error: error.message });
      } else {
        console.log('Successfully created folder:', folderPath);
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Some folders failed to create', 
          errors,
          company_code 
        }),
        {
          status: 207,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All folders created successfully', 
        company_code,
        folders_created: folders.length 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in create-comsec-folders function:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
