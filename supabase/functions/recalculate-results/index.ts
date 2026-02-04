import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Helper function to get result action types based on campaign objective
const getResultActionTypes = (objective: string | null): string[] => {
  if (!objective) return [];

  switch (objective.toUpperCase()) {
    case 'OUTCOME_TRAFFIC':
    case 'LINK_CLICKS':
      return [
        'link_click',
        'landing_page_view',
        'omni_landing_page_view',
        'outbound_click',
        'offsite_conversion.fb_pixel_view_content',
        'onsite_conversion.flow_complete',
        'onsite_web_view_content',
        'view_content'
      ];

    case 'OUTCOME_ENGAGEMENT':
    case 'POST_ENGAGEMENT':
    case 'PAGE_LIKES':
      return ['post_engagement', 'page_engagement', 'like', 'onsite_conversion.post_net_like', 'onsite_conversion.post_save', 'video_view', 'post_reaction', 'comment', 'post'];

    case 'OUTCOME_LEADS':
    case 'LEAD_GENERATION':
      return [
        'lead',
        'onsite_conversion.lead_grouped',
        'offsite_conversion.fb_pixel_lead',
        'onsite_conversion.messaging_conversation_started_7d',
        'leadgen_grouped'
      ];

    case 'OUTCOME_SALES':
    case 'CONVERSIONS':
      return [
        // Purchase actions (including omni cross-channel)
        'purchase',
        'omni_purchase',
        'web_in_store_purchase',
        'offsite_conversion.fb_pixel_purchase',
        'onsite_conversion.purchase',
        'offsite_conversion.custom',
        // Cart actions (including omni)
        'add_to_cart',
        'omni_add_to_cart',
        'offsite_conversion.fb_pixel_add_to_cart',
        'onsite_conversion.add_to_cart',
        'onsite_web_add_to_cart',
        'onsite_web_app_add_to_cart',
        // Checkout actions (including omni)
        'initiate_checkout',
        'omni_initiated_checkout',
        'offsite_conversion.fb_pixel_initiate_checkout',
        // Other conversion actions
        'offsite_conversion.fb_pixel_complete_registration',
        'offsite_conversion.fb_pixel_add_payment_info',
        'offsite_conversion.fb_pixel_view_content',
        'onsite_conversion.post_save',
        'view_content',
        'onsite_web_view_content'
      ];

    case 'OUTCOME_APP_PROMOTION':
    case 'APP_INSTALLS':
    case 'MOBILE_APP_INSTALLS':
      return [
        'app_install',
        'mobile_app_install',
        'onsite_app_install',
        'offsite_conversion.fb_pixel_mobile_app_install'
      ];

    case 'VIDEO_VIEWS':
      return ['video_view', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p100_watched_actions'];

    case 'BRAND_AWARENESS':
    case 'OUTCOME_AWARENESS':
    case 'REACH':
      return ['reach', 'frequency', 'estimated_ad_recallers'];

    case 'MESSAGES':
      return ['onsite_conversion.messaging_conversation_started_7d'];

    default:
      return ['purchase', 'lead', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.post_save', 'omni_purchase'];
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { accountId } = await req.json();

    console.log(`Recalculating results for account ${accountId}...`);

    // Get all campaigns for this account to get objectives
    const { data: campaigns } = await supabase
      .from('meta_campaigns')
      .select('campaign_id, objective')
      .eq('account_id', accountId);

    const campaignObjectives = new Map(
      (campaigns || []).map(c => [c.campaign_id, c.objective])
    );

    // Get all monthly insights that need recalculation
    const { data: insights } = await supabase
      .from('meta_monthly_insights')
      .select('*')
      .eq('account_id', accountId);

    if (!insights || insights.length === 0) {
      return new Response(JSON.stringify({
        message: 'No insights found to recalculate',
        updated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${insights.length} insights to recalculate`);

    let updated = 0;
    const updates = [];

    for (const insight of insights) {
      if (!insight.actions) continue;

      const objective = campaignObjectives.get(insight.campaign_id);
      const validActionTypes = getResultActionTypes(objective);

      let results = 0;
      let resultType: string[] = [];

      try {
        const actions = typeof insight.actions === 'string'
          ? JSON.parse(insight.actions)
          : insight.actions;

        if (Array.isArray(actions)) {
          for (const actionType of validActionTypes) {
            const resultActions = actions.filter((a: any) => a.action_type === actionType);
            for (const resultAction of resultActions) {
              const value = parseInt(resultAction.value || '0');
              if (value > 0) {
                results += value;
                if (!resultType.includes(resultAction.action_type)) {
                  resultType.push(resultAction.action_type);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error parsing actions for insight ${insight.id}:`, e);
        continue;
      }

      // Only update if results changed
      if (results !== insight.results || (resultType.length > 0 && resultType.join(', ') !== insight.result_type)) {
        updates.push({
          id: insight.id,
          results: results,
          result_type: resultType.length > 0 ? resultType.join(', ') : null
        });
      }
    }

    console.log(`Updating ${updates.length} insights with recalculated results...`);

    // Update in batches of 100
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);

      for (const update of batch) {
        const { error } = await supabase
          .from('meta_monthly_insights')
          .update({
            results: update.results,
            result_type: update.result_type
          })
          .eq('id', update.id);

        if (error) {
          console.error(`Error updating insight ${update.id}:`, error);
        } else {
          updated++;
        }
      }
    }

    console.log(`Recalculation complete. Updated ${updated} insights.`);

    return new Response(JSON.stringify({
      message: 'Recalculation complete',
      total_insights: insights.length,
      updated: updated,
      sample_updates: updates.slice(0, 5)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
