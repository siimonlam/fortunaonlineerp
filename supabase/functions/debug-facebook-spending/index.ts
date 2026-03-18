import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

    const { accountId, month } = await req.json();

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

    // Parse month (e.g., "2026-02")
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const endDate = `${year}-${monthNum}-${lastDay}`;

    console.log(`Checking Facebook spending for ${formattedAccountId} from ${startDate} to ${endDate}`);

    const results: any = {
      accountId,
      month,
      dateRange: { since: startDate, until: endDate },
      adsetLevel: null,
      adLevel: null,
      databaseComparison: null
    };

    // 1. Get adset-level insights (this is what sync-monthly-reports fetches)
    const adsetUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=adset&fields=adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=monthly&limit=500&access_token=${accessToken}`;

    console.log('Fetching adset-level insights...');
    const adsetResponse = await fetch(adsetUrl);
    const adsetData = await adsetResponse.json();

    if (adsetData.error) {
      console.error('Facebook API error:', adsetData.error);
      results.error = adsetData.error;
    } else {
      const adsets = adsetData.data || [];
      const totalSpend = adsets.reduce((sum: number, adset: any) => sum + parseFloat(adset.spend || '0'), 0);

      results.adsetLevel = {
        totalAdsets: adsets.length,
        totalSpend: totalSpend.toFixed(2),
        adsets: adsets.map((a: any) => ({
          adset_id: a.adset_id,
          adset_name: a.adset_name,
          campaign_id: a.campaign_id,
          campaign_name: a.campaign_name,
          spend: parseFloat(a.spend || '0').toFixed(2),
          impressions: parseInt(a.impressions || '0'),
          clicks: parseInt(a.clicks || '0')
        }))
      };

      console.log(`Facebook adset-level: ${adsets.length} adsets, total spend: HK$${totalSpend.toFixed(2)}`);
    }

    // 2. Get ad-level insights for comparison
    const adUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights?level=ad&fields=ad_id,ad_name,adset_id,campaign_id,spend,impressions,clicks&time_range={"since":"${startDate}","until":"${endDate}"}&time_increment=monthly&limit=500&access_token=${accessToken}`;

    console.log('Fetching ad-level insights...');
    const adResponse = await fetch(adUrl);
    const adData = await adResponse.json();

    if (!adData.error) {
      const ads = adData.data || [];
      const totalSpend = ads.reduce((sum: number, ad: any) => sum + parseFloat(ad.spend || '0'), 0);

      const sortedAds = ads.sort((a: any, b: any) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'));

      results.adLevel = {
        totalAds: ads.length,
        totalSpend: totalSpend.toFixed(2),
        uniqueCampaigns: [...new Set(ads.map((a: any) => a.campaign_id))].length,
        uniqueAdsets: [...new Set(ads.map((a: any) => a.adset_id))].length,
        topAds: sortedAds
          .slice(0, 10)
          .map((a: any) => ({
            ad_id: a.ad_id,
            ad_name: a.ad_name,
            adset_id: a.adset_id,
            campaign_id: a.campaign_id,
            spend: parseFloat(a.spend || '0').toFixed(2)
          })),
        allAds: sortedAds.map((a: any) => ({
          ad_id: a.ad_id,
          ad_name: a.ad_name,
          adset_id: a.adset_id,
          campaign_id: a.campaign_id,
          spend: parseFloat(a.spend || '0').toFixed(2)
        }))
      };

      console.log(`Facebook ad-level: ${ads.length} ads, total spend: HK$${totalSpend.toFixed(2)}`);
      console.log('Top 10 ads by spending:');
      results.adLevel.topAds.forEach((ad: any, i: number) => {
        console.log(`  ${i + 1}. ${ad.ad_name} (ID: ${ad.ad_id}) - HK$${ad.spend}`);
      });
    }

    // 3. Compare with database
    const monthStart = `${year}-${monthNum}-01`;
    const { data: dbMonthly } = await supabase
      .from('meta_monthly_insights')
      .select('spend, campaign_id, adset_id')
      .eq('account_id', accountId)
      .eq('month_year', monthStart);

    if (dbMonthly) {
      const dbTotalSpend = dbMonthly.reduce((sum, row) => sum + parseFloat(row.spend || '0'), 0);
      results.databaseComparison = {
        totalRecords: dbMonthly.length,
        totalSpend: dbTotalSpend.toFixed(2),
        uniqueCampaigns: [...new Set(dbMonthly.map(r => r.campaign_id))].length,
        uniqueAdsets: [...new Set(dbMonthly.map(r => r.adset_id))].length,
        difference: results.adLevel ? (parseFloat(results.adLevel.totalSpend) - dbTotalSpend).toFixed(2) : null
      };

      console.log(`Database: ${dbMonthly.length} records, total spend: HK$${dbTotalSpend.toFixed(2)}`);
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
