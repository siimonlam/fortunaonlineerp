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

    const whatsappApiUrl = `https://graph.facebook.com/v21.0/${account.phone_number_id}/groups`;
    const response = await fetch(whatsappApiUrl, {
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WhatsApp API error:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch groups from WhatsApp API',
          details: errorData
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const groups = data.data || [];

    console.log(`Found ${groups.length} groups`);

    for (const group of groups) {
      await supabase
        .from('whatsapp_groups')
        .upsert({
          account_id: account.id,
          group_id: group.id,
          group_name: group.name || 'Unnamed Group',
          participants_count: group.participants_count || 0
        }, {
          onConflict: 'account_id,group_id'
        });
    }

    await supabase
      .from('whatsapp_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        groups_count: groups.length,
        message: `Successfully synced ${groups.length} groups`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error syncing WhatsApp groups:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});