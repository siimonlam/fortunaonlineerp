import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUp, ArrowDown, TrendingUp, DollarSign, MousePointer, Eye, Target } from 'lucide-react';

interface ComparisonMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  results: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

interface CampaignComparison {
  campaign_id: string;
  name: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface AdSetComparison {
  adset_id: string;
  name: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface DemographicComparison {
  age_group: string;
  gender: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface PlatformComparison {
  publisher_platform: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface Props {
  accountId: string;
}

export default function MonthlyComparison({ accountId }: Props) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [month1, setMonth1] = useState('');
  const [month2, setMonth2] = useState('');
  const [loading, setLoading] = useState(true);
  const [comparisonType, setComparisonType] = useState<'overall' | 'campaigns' | 'adsets' | 'demographics' | 'platform'>('overall');

  const [overallMonth1, setOverallMonth1] = useState<ComparisonMetrics | null>(null);
  const [overallMonth2, setOverallMonth2] = useState<ComparisonMetrics | null>(null);
  const [campaignComparisons, setCampaignComparisons] = useState<CampaignComparison[]>([]);
  const [adSetComparisons, setAdSetComparisons] = useState<AdSetComparison[]>([]);
  const [demographicComparisons, setDemographicComparisons] = useState<DemographicComparison[]>([]);
  const [platformComparisons, setPlatformComparisons] = useState<PlatformComparison[]>([]);

  useEffect(() => {
    fetchAvailableMonths();
  }, [accountId]);

  useEffect(() => {
    if (month1 && month2) {
      fetchComparisonData();
    }
  }, [month1, month2, accountId]);

  const fetchAvailableMonths = async () => {
    try {
      const { data: insights, error } = await supabase
        .from('meta_monthly_insights')
        .select('month_year')
        .eq('account_id', accountId)
        .order('month_year', { ascending: false });

      if (error) {
        console.error('Error fetching available months:', error);
        return;
      }

      if (insights && insights.length > 0) {
        const uniqueMonths = [...new Set(insights.map(i => i.month_year.slice(0, 7)))].sort().reverse();
        setAvailableMonths(uniqueMonths);

        if (uniqueMonths.length >= 2) {
          setMonth1(uniqueMonths[1]);
          setMonth2(uniqueMonths[0]);
        } else if (uniqueMonths.length === 1) {
          setMonth1(uniqueMonths[0]);
        }
      } else {
        console.log('No monthly insights data found for account:', accountId);
      }
    } catch (error) {
      console.error('Error fetching available months:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOverallComparison(),
        fetchCampaignComparison(),
        fetchAdSetComparison(),
        fetchDemographicComparison(),
        fetchPlatformComparison()
      ]);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverallComparison = async () => {
    console.log('Fetching comparison for months:', month1, 'and', month2, 'Account ID:', accountId);

    const { data: month1Data, error: error1 } = await supabase
      .from('meta_monthly_insights')
      .select('*')
      .eq('account_id', accountId)
      .like('month_year', `${month1}%`);

    const { data: month2Data, error: error2 } = await supabase
      .from('meta_monthly_insights')
      .select('*')
      .eq('account_id', accountId)
      .like('month_year', `${month2}%`);

    if (error1) console.error('Error fetching month1 data:', error1);
    if (error2) console.error('Error fetching month2 data:', error2);

    console.log('Month1 data rows:', month1Data?.length || 0);
    console.log('Month2 data rows:', month2Data?.length || 0);

    const aggregateMetrics = (data: any[]): ComparisonMetrics => {
      const totals = data.reduce((acc, row) => ({
        spend: acc.spend + (Number(row.spend) || 0),
        impressions: acc.impressions + (Number(row.impressions) || 0),
        clicks: acc.clicks + (Number(row.clicks) || 0),
        reach: acc.reach + (Number(row.reach) || 0),
        results: acc.results + (Number(row.results) || 0)
      }), { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0 });

      return {
        ...totals,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
      };
    };

    setOverallMonth1(aggregateMetrics(month1Data || []));
    setOverallMonth2(aggregateMetrics(month2Data || []));
  };

  const fetchCampaignComparison = async () => {
    const { data: month1Data } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id, campaign_name, spend, impressions, clicks, reach, results, ctr, cpc, cpm')
      .eq('account_id', accountId)
      .like('month_year', `${month1}%`);

    const { data: month2Data } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id, campaign_name, spend, impressions, clicks, reach, results, ctr, cpc, cpm')
      .eq('account_id', accountId)
      .like('month_year', `${month2}%`);

    const campaignMap = new Map<string, CampaignComparison>();

    (month1Data || []).forEach(row => {
      if (!campaignMap.has(row.campaign_id)) {
        campaignMap.set(row.campaign_id, {
          campaign_id: row.campaign_id,
          name: row.campaign_name || 'Unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const campaign = campaignMap.get(row.campaign_id)!;
      campaign.month1.spend += Number(row.spend) || 0;
      campaign.month1.impressions += Number(row.impressions) || 0;
      campaign.month1.clicks += Number(row.clicks) || 0;
      campaign.month1.reach += Number(row.reach) || 0;
      campaign.month1.results += Number(row.results) || 0;
    });

    (month2Data || []).forEach(row => {
      if (!campaignMap.has(row.campaign_id)) {
        campaignMap.set(row.campaign_id, {
          campaign_id: row.campaign_id,
          name: row.campaign_name || 'Unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const campaign = campaignMap.get(row.campaign_id)!;
      campaign.month2.spend += Number(row.spend) || 0;
      campaign.month2.impressions += Number(row.impressions) || 0;
      campaign.month2.clicks += Number(row.clicks) || 0;
      campaign.month2.reach += Number(row.reach) || 0;
      campaign.month2.results += Number(row.results) || 0;
    });

    campaignMap.forEach(campaign => {
      campaign.month1.ctr = campaign.month1.impressions > 0 ? (campaign.month1.clicks / campaign.month1.impressions) * 100 : 0;
      campaign.month1.cpc = campaign.month1.clicks > 0 ? campaign.month1.spend / campaign.month1.clicks : 0;
      campaign.month1.cpm = campaign.month1.impressions > 0 ? (campaign.month1.spend / campaign.month1.impressions) * 1000 : 0;

      campaign.month2.ctr = campaign.month2.impressions > 0 ? (campaign.month2.clicks / campaign.month2.impressions) * 100 : 0;
      campaign.month2.cpc = campaign.month2.clicks > 0 ? campaign.month2.spend / campaign.month2.clicks : 0;
      campaign.month2.cpm = campaign.month2.impressions > 0 ? (campaign.month2.spend / campaign.month2.impressions) * 1000 : 0;
    });

    setCampaignComparisons(Array.from(campaignMap.values()));
  };

  const fetchAdSetComparison = async () => {
    const { data: month1Data } = await supabase
      .from('meta_monthly_insights')
      .select('adset_id, adset_name, spend, impressions, clicks, reach, results')
      .eq('account_id', accountId)
      .like('month_year', `${month1}%`);

    const { data: month2Data } = await supabase
      .from('meta_monthly_insights')
      .select('adset_id, adset_name, spend, impressions, clicks, reach, results')
      .eq('account_id', accountId)
      .like('month_year', `${month2}%`);

    const adsetMap = new Map<string, AdSetComparison>();

    (month1Data || []).forEach(row => {
      if (!adsetMap.has(row.adset_id)) {
        adsetMap.set(row.adset_id, {
          adset_id: row.adset_id,
          name: row.adset_name || 'Unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const adset = adsetMap.get(row.adset_id)!;
      adset.month1.spend += Number(row.spend) || 0;
      adset.month1.impressions += Number(row.impressions) || 0;
      adset.month1.clicks += Number(row.clicks) || 0;
      adset.month1.reach += Number(row.reach) || 0;
      adset.month1.results += Number(row.results) || 0;
    });

    (month2Data || []).forEach(row => {
      if (!adsetMap.has(row.adset_id)) {
        adsetMap.set(row.adset_id, {
          adset_id: row.adset_id,
          name: row.adset_name || 'Unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const adset = adsetMap.get(row.adset_id)!;
      adset.month2.spend += Number(row.spend) || 0;
      adset.month2.impressions += Number(row.impressions) || 0;
      adset.month2.clicks += Number(row.clicks) || 0;
      adset.month2.reach += Number(row.reach) || 0;
      adset.month2.results += Number(row.results) || 0;
    });

    adsetMap.forEach(adset => {
      adset.month1.ctr = adset.month1.impressions > 0 ? (adset.month1.clicks / adset.month1.impressions) * 100 : 0;
      adset.month1.cpc = adset.month1.clicks > 0 ? adset.month1.spend / adset.month1.clicks : 0;
      adset.month1.cpm = adset.month1.impressions > 0 ? (adset.month1.spend / adset.month1.impressions) * 1000 : 0;

      adset.month2.ctr = adset.month2.impressions > 0 ? (adset.month2.clicks / adset.month2.impressions) * 100 : 0;
      adset.month2.cpc = adset.month2.clicks > 0 ? adset.month2.spend / adset.month2.clicks : 0;
      adset.month2.cpm = adset.month2.impressions > 0 ? (adset.month2.spend / adset.month2.impressions) * 1000 : 0;
    });

    setAdSetComparisons(Array.from(adsetMap.values()));
  };

  const fetchDemographicComparison = async () => {
    const { data: month1Data } = await supabase
      .from('meta_monthly_demographics')
      .select('*')
      .eq('account_id', accountId)
      .like('month_year', `${month1}%`);

    const { data: month2Data } = await supabase
      .from('meta_monthly_demographics')
      .select('*')
      .eq('account_id', accountId)
      .like('month_year', `${month2}%`);

    const demoMap = new Map<string, DemographicComparison>();

    (month1Data || []).forEach(row => {
      const key = `${row.age_group}_${row.gender}`;
      if (!demoMap.has(key)) {
        demoMap.set(key, {
          age_group: row.age_group || 'unknown',
          gender: row.gender || 'unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const demo = demoMap.get(key)!;
      demo.month1.spend += Number(row.spend) || 0;
      demo.month1.impressions += Number(row.impressions) || 0;
      demo.month1.clicks += Number(row.clicks) || 0;
      demo.month1.reach += Number(row.reach) || 0;
      demo.month1.results += Number(row.results) || 0;
    });

    (month2Data || []).forEach(row => {
      const key = `${row.age_group}_${row.gender}`;
      if (!demoMap.has(key)) {
        demoMap.set(key, {
          age_group: row.age_group || 'unknown',
          gender: row.gender || 'unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const demo = demoMap.get(key)!;
      demo.month2.spend += Number(row.spend) || 0;
      demo.month2.impressions += Number(row.impressions) || 0;
      demo.month2.clicks += Number(row.clicks) || 0;
      demo.month2.reach += Number(row.reach) || 0;
      demo.month2.results += Number(row.results) || 0;
    });

    demoMap.forEach(demo => {
      demo.month1.ctr = demo.month1.impressions > 0 ? (demo.month1.clicks / demo.month1.impressions) * 100 : 0;
      demo.month1.cpc = demo.month1.clicks > 0 ? demo.month1.spend / demo.month1.clicks : 0;
      demo.month1.cpm = demo.month1.impressions > 0 ? (demo.month1.spend / demo.month1.impressions) * 1000 : 0;

      demo.month2.ctr = demo.month2.impressions > 0 ? (demo.month2.clicks / demo.month2.impressions) * 100 : 0;
      demo.month2.cpc = demo.month2.clicks > 0 ? demo.month2.spend / demo.month2.clicks : 0;
      demo.month2.cpm = demo.month2.impressions > 0 ? (demo.month2.spend / demo.month2.impressions) * 1000 : 0;
    });

    setDemographicComparisons(Array.from(demoMap.values()));
  };

  const fetchPlatformComparison = async () => {
    const { data: month1Data } = await supabase
      .from('meta_platform_insights')
      .select('*')
      .eq('account_id', accountId)
      .like('month_year', `${month1}%`);

    const { data: month2Data } = await supabase
      .from('meta_platform_insights')
      .select('*')
      .eq('account_id', accountId)
      .like('month_year', `${month2}%`);

    const platformMap = new Map<string, PlatformComparison>();

    (month1Data || []).forEach(row => {
      if (!platformMap.has(row.publisher_platform)) {
        platformMap.set(row.publisher_platform, {
          publisher_platform: row.publisher_platform,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const platform = platformMap.get(row.publisher_platform)!;
      platform.month1.spend += Number(row.spend) || 0;
      platform.month1.impressions += Number(row.impressions) || 0;
      platform.month1.clicks += Number(row.clicks) || 0;
      platform.month1.reach += Number(row.reach) || 0;
      platform.month1.results += Number(row.results) || 0;
    });

    (month2Data || []).forEach(row => {
      if (!platformMap.has(row.publisher_platform)) {
        platformMap.set(row.publisher_platform, {
          publisher_platform: row.publisher_platform,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const platform = platformMap.get(row.publisher_platform)!;
      platform.month2.spend += Number(row.spend) || 0;
      platform.month2.impressions += Number(row.impressions) || 0;
      platform.month2.clicks += Number(row.clicks) || 0;
      platform.month2.reach += Number(row.reach) || 0;
      platform.month2.results += Number(row.results) || 0;
    });

    platformMap.forEach(platform => {
      platform.month1.ctr = platform.month1.impressions > 0 ? (platform.month1.clicks / platform.month1.impressions) * 100 : 0;
      platform.month1.cpc = platform.month1.clicks > 0 ? platform.month1.spend / platform.month1.clicks : 0;
      platform.month1.cpm = platform.month1.impressions > 0 ? (platform.month1.spend / platform.month1.impressions) * 1000 : 0;

      platform.month2.ctr = platform.month2.impressions > 0 ? (platform.month2.clicks / platform.month2.impressions) * 100 : 0;
      platform.month2.cpc = platform.month2.clicks > 0 ? platform.month2.spend / platform.month2.clicks : 0;
      platform.month2.cpm = platform.month2.impressions > 0 ? (platform.month2.spend / platform.month2.impressions) * 1000 : 0;
    });

    setPlatformComparisons(Array.from(platformMap.values()));
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const calculatePercentageChange = (oldValue: number, newValue: number) => {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  };

  const renderChangeIndicator = (change: number) => {
    if (Math.abs(change) < 0.01) {
      return <span className="text-gray-500 text-sm">-</span>;
    }

    const isPositive = change > 0;
    return (
      <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    );
  };

  const renderMetricCard = (label: string, icon: any, month1Value: number, month2Value: number, format: 'currency' | 'number' | 'percentage' | 'decimal') => {
    const Icon = icon;
    const change = calculatePercentageChange(month1Value, month2Value);

    const formatValue = (value: number) => {
      switch (format) {
        case 'currency':
          return `HK$${value.toFixed(2)}`;
        case 'number':
          return value.toLocaleString();
        case 'percentage':
          return `${value.toFixed(2)}%`;
        case 'decimal':
          return `HK$${value.toFixed(2)}`;
      }
    };

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600 mb-3">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{month1 ? formatMonthDisplay(month1) : '-'}</span>
            <span className="text-lg font-bold text-gray-900">{formatValue(month1Value)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{month2 ? formatMonthDisplay(month2) : '-'}</span>
            <span className="text-lg font-bold text-gray-900">{formatValue(month2Value)}</span>
          </div>
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">Change</span>
            {renderChangeIndicator(change)}
          </div>
        </div>
      </div>
    );
  };

  if (loading && availableMonths.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading monthly data...</p>
        </div>
      </div>
    );
  }

  if (availableMonths.length < 2) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Need at least 2 months of data for comparison</p>
        <p className="text-sm text-gray-500 mt-2">Use "Sync Monthly Reports" to fetch more monthly data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Months to Compare</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month 1</label>
            <select
              value={month1}
              onChange={(e) => setMonth1(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {formatMonthDisplay(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month 2</label>
            <select
              value={month2}
              onChange={(e) => setMonth2(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {formatMonthDisplay(month)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setComparisonType('overall')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            comparisonType === 'overall'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overall
        </button>
        <button
          onClick={() => setComparisonType('campaigns')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            comparisonType === 'campaigns'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Campaigns
        </button>
        <button
          onClick={() => setComparisonType('adsets')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            comparisonType === 'adsets'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Ad Sets
        </button>
        <button
          onClick={() => setComparisonType('demographics')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            comparisonType === 'demographics'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Demographics
        </button>
        <button
          onClick={() => setComparisonType('platform')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            comparisonType === 'platform'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Platform
        </button>
      </div>

      {comparisonType === 'overall' && overallMonth1 && overallMonth2 && (
        <>
          {overallMonth1.spend === 0 && overallMonth2.spend === 0 &&
           overallMonth1.impressions === 0 && overallMonth2.impressions === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No data available for selected months</p>
              <p className="text-sm text-gray-500">
                The selected months ({month1 ? formatMonthDisplay(month1) : '-'} and {month2 ? formatMonthDisplay(month2) : '-'})
                don't have any data yet.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Go to <span className="font-semibold">Monthly Overview</span> tab and use <span className="font-semibold">"Sync Monthly Reports"</span> button to fetch data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {renderMetricCard('Spend', DollarSign, overallMonth1.spend, overallMonth2.spend, 'currency')}
              {renderMetricCard('Impressions', Eye, overallMonth1.impressions, overallMonth2.impressions, 'number')}
              {renderMetricCard('Clicks', MousePointer, overallMonth1.clicks, overallMonth2.clicks, 'number')}
              {renderMetricCard('Results', Target, overallMonth1.results, overallMonth2.results, 'number')}
              {renderMetricCard('CTR', TrendingUp, overallMonth1.ctr, overallMonth2.ctr, 'percentage')}
              {renderMetricCard('CPC', DollarSign, overallMonth1.cpc, overallMonth2.cpc, 'decimal')}
              {renderMetricCard('CPM', DollarSign, overallMonth1.cpm, overallMonth2.cpm, 'decimal')}
              {renderMetricCard('Reach', Eye, overallMonth1.reach, overallMonth2.reach, 'number')}
            </div>
          )}
        </>
      )}

      {comparisonType === 'campaigns' && (
        <>
          {campaignComparisons.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No campaign data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch campaign comparison data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Campaign</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Month</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Spend</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Results</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">CTR</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">CPC</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaignComparisons.map((campaign) => (
                  <>
                    <tr key={`${campaign.campaign_id}-m1`} className="hover:bg-gray-50">
                      <td rowSpan={2} className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">{campaign.name}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">HK${campaign.month1.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month1.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month1.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month1.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month1.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${campaign.month1.cpc.toFixed(2)}</td>
                    </tr>
                    <tr key={`${campaign.campaign_id}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-medium">HK${campaign.month2.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month2.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month2.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month2.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{campaign.month2.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${campaign.month2.cpc.toFixed(2)}</td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}

      {comparisonType === 'adsets' && (
        <>
          {adSetComparisons.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No ad set data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch ad set comparison data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Ad Set</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Month</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Spend</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Results</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">CTR</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">CPC</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adSetComparisons.map((adset) => (
                  <>
                    <tr key={`${adset.adset_id}-m1`} className="hover:bg-gray-50">
                      <td rowSpan={2} className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">{adset.name}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">HK${adset.month1.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${adset.month1.cpc.toFixed(2)}</td>
                    </tr>
                    <tr key={`${adset.adset_id}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-medium">HK${adset.month2.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month2.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month2.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month2.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month2.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${adset.month2.cpc.toFixed(2)}</td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}

      {comparisonType === 'demographics' && (
        <>
          {demographicComparisons.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No demographic data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch demographic comparison data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Age Group</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Gender</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Month</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Spend</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Results</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">CTR</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {demographicComparisons.slice(0, 20).map((demo, idx) => (
                  <>
                    <tr key={`${idx}-m1`} className="hover:bg-gray-50">
                      <td rowSpan={2} className="px-4 py-3 text-gray-900 border-r border-gray-200">{demo.age_group}</td>
                      <td rowSpan={2} className="px-4 py-3 border-r border-gray-200">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          demo.gender === 'male' ? 'bg-blue-100 text-blue-800' :
                          demo.gender === 'female' ? 'bg-pink-100 text-pink-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {demo.gender === 'male' ? 'Male' : demo.gender === 'female' ? 'Female' : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">HK${demo.month1.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month1.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month1.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month1.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month1.ctr.toFixed(2)}%</td>
                    </tr>
                    <tr key={`${idx}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-medium">HK${demo.month2.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month2.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month2.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month2.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{demo.month2.ctr.toFixed(2)}%</td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {demographicComparisons.length > 20 && (
            <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600 text-center">
              Showing top 20 of {demographicComparisons.length} demographic segments
            </div>
          )}
        </div>
          )}
        </>
      )}

      {comparisonType === 'platform' && (
        <>
          {platformComparisons.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No platform data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch platform comparison data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Platform</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Month</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Spend</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Results</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">CTR</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">CPC</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {platformComparisons.map((platform) => (
                  <>
                    <tr key={`${platform.publisher_platform}-m1`} className="hover:bg-gray-50">
                      <td rowSpan={2} className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 capitalize">
                        {platform.publisher_platform.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">HK${platform.month1.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month1.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month1.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month1.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month1.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${platform.month1.cpc.toFixed(2)}</td>
                    </tr>
                    <tr key={`${platform.publisher_platform}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-medium">HK${platform.month2.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month2.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month2.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month2.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{platform.month2.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${platform.month2.cpc.toFixed(2)}</td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}
    </div>
  );
}
