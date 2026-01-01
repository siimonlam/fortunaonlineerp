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
    const IMAGES_FOLDER_ID = '1CM-8g8qOIlhrRqvR81dABNiDxikPeF7d';

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || file.name;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { data: tokenData, error: tokenError } = await fetch(
      `${supabaseUrl}/rest/v1/google_oauth_tokens?select=access_token,refresh_token,expires_at&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      }
    ).then(r => r.json());

    if (tokenError || !tokenData || tokenData.length === 0) {
      throw new Error('No Google OAuth token found');
    }

    let accessToken = tokenData[0].access_token;
    const expiresAt = new Date(tokenData[0].expires_at);

    if (expiresAt <= new Date()) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: tokenData[0].refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      await fetch(
        `${supabaseUrl}/rest/v1/google_oauth_tokens?id=eq.${tokenData[0].id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: refreshData.access_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          }),
        }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      parents: [IMAGES_FOLDER_ID],
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${file.type}\r\n\r\n` +
      new TextDecoder().decode(fileBuffer) +
      closeDelimiter;

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${errorText}`);
    }

    const uploadedFile = await uploadResponse.json();

    await fetch(
      `https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );

    const directLink = `https://drive.google.com/uc?export=view&id=${uploadedFile.id}`;

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          id: uploadedFile.id,
          name: uploadedFile.name,
          webViewLink: uploadedFile.webViewLink,
          directLink: directLink,
          thumbnailLink: uploadedFile.thumbnailLink,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});