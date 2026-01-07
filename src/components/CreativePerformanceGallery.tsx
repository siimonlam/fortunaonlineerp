import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, TrendingUp, MousePointer, Eye, DollarSign, Image as ImageIcon, Loader2 } from 'lucide-react';

interface CreativePerformance {
  creative_id: string;
  name: string;
  title: string;
  body: string;
  image_url: string;
  thumbnail_url: string;
  video_id: string;
  ad_count: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_values: number;
  ctr: number;
  cpc: number;
  roas: number;
}

interface Props {
  accountId: string;
  dateRange?: {
    since: string;
    until: string;
  };
}

export default function CreativePerformanceGallery({ accountId, dateRange }: Props) {
  const [creatives, setCreatives] = useState<CreativePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCreativePerformance();
  }, [accountId, dateRange]);

  const fetchCreativePerformance = async () => {
    try {
      setLoading(true);
      setError(null);

      const since = dateRange?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const until = dateRange?.until || new Date().toISOString().split('T')[0];

      const { data: ads, error: adsError } = await supabase
        .from('meta_ads')
        .select('ad_id, creative_id, name')
        .eq('account_id', accountId)
        .not('creative_id', 'is', null);

      if (adsError) throw adsError;

      if (!ads || ads.length === 0) {
        setCreatives([]);
        setLoading(false);
        return;
      }

      const creativeIds = [...new Set(ads.map(ad => ad.creative_id))].filter(Boolean) as string[];
      const adIds = ads.map(ad => ad.ad_id);

      const [creativesResult, insightsResult] = await Promise.all([
        supabase
          .from('meta_ad_creatives')
          .select('*')
          .in('creative_id', creativeIds),
        supabase
          .from('meta_ad_insights')
          .select('ad_id, spend, impressions, clicks, conversions, conversion_values, ctr, cpc')
          .in('ad_id', adIds)
          .gte('date', since)
          .lte('date', until)
      ]);

      if (creativesResult.error) throw creativesResult.error;
      if (insightsResult.error) throw insightsResult.error;

      const creativesData = creativesResult.data || [];
      const insightsData = insightsResult.data || [];

      const adToCreativeMap = new Map(ads.map(ad => [ad.ad_id, ad.creative_id]));

      const creativeMetrics = new Map<string, CreativePerformance>();

      creativesData.forEach(creative => {
        creativeMetrics.set(creative.creative_id, {
          creative_id: creative.creative_id,
          name: creative.name || 'Untitled Creative',
          title: creative.title || '',
          body: creative.body || '',
          image_url: creative.image_url || '',
          thumbnail_url: creative.thumbnail_url || '',
          video_id: creative.video_id || '',
          ad_count: 0,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversion_values: 0,
          ctr: 0,
          cpc: 0,
          roas: 0,
        });
      });

      insightsData.forEach(insight => {
        const creativeId = adToCreativeMap.get(insight.ad_id);
        if (creativeId && creativeMetrics.has(creativeId)) {
          const metrics = creativeMetrics.get(creativeId)!;
          metrics.spend += Number(insight.spend) || 0;
          metrics.impressions += Number(insight.impressions) || 0;
          metrics.clicks += Number(insight.clicks) || 0;
          metrics.conversions += Number(insight.conversions) || 0;
          metrics.conversion_values += Number(insight.conversion_values) || 0;
        }
      });

      const adsPerCreative = new Map<string, Set<string>>();
      ads.forEach(ad => {
        if (ad.creative_id) {
          if (!adsPerCreative.has(ad.creative_id)) {
            adsPerCreative.set(ad.creative_id, new Set());
          }
          adsPerCreative.get(ad.creative_id)!.add(ad.ad_id);
        }
      });

      creativeMetrics.forEach((metrics, creativeId) => {
        metrics.ad_count = adsPerCreative.get(creativeId)?.size || 0;
        metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        metrics.cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
        metrics.roas = metrics.spend > 0 ? metrics.conversion_values / metrics.spend : 0;
      });

      const sortedCreatives = Array.from(creativeMetrics.values()).sort((a, b) => b.spend - a.spend);

      setCreatives(sortedCreatives);
    } catch (err: any) {
      console.error('Error fetching creative performance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCreatives = async () => {
    try {
      setSyncing(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-ad-creatives`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync creatives');
      }

      alert(`Successfully synced ${result.synced} creatives!`);
      await fetchCreativePerformance();
    } catch (err: any) {
      console.error('Error syncing creatives:', err);
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto text-gray-400 mb-4 animate-spin" />
          <p className="text-gray-600">Loading creative performance...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchCreativePerformance}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Creative Performance Gallery</h3>
          <p className="text-sm text-gray-600">View ad creatives with their performance metrics</p>
        </div>
        <button
          onClick={handleSyncCreatives}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Sync Creatives
            </>
          )}
        </button>
      </div>

      {creatives.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 font-medium mb-2">No creatives found</p>
          <p className="text-sm text-gray-500 mb-4">
            Click "Sync Creatives" to fetch ad creatives from your Meta account
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {creatives.map((creative) => (
            <div
              key={creative.creative_id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="aspect-square bg-gray-100 relative">
                {creative.image_url || creative.thumbnail_url ? (
                  <img
                    src={creative.thumbnail_url || creative.image_url}
                    alt={creative.title || creative.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`${creative.image_url || creative.thumbnail_url ? 'hidden' : ''} absolute inset-0 flex items-center justify-center`}>
                  {creative.video_id ? (
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">Video Creative</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">No Preview</p>
                    </div>
                  )}
                </div>
                {creative.ad_count > 0 && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {creative.ad_count} {creative.ad_count === 1 ? 'Ad' : 'Ads'}
                  </div>
                )}
              </div>

              <div className="p-4">
                <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2 min-h-[3rem]">
                  {creative.title || creative.name}
                </h4>
                {creative.body && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {creative.body}
                  </p>
                )}

                <div className="space-y-2 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      Spend
                    </span>
                    <span className="font-semibold text-gray-900">
                      HK${creative.spend.toFixed(2)}
                    </span>
                  </div>

                  {creative.roas > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        ROAS
                      </span>
                      <span className="font-semibold text-green-600">
                        {creative.roas.toFixed(2)}x
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      Impressions
                    </span>
                    <span className="font-medium text-gray-700">
                      {creative.impressions.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <MousePointer className="w-4 h-4" />
                      Clicks
                    </span>
                    <span className="font-medium text-gray-700">
                      {creative.clicks.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-600">CTR</span>
                    <span className="font-medium text-gray-700">
                      {creative.ctr.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">CPC</span>
                    <span className="font-medium text-gray-700">
                      HK${creative.cpc.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
