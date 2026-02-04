import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, TrendingUp, MousePointer, Eye, DollarSign, Image as ImageIcon, Loader2, Grid3x3, Table as TableIcon, Video, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface AdPerformance {
  ad_name: string;
  ad_ids: string[];
  creative_id: string | null;
  title: string;
  body: string;
  image_url: string;
  thumbnail_url: string;
  video_id: string;
  ad_format: string;
  ad_count: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_values: number;
  ctr: number;
  cpc: number;
  roas: number;
  results: number;
}

interface Props {
  accountId: string;
  dateRange?: {
    since: string;
    until: string;
  };
}

type SortField = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'roas' | 'conversions' | 'results';
type SortDirection = 'asc' | 'desc';

export default function CreativePerformanceGallery({ accountId, dateRange }: Props) {
  const [creatives, setCreatives] = useState<AdPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchCreativePerformance();
  }, [accountId, dateRange]);

  const fetchCreativePerformance = async () => {
    try {
      setLoading(true);
      setError(null);

      const since = dateRange?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const until = dateRange?.until || new Date().toISOString().split('T')[0];

      // Fetch all ads with their creative information
      const { data: ads, error: adsError } = await supabase
        .from('meta_ads')
        .select('ad_id, creative_id, name, account_id')
        .eq('account_id', accountId);

      if (adsError) throw adsError;

      if (!ads || ads.length === 0) {
        setCreatives([]);
        setLoading(false);
        return;
      }

      const adIds = ads.map(ad => ad.ad_id);
      const creativeIds = [...new Set(ads.map(ad => ad.creative_id).filter(Boolean))] as string[];

      // Fetch insights and creatives in parallel
      const [insightsResult, creativesResult] = await Promise.all([
        supabase
          .from('meta_ad_insights')
          .select('ad_id, spend, impressions, clicks, conversions, conversion_values, results')
          .in('ad_id', adIds)
          .gte('date', since)
          .lte('date', until),
        creativeIds.length > 0
          ? supabase
              .from('meta_ad_creatives')
              .select('*')
              .in('creative_id', creativeIds)
          : { data: [], error: null }
      ]);

      if (insightsResult.error) throw insightsResult.error;
      if (creativesResult.error) throw creativesResult.error;

      const insightsData = insightsResult.data || [];
      const creativesData = creativesResult.data || [];

      // Create maps for quick lookups
      const creativeMap = new Map(
        creativesData.map(c => [c.creative_id, c])
      );

      // Group ads by ad name
      const adGroups = new Map<string, AdPerformance>();

      ads.forEach(ad => {
        const adName = ad.name || 'Untitled Ad';

        if (!adGroups.has(adName)) {
          const creative = ad.creative_id ? creativeMap.get(ad.creative_id) : null;

          adGroups.set(adName, {
            ad_name: adName,
            ad_ids: [],
            creative_id: ad.creative_id || null,
            title: creative?.title || creative?.name || adName,
            body: creative?.body || '',
            image_url: creative?.image_url || '',
            thumbnail_url: creative?.thumbnail_url || '',
            video_id: creative?.video_id || '',
            ad_format: creative?.ad_format || 'unknown',
            ad_count: 0,
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversion_values: 0,
            results: 0,
            ctr: 0,
            cpc: 0,
            roas: 0,
          });
        }

        const group = adGroups.get(adName)!;
        group.ad_ids.push(ad.ad_id);
        group.ad_count = group.ad_ids.length;
      });

      // Aggregate insights by ad name
      insightsData.forEach(insight => {
        const ad = ads.find(a => a.ad_id === insight.ad_id);
        if (!ad) return;

        const adName = ad.name || 'Untitled Ad';
        const group = adGroups.get(adName);

        if (group) {
          group.spend += Number(insight.spend) || 0;
          group.impressions += Number(insight.impressions) || 0;
          group.clicks += Number(insight.clicks) || 0;
          group.conversions += Number(insight.conversions) || 0;
          group.conversion_values += Number(insight.conversion_values) || 0;
          group.results += Number(insight.results) || 0;
        }
      });

      // Calculate derived metrics
      adGroups.forEach((group) => {
        group.ctr = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
        group.cpc = group.clicks > 0 ? group.spend / group.clicks : 0;
        group.roas = group.spend > 0 ? group.conversion_values / group.spend : 0;
      });

      const sortedAds = sortCreatives(Array.from(adGroups.values()), sortField, sortDirection);

      setCreatives(sortedAds);
    } catch (err: any) {
      console.error('Error fetching ad performance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sortCreatives = (items: AdPerformance[], field: SortField, direction: SortDirection) => {
    return [...items].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    setCreatives(sortCreatives(creatives, field, newDirection));
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const handleSyncCreatives = async () => {
    try {
      if (!accountId) {
        alert('Please select an account first');
        return;
      }

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

  if (!accountId) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
        <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 font-medium mb-2">No account selected</p>
        <p className="text-sm text-gray-500">
          Please select a Meta ad account from the dropdown above to view creatives
        </p>
      </div>
    );
  }

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
          <p className="text-sm text-gray-600">
            View ads grouped by ad name with performance metrics for the selected time period
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-2 rounded ${viewMode === 'gallery' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Gallery View"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
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
      </div>

      {creatives.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 font-medium mb-2">No ads found</p>
          <p className="text-sm text-gray-500 mb-4">
            Click "Sync Creatives" to fetch ads and their creatives from your Meta account
          </p>
        </div>
      ) : creatives.every(c => c.spend === 0 && c.impressions === 0) ? (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ImageIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900 mb-1">No Performance Data Available</h4>
                <p className="text-sm text-amber-800">
                  {creatives.length} ad{creatives.length !== 1 ? 's' : ''} found, but no performance data for the selected time period.
                  This means these ads haven't been active during this time range, or you need to sync ad insights first.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {creatives.map((creative) => (
              <div
                key={creative.ad_name}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden opacity-60"
              >
                <div className="aspect-square bg-gray-100 relative">
                  {creative.image_url || creative.thumbnail_url ? (
                    <img
                      src={creative.thumbnail_url || creative.image_url}
                      alt={creative.title || creative.name}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                  <div className={`${creative.image_url || creative.thumbnail_url ? 'hidden' : ''} absolute inset-0 flex items-center justify-center`}>
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">No Preview</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2 min-h-[3rem]">
                    {creative.title || creative.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-2">No data for selected period</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'gallery' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {creatives.map((creative) => (
            <div
              key={creative.ad_name}
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
                        <Video className="w-8 h-8 text-blue-600" />
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
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {creative.ad_count > 0 && (
                    <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {creative.ad_count} {creative.ad_count === 1 ? 'Ad' : 'Ads'}
                    </div>
                  )}
                  {creative.video_id && (
                    <div className="bg-blue-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      Video
                    </div>
                  )}
                  {creative.ad_format && (
                    <div className="bg-purple-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded">
                      {creative.ad_format}
                    </div>
                  )}
                </div>
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

                  {creative.results > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Results
                      </span>
                      <span className="font-semibold text-blue-600">
                        {creative.results.toLocaleString()}
                      </span>
                    </div>
                  )}

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

                  {creative.roas > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        ROAS
                      </span>
                      <span className="font-semibold text-green-600">
                        {creative.roas.toFixed(2)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Preview</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Format</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Ads</th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('spend')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Spend {getSortIcon('spend')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('impressions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Impressions {getSortIcon('impressions')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('clicks')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Clicks {getSortIcon('clicks')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('results')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Results {getSortIcon('results')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ctr')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CTR {getSortIcon('ctr')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('cpc')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CPC {getSortIcon('cpc')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('conversions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Conversions {getSortIcon('conversions')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('roas')}
                >
                  <div className="flex items-center justify-end gap-1">
                    ROAS {getSortIcon('roas')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {creatives.map((creative) => (
                <tr key={creative.ad_name} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      {creative.thumbnail_url || creative.image_url ? (
                        <img
                          src={creative.thumbnail_url || creative.image_url}
                          alt={creative.title || creative.name}
                          className="w-full h-full object-cover"
                        />
                      ) : creative.video_id ? (
                        <Video className="w-6 h-6 text-blue-600" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-medium text-gray-900 truncate">
                      {creative.title || creative.name}
                    </div>
                    {creative.body && (
                      <div className="text-sm text-gray-600 truncate">
                        {creative.body}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {creative.ad_format || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {creative.video_id ? (
                      <span className="inline-flex items-center gap-1 text-blue-600">
                        <Video className="w-4 h-4" />
                        Video
                      </span>
                    ) : (
                      <span className="text-gray-600">Image</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900">
                    {creative.ad_count}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    HK${creative.spend.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {creative.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {creative.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-blue-600">
                    {creative.results.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {creative.ctr.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    HK${creative.cpc.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {creative.conversions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                    {creative.roas > 0 ? `${creative.roas.toFixed(2)}x` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
