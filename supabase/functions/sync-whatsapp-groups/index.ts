import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  account_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { account_id }: RequestBody = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Syncing groups for account:', account.account_name);

    // Note: WhatsApp Business API does not provide a direct endpoint to list all groups.
    // Groups can only be accessed when:
    // 1. A message is sent to the group (you'll receive the group ID in webhooks)
    // 2. The business receives a message from a group
    // 3. You manually add groups via the UI
    
    // For now, we'll test the connection and return instructions
    const testUrl = `https://graph.facebook.com/v21.0/${account.phone_number_id}`;
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      console.error('WhatsApp API connection test failed:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to WhatsApp API. Please verify your credentials.',
          details: errorData,
          help: 'Make sure your system user has WhatsApp Business Management permissions'
        }),
        { status: testResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneData = await testResponse.json();
    console.log('WhatsApp phone number info:', phoneData);

    await supabase
      .from('whatsapp_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        connection_verified: true,
        phone_info: phoneData,
        message: 'WhatsApp connection verified successfully!',
        note: 'WhatsApp Business API does not provide a direct endpoint to list groups. To add groups:\n1. Send a test message to your group from WhatsApp\n2. Check incoming webhooks for group IDs\n3. Manually add groups using the group ID format: 120363XXXXXXXX@g.us'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync-whatsapp-groups:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});