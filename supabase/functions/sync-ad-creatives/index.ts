import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncRequest {
  accountId: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRateLimit(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);

    const rateLimitRemaining = response.headers.get('x-app-usage') || response.headers.get('x-ad-account-usage');

    if (response.status === 429 || (response.status === 400 && rateLimitRemaining)) {
      const waitTime = Math.min(1000 * Math.pow(2, i), 30000);
      console.log(`Rate limited, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
      await delay(waitTime);
      continue;
    }

    await delay(100);
    return response;
  }

  return await fetch(url);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { accountId }: SyncRequest = await req.json();

    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const { data: tokenData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'meta_ads_access_token')
      .maybeSingle();

    if (!tokenData?.value) {
      throw new Error('Meta Ads access token not configured');
    }

    const accessToken = tokenData.value;
    const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    console.log(`\n========================================`);
    console.log(`Starting creative sync for account: ${formattedAccountId}`);
    console.log(`========================================\n`);

    let totalSynced = 0;
    const errors: string[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/v21.0/${formattedAccountId}/adcreatives?fields=id,name,title,body,image_url,thumbnail_url,object_story_spec,video_id,effective_object_story_id,call_to_action_type,link_url&limit=50&access_token=${accessToken}`;

    while (nextUrl) {
      console.log(`Fetching creatives page...`);
      const response = await fetchWithRateLimit(nextUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errorMsg = `Failed to fetch creatives: ${errorData.error?.message || 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        break;
      }

      const data = await response.json();
      const creatives = data.data || [];

      console.log(`Processing ${creatives.length} creatives...`);

      for (const creative of creatives) {
        try {
          let title = creative.title || '';
          let body = creative.body || '';
          let imageUrl = creative.image_url || '';
          let linkUrl = creative.link_url || '';
          let effectiveObjectUrl = '';

          if (creative.object_story_spec) {
            const linkData = creative.object_story_spec.link_data || {};
            const videoData = creative.object_story_spec.video_data || {};

            if (!body && linkData.message) {
              body = linkData.message;
            }
            if (!title && linkData.name) {
              title = linkData.name;
            }
            if (!imageUrl && linkData.picture) {
              imageUrl = linkData.picture;
            }
            if (linkData.link) {
              effectiveObjectUrl = linkData.link;
            }

            if (!body && videoData.message) {
              body = videoData.message;
            }
            if (!title && videoData.title) {
              title = videoData.title;
            }
            if (!imageUrl && videoData.image_url) {
              imageUrl = videoData.image_url;
            }
          }

          const { error: upsertError } = await supabase
            .from('meta_ad_creatives')
            .upsert({
              creative_id: creative.id,
              account_id: accountId,
              name: creative.name || null,
              title: title || null,
              body: body || null,
              image_url: imageUrl || null,
              thumbnail_url: creative.thumbnail_url || null,
              video_id: creative.video_id || null,
              link_url: linkUrl || null,
              call_to_action_type: creative.call_to_action_type || null,
              object_story_spec: creative.object_story_spec || null,
              effective_object_url: effectiveObjectUrl || null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'creative_id',
            });

          if (upsertError) {
            console.error(`Error saving creative ${creative.id}:`, upsertError.message);
            errors.push(`Creative ${creative.id}: ${upsertError.message}`);
          } else {
            totalSynced++;
          }
        } catch (err: any) {
          console.error(`Error processing creative ${creative.id}:`, err.message);
          errors.push(`Creative ${creative.id}: ${err.message}`);
        }
      }

      nextUrl = data.paging?.next || null;

      if (nextUrl) {
        console.log(`More creatives available, fetching next page...`);
      }
    }

    console.log(`\n========================================`);
    console.log(`Sync complete!`);
    console.log(`Total creatives synced: ${totalSynced}`);
    if (errors.length > 0) {
      console.log(`Errors encountered: ${errors.length}`);
    }
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
