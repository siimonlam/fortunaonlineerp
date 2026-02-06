import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUp, ArrowDown, TrendingUp, DollarSign, MousePointer, Eye, Target, Sparkles, X, AlertCircle } from 'lucide-react';

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
  objective?: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface ObjectiveComparison {
  objective: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface AdSetComparison {
  name: string;
  adset_ids: string[];
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface DemographicComparison {
  age_group: string;
  gender: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface GenderComparison {
  gender: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface AgeComparison {
  age_group: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface PlatformComparison {
  publisher_platform: string;
  month1: ComparisonMetrics;
  month2: ComparisonMetrics;
}

interface ResultTypeComparison {
  result_type: string;
  month1: number;
  month2: number;
}

interface Props {
  accountId: string;
}

export default function MonthlyComparison({ accountId }: Props) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [month1, setMonth1] = useState('');
  const [month2, setMonth2] = useState('');

  // Helper function to get the first day of next month
  const getNextMonthStart = (yearMonth: string): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  };
  const [loading, setLoading] = useState(true);
  const [comparisonType, setComparisonType] = useState<'overall' | 'objectives' | 'campaigns' | 'adsets' | 'demographics' | 'platform' | 'resultTypes'>('overall');
  const [demographicView, setDemographicView] = useState<'gender' | 'age' | 'combined'>('gender');

  const [overallMonth1, setOverallMonth1] = useState<ComparisonMetrics | null>(null);
  const [overallMonth2, setOverallMonth2] = useState<ComparisonMetrics | null>(null);
  const [objectiveComparisons, setObjectiveComparisons] = useState<ObjectiveComparison[]>([]);
  const [campaignComparisons, setCampaignComparisons] = useState<CampaignComparison[]>([]);
  const [adSetComparisons, setAdSetComparisons] = useState<AdSetComparison[]>([]);
  const [demographicComparisons, setDemographicComparisons] = useState<DemographicComparison[]>([]);
  const [genderComparisons, setGenderComparisons] = useState<GenderComparison[]>([]);
  const [ageComparisons, setAgeComparisons] = useState<AgeComparison[]>([]);
  const [platformComparisons, setPlatformComparisons] = useState<PlatformComparison[]>([]);
  const [resultTypeComparisons, setResultTypeComparisons] = useState<ResultTypeComparison[]>([]);

  const [analyzingWithAI, setAnalyzingWithAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
      console.log('=== FETCHING AVAILABLE MONTHS ===');
      console.log('Account ID:', accountId);

      const { data: insights, error } = await supabase
        .from('meta_monthly_insights')
        .select('month_year')
        .eq('account_id', accountId)
        .order('month_year', { ascending: false });

      if (error) {
        console.error('Error fetching available months:', error);
        return;
      }

      console.log('Total insights rows:', insights?.length || 0);
      console.log('Sample month_year values:', insights?.slice(0, 5).map(i => i.month_year));

      if (insights && insights.length > 0) {
        const uniqueMonths = [...new Set(insights.map(i => {
          const monthYear = i.month_year.slice(0, 7);
          return monthYear;
        }))].sort().reverse();

        console.log('Unique months found:', uniqueMonths);
        setAvailableMonths(uniqueMonths);

        if (uniqueMonths.length >= 2) {
          setMonth1(uniqueMonths[1]);
          setMonth2(uniqueMonths[0]);
          console.log('Auto-selected months:', uniqueMonths[1], 'and', uniqueMonths[0]);
        } else if (uniqueMonths.length === 1) {
          setMonth1(uniqueMonths[0]);
          console.log('Only one month available:', uniqueMonths[0]);
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
        fetchObjectiveComparison(),
        fetchCampaignComparison(),
        fetchAdSetComparison(),
        fetchDemographicComparison(),
        fetchPlatformComparison(),
        fetchResultTypeComparison()
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
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Data, error: error2 } = await supabase
      .from('meta_monthly_insights')
      .select('*')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    if (error1) console.error('Error fetching month1 data:', error1);
    if (error2) console.error('Error fetching month2 data:', error2);

    console.log('Month1 (', month1, ') data rows:', month1Data?.length || 0, 'Sample:', month1Data?.[0]);
    console.log('Month2 (', month2, ') data rows:', month2Data?.length || 0, 'Sample:', month2Data?.[0]);

    // Fetch campaign objectives to apply correct aggregation logic
    const allCampaignIds = [...new Set([
      ...(month1Data || []).map(d => d.campaign_id),
      ...(month2Data || []).map(d => d.campaign_id)
    ].filter(Boolean))];

    const { data: campaignMeta } = await supabase
      .from('meta_campaigns')
      .select('campaign_id, objective')
      .in('campaign_id', allCampaignIds);

    const campaignObjectiveMap = new Map((campaignMeta || []).map(c => [c.campaign_id, c.objective]));

    const aggregateMetrics = (data: any[]): ComparisonMetrics => {
      const totals = data.reduce((acc, row) => {
        const objective = campaignObjectiveMap.get(row.campaign_id) || '';
        const upperObjective = objective.toUpperCase();
        let results = 0;

        // Match Campaigns tab logic: for OUTCOME_SALES, sum the breakdown columns
        if (upperObjective === 'OUTCOME_SALES' || upperObjective === 'CONVERSIONS') {
          results = (Number(row.sales_purchase) || 0) + (Number(row.sales_add_to_cart) || 0) + (Number(row.sales_initiate_checkout) || 0);
        } else {
          results = Number(row.results) || 0;
        }

        return {
          spend: acc.spend + (Number(row.spend) || 0),
          impressions: acc.impressions + (Number(row.impressions) || 0),
          clicks: acc.clicks + (Number(row.clicks) || 0),
          reach: acc.reach + (Number(row.reach) || 0),
          results: acc.results + results
        };
      }, { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0 });

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

  const fetchObjectiveComparison = async () => {
    const { data: month1Campaigns } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Campaigns } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    const allCampaignIds = [...new Set([
      ...(month1Campaigns || []).map(c => c.campaign_id),
      ...(month2Campaigns || []).map(c => c.campaign_id)
    ].filter(Boolean))];

    if (allCampaignIds.length === 0) {
      setObjectiveComparisons([]);
      return;
    }

    const { data: campaignMeta } = await supabase
      .from('meta_campaigns')
      .select('campaign_id, objective')
      .in('campaign_id', allCampaignIds);

    const campaignObjectiveMap = new Map((campaignMeta || []).map(c => [c.campaign_id, c.objective]));

    const { data: month1Data } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id, spend, impressions, clicks, reach, results, sales_purchase, sales_add_to_cart, sales_initiate_checkout')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Data } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id, spend, impressions, clicks, reach, results, sales_purchase, sales_add_to_cart, sales_initiate_checkout')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    const objectiveMap = new Map<string, ObjectiveComparison>();

    (month1Data || []).forEach(row => {
      const objective = campaignObjectiveMap.get(row.campaign_id) || 'Unknown';
      if (!objectiveMap.has(objective)) {
        objectiveMap.set(objective, {
          objective,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const obj = objectiveMap.get(objective)!;
      obj.month1.spend += Number(row.spend) || 0;
      obj.month1.impressions += Number(row.impressions) || 0;
      obj.month1.clicks += Number(row.clicks) || 0;
      obj.month1.reach += Number(row.reach) || 0;

      // Match Campaigns tab logic: for OUTCOME_SALES, sum the breakdown columns
      const upperObjective = objective.toUpperCase();
      if (upperObjective === 'OUTCOME_SALES' || upperObjective === 'CONVERSIONS') {
        obj.month1.results += (Number(row.sales_purchase) || 0) + (Number(row.sales_add_to_cart) || 0) + (Number(row.sales_initiate_checkout) || 0);
      } else {
        obj.month1.results += Number(row.results) || 0;
      }
    });

    (month2Data || []).forEach(row => {
      const objective = campaignObjectiveMap.get(row.campaign_id) || 'Unknown';
      if (!objectiveMap.has(objective)) {
        objectiveMap.set(objective, {
          objective,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const obj = objectiveMap.get(objective)!;
      obj.month2.spend += Number(row.spend) || 0;
      obj.month2.impressions += Number(row.impressions) || 0;
      obj.month2.clicks += Number(row.clicks) || 0;
      obj.month2.reach += Number(row.reach) || 0;

      // Match Campaigns tab logic: for OUTCOME_SALES, sum the breakdown columns
      const upperObjective = objective.toUpperCase();
      if (upperObjective === 'OUTCOME_SALES' || upperObjective === 'CONVERSIONS') {
        obj.month2.results += (Number(row.sales_purchase) || 0) + (Number(row.sales_add_to_cart) || 0) + (Number(row.sales_initiate_checkout) || 0);
      } else {
        obj.month2.results += Number(row.results) || 0;
      }
    });

    objectiveMap.forEach(obj => {
      obj.month1.ctr = obj.month1.impressions > 0 ? (obj.month1.clicks / obj.month1.impressions) * 100 : 0;
      obj.month1.cpc = obj.month1.clicks > 0 ? obj.month1.spend / obj.month1.clicks : 0;
      obj.month1.cpm = obj.month1.impressions > 0 ? (obj.month1.spend / obj.month1.impressions) * 1000 : 0;

      obj.month2.ctr = obj.month2.impressions > 0 ? (obj.month2.clicks / obj.month2.impressions) * 100 : 0;
      obj.month2.cpc = obj.month2.clicks > 0 ? obj.month2.spend / obj.month2.clicks : 0;
      obj.month2.cpm = obj.month2.impressions > 0 ? (obj.month2.spend / obj.month2.impressions) * 1000 : 0;
    });

    setObjectiveComparisons(Array.from(objectiveMap.values()));
  };

  const fetchCampaignComparison = async () => {
    const { data: month1Campaigns } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Campaigns } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    const allCampaignIds = [...new Set([
      ...(month1Campaigns || []).map(c => c.campaign_id),
      ...(month2Campaigns || []).map(c => c.campaign_id)
    ].filter(Boolean))];

    if (allCampaignIds.length === 0) {
      setCampaignComparisons([]);
      return;
    }

    const { data: campaignMeta } = await supabase
      .from('meta_campaigns')
      .select('campaign_id, objective')
      .in('campaign_id', allCampaignIds);

    const campaignObjectiveMap = new Map((campaignMeta || []).map(c => [c.campaign_id, c.objective]));

    const { data: month1Data } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id, campaign_name, spend, impressions, clicks, reach, results, ctr, cpc, cpm, sales_purchase, sales_add_to_cart, sales_initiate_checkout')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Data } = await supabase
      .from('meta_monthly_insights')
      .select('campaign_id, campaign_name, spend, impressions, clicks, reach, results, ctr, cpc, cpm, sales_purchase, sales_add_to_cart, sales_initiate_checkout')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    const campaignMap = new Map<string, CampaignComparison>();

    (month1Data || []).forEach(row => {
      if (!campaignMap.has(row.campaign_id)) {
        campaignMap.set(row.campaign_id, {
          campaign_id: row.campaign_id,
          name: row.campaign_name || 'Unknown',
          objective: campaignObjectiveMap.get(row.campaign_id) || 'Unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const campaign = campaignMap.get(row.campaign_id)!;
      campaign.month1.spend += Number(row.spend) || 0;
      campaign.month1.impressions += Number(row.impressions) || 0;
      campaign.month1.clicks += Number(row.clicks) || 0;
      campaign.month1.reach += Number(row.reach) || 0;

      // Match Campaigns tab logic: for OUTCOME_SALES, sum the breakdown columns
      const upperObjective = campaign.objective.toUpperCase();
      if (upperObjective === 'OUTCOME_SALES' || upperObjective === 'CONVERSIONS') {
        campaign.month1.results += (Number(row.sales_purchase) || 0) + (Number(row.sales_add_to_cart) || 0) + (Number(row.sales_initiate_checkout) || 0);
      } else {
        campaign.month1.results += Number(row.results) || 0;
      }
    });

    (month2Data || []).forEach(row => {
      if (!campaignMap.has(row.campaign_id)) {
        campaignMap.set(row.campaign_id, {
          campaign_id: row.campaign_id,
          name: row.campaign_name || 'Unknown',
          objective: campaignObjectiveMap.get(row.campaign_id) || 'Unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const campaign = campaignMap.get(row.campaign_id)!;
      campaign.month2.spend += Number(row.spend) || 0;
      campaign.month2.impressions += Number(row.impressions) || 0;
      campaign.month2.clicks += Number(row.clicks) || 0;
      campaign.month2.reach += Number(row.reach) || 0;

      // Match Campaigns tab logic: for OUTCOME_SALES, sum the breakdown columns
      const upperObjective = campaign.objective.toUpperCase();
      if (upperObjective === 'OUTCOME_SALES' || upperObjective === 'CONVERSIONS') {
        campaign.month2.results += (Number(row.sales_purchase) || 0) + (Number(row.sales_add_to_cart) || 0) + (Number(row.sales_initiate_checkout) || 0);
      } else {
        campaign.month2.results += Number(row.results) || 0;
      }
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
    // Use meta_monthly_demographics to match Ad Sets tab
    const { data: month1Data } = await supabase
      .from('meta_monthly_demographics')
      .select('adset_id, adset_name, spend, impressions, clicks, reach, results')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Data } = await supabase
      .from('meta_monthly_demographics')
      .select('adset_id, adset_name, spend, impressions, clicks, reach, results')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    const adsetMap = new Map<string, AdSetComparison>();

    (month1Data || []).forEach(row => {
      const name = row.adset_name || 'Unknown';
      if (!adsetMap.has(name)) {
        adsetMap.set(name, {
          name,
          adset_ids: [],
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const adset = adsetMap.get(name)!;
      if (!adset.adset_ids.includes(row.adset_id)) {
        adset.adset_ids.push(row.adset_id);
      }
      adset.month1.spend += Number(row.spend) || 0;
      adset.month1.impressions += Number(row.impressions) || 0;
      adset.month1.clicks += Number(row.clicks) || 0;
      adset.month1.reach += Number(row.reach) || 0;
      adset.month1.results += Number(row.results) || 0;
    });

    (month2Data || []).forEach(row => {
      const name = row.adset_name || 'Unknown';
      if (!adsetMap.has(name)) {
        adsetMap.set(name, {
          name,
          adset_ids: [],
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const adset = adsetMap.get(name)!;
      if (!adset.adset_ids.includes(row.adset_id)) {
        adset.adset_ids.push(row.adset_id);
      }
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

    const sorted = Array.from(adsetMap.values()).sort((a, b) =>
      (b.month1.spend + b.month2.spend) - (a.month1.spend + a.month2.spend)
    );

    setAdSetComparisons(sorted);
  };

  const fetchDemographicComparison = async () => {
    const { data: month1Data } = await supabase
      .from('meta_monthly_demographics')
      .select('*')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Data } = await supabase
      .from('meta_monthly_demographics')
      .select('*')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    const demoMap = new Map<string, DemographicComparison>();
    const genderMap = new Map<string, GenderComparison>();
    const ageMap = new Map<string, AgeComparison>();

    (month1Data || []).forEach(row => {
      const combKey = `${row.age_group}_${row.gender}`;
      if (!demoMap.has(combKey)) {
        demoMap.set(combKey, {
          age_group: row.age_group || 'unknown',
          gender: row.gender || 'unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const demo = demoMap.get(combKey)!;
      demo.month1.spend += Number(row.spend) || 0;
      demo.month1.impressions += Number(row.impressions) || 0;
      demo.month1.clicks += Number(row.clicks) || 0;
      demo.month1.reach += Number(row.reach) || 0;
      demo.month1.results += Number(row.results) || 0;

      const gender = row.gender || 'unknown';
      if (!genderMap.has(gender)) {
        genderMap.set(gender, {
          gender,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const genderData = genderMap.get(gender)!;
      genderData.month1.spend += Number(row.spend) || 0;
      genderData.month1.impressions += Number(row.impressions) || 0;
      genderData.month1.clicks += Number(row.clicks) || 0;
      genderData.month1.reach += Number(row.reach) || 0;
      genderData.month1.results += Number(row.results) || 0;

      const age = row.age_group || 'unknown';
      if (!ageMap.has(age)) {
        ageMap.set(age, {
          age_group: age,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const ageData = ageMap.get(age)!;
      ageData.month1.spend += Number(row.spend) || 0;
      ageData.month1.impressions += Number(row.impressions) || 0;
      ageData.month1.clicks += Number(row.clicks) || 0;
      ageData.month1.reach += Number(row.reach) || 0;
      ageData.month1.results += Number(row.results) || 0;
    });

    (month2Data || []).forEach(row => {
      const combKey = `${row.age_group}_${row.gender}`;
      if (!demoMap.has(combKey)) {
        demoMap.set(combKey, {
          age_group: row.age_group || 'unknown',
          gender: row.gender || 'unknown',
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const demo = demoMap.get(combKey)!;
      demo.month2.spend += Number(row.spend) || 0;
      demo.month2.impressions += Number(row.impressions) || 0;
      demo.month2.clicks += Number(row.clicks) || 0;
      demo.month2.reach += Number(row.reach) || 0;
      demo.month2.results += Number(row.results) || 0;

      const gender = row.gender || 'unknown';
      if (!genderMap.has(gender)) {
        genderMap.set(gender, {
          gender,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const genderData = genderMap.get(gender)!;
      genderData.month2.spend += Number(row.spend) || 0;
      genderData.month2.impressions += Number(row.impressions) || 0;
      genderData.month2.clicks += Number(row.clicks) || 0;
      genderData.month2.reach += Number(row.reach) || 0;
      genderData.month2.results += Number(row.results) || 0;

      const age = row.age_group || 'unknown';
      if (!ageMap.has(age)) {
        ageMap.set(age, {
          age_group: age,
          month1: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 },
          month2: { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0, ctr: 0, cpc: 0, cpm: 0 }
        });
      }
      const ageData = ageMap.get(age)!;
      ageData.month2.spend += Number(row.spend) || 0;
      ageData.month2.impressions += Number(row.impressions) || 0;
      ageData.month2.clicks += Number(row.clicks) || 0;
      ageData.month2.reach += Number(row.reach) || 0;
      ageData.month2.results += Number(row.results) || 0;
    });

    demoMap.forEach(demo => {
      demo.month1.ctr = demo.month1.impressions > 0 ? (demo.month1.clicks / demo.month1.impressions) * 100 : 0;
      demo.month1.cpc = demo.month1.clicks > 0 ? demo.month1.spend / demo.month1.clicks : 0;
      demo.month1.cpm = demo.month1.impressions > 0 ? (demo.month1.spend / demo.month1.impressions) * 1000 : 0;

      demo.month2.ctr = demo.month2.impressions > 0 ? (demo.month2.clicks / demo.month2.impressions) * 100 : 0;
      demo.month2.cpc = demo.month2.clicks > 0 ? demo.month2.spend / demo.month2.clicks : 0;
      demo.month2.cpm = demo.month2.impressions > 0 ? (demo.month2.spend / demo.month2.impressions) * 1000 : 0;
    });

    genderMap.forEach(gender => {
      gender.month1.ctr = gender.month1.impressions > 0 ? (gender.month1.clicks / gender.month1.impressions) * 100 : 0;
      gender.month1.cpc = gender.month1.clicks > 0 ? gender.month1.spend / gender.month1.clicks : 0;
      gender.month1.cpm = gender.month1.impressions > 0 ? (gender.month1.spend / gender.month1.impressions) * 1000 : 0;

      gender.month2.ctr = gender.month2.impressions > 0 ? (gender.month2.clicks / gender.month2.impressions) * 100 : 0;
      gender.month2.cpc = gender.month2.clicks > 0 ? gender.month2.spend / gender.month2.clicks : 0;
      gender.month2.cpm = gender.month2.impressions > 0 ? (gender.month2.spend / gender.month2.impressions) * 1000 : 0;
    });

    ageMap.forEach(age => {
      age.month1.ctr = age.month1.impressions > 0 ? (age.month1.clicks / age.month1.impressions) * 100 : 0;
      age.month1.cpc = age.month1.clicks > 0 ? age.month1.spend / age.month1.clicks : 0;
      age.month1.cpm = age.month1.impressions > 0 ? (age.month1.spend / age.month1.impressions) * 1000 : 0;

      age.month2.ctr = age.month2.impressions > 0 ? (age.month2.clicks / age.month2.impressions) * 100 : 0;
      age.month2.cpc = age.month2.clicks > 0 ? age.month2.spend / age.month2.clicks : 0;
      age.month2.cpm = age.month2.impressions > 0 ? (age.month2.spend / age.month2.impressions) * 1000 : 0;
    });

    setDemographicComparisons(Array.from(demoMap.values()));
    setGenderComparisons(Array.from(genderMap.values()).sort((a, b) =>
      (b.month1.spend + b.month2.spend) - (a.month1.spend + a.month2.spend)
    ));
    setAgeComparisons(Array.from(ageMap.values()).sort((a, b) =>
      (b.month1.spend + b.month2.spend) - (a.month1.spend + a.month2.spend)
    ));
  };

  const fetchPlatformComparison = async () => {
    const { data: month1Data } = await supabase
      .from('meta_platform_insights')
      .select('*')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Data } = await supabase
      .from('meta_platform_insights')
      .select('*')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

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

  const fetchResultTypeComparison = async () => {
    // Use meta_monthly_demographics for result types to match individual tabs
    const { data: month1Data } = await supabase
      .from('meta_monthly_demographics')
      .select('sales, sales_purchase, sales_add_to_cart, sales_initiate_checkout, leads, traffic, engagement, awareness, app_installs')
      .eq('account_id', accountId)
      .gte('month_year', `${month1}-01`)
      .lt('month_year', getNextMonthStart(month1));

    const { data: month2Data } = await supabase
      .from('meta_monthly_demographics')
      .select('sales, sales_purchase, sales_add_to_cart, sales_initiate_checkout, leads, traffic, engagement, awareness, app_installs')
      .eq('account_id', accountId)
      .gte('month_year', `${month2}-01`)
      .lt('month_year', getNextMonthStart(month2));

    const aggregateResultTypes = (data: any[]): Record<string, number> => {
      return data.reduce((acc, row) => ({
        // For sales, use the breakdown columns which are the source of truth
        sales: acc.sales + (Number(row.sales_purchase) || 0) + (Number(row.sales_add_to_cart) || 0) + (Number(row.sales_initiate_checkout) || 0),
        leads: acc.leads + (Number(row.leads) || 0),
        traffic: acc.traffic + (Number(row.traffic) || 0),
        engagement: acc.engagement + (Number(row.engagement) || 0),
        awareness: acc.awareness + (Number(row.awareness) || 0),
        app_installs: acc.app_installs + (Number(row.app_installs) || 0)
      }), { sales: 0, leads: 0, traffic: 0, engagement: 0, awareness: 0, app_installs: 0 });
    };

    const month1Totals = aggregateResultTypes(month1Data || []);
    const month2Totals = aggregateResultTypes(month2Data || []);

    const resultTypes: ResultTypeComparison[] = [
      { result_type: 'Sales', month1: month1Totals.sales, month2: month2Totals.sales },
      { result_type: 'Leads', month1: month1Totals.leads, month2: month2Totals.leads },
      { result_type: 'Traffic', month1: month1Totals.traffic, month2: month2Totals.traffic },
      { result_type: 'Engagement', month1: month1Totals.engagement, month2: month2Totals.engagement },
      { result_type: 'Awareness', month1: month1Totals.awareness, month2: month2Totals.awareness },
      { result_type: 'App Installs', month1: month1Totals.app_installs, month2: month2Totals.app_installs }
    ];

    setResultTypeComparisons(resultTypes);
  };

  const handleAnalyzeWithAI = async () => {
    if (!overallMonth1 || !overallMonth2) {
      setAiError('No data available for analysis');
      return;
    }

    setAnalyzingWithAI(true);
    setAiError(null);
    setAiAnalysis(null);

    try {
      const calculateChange = (oldValue: number, newValue: number) => {
        if (oldValue === 0) return newValue > 0 ? 100 : 0;
        return ((newValue - oldValue) / oldValue) * 100;
      };

      const analysisData = {
        report_context: {
          period_comparison: `${formatMonthDisplay(month1)} vs ${formatMonthDisplay(month2)}`,
          currency: 'HKD',
          primary_goal: 'Mixed (Sales, Traffic, Engagement)'
        },
        overall_performance: {
          spend: {
            prev: parseFloat(overallMonth1.spend.toFixed(2)),
            curr: parseFloat(overallMonth2.spend.toFixed(2)),
            change_pct: parseFloat(calculateChange(overallMonth1.spend, overallMonth2.spend).toFixed(1))
          },
          impressions: {
            prev: overallMonth1.impressions,
            curr: overallMonth2.impressions,
            change_pct: parseFloat(calculateChange(overallMonth1.impressions, overallMonth2.impressions).toFixed(1))
          },
          clicks: {
            prev: overallMonth1.clicks,
            curr: overallMonth2.clicks,
            change_pct: parseFloat(calculateChange(overallMonth1.clicks, overallMonth2.clicks).toFixed(1))
          },
          results: {
            prev: overallMonth1.results,
            curr: overallMonth2.results,
            change_pct: parseFloat(calculateChange(overallMonth1.results, overallMonth2.results).toFixed(1))
          },
          ctr: {
            prev: parseFloat(overallMonth1.ctr.toFixed(2)),
            curr: parseFloat(overallMonth2.ctr.toFixed(2)),
            change_pct: parseFloat(calculateChange(overallMonth1.ctr, overallMonth2.ctr).toFixed(1))
          },
          cpc: {
            prev: parseFloat(overallMonth1.cpc.toFixed(2)),
            curr: parseFloat(overallMonth2.cpc.toFixed(2)),
            change_pct: parseFloat(calculateChange(overallMonth1.cpc, overallMonth2.cpc).toFixed(1))
          },
          cpm: {
            prev: parseFloat(overallMonth1.cpm.toFixed(2)),
            curr: parseFloat(overallMonth2.cpm.toFixed(2)),
            change_pct: parseFloat(calculateChange(overallMonth1.cpm, overallMonth2.cpm).toFixed(1))
          },
          reach: {
            prev: overallMonth1.reach,
            curr: overallMonth2.reach,
            change_pct: parseFloat(calculateChange(overallMonth1.reach, overallMonth2.reach).toFixed(1))
          }
        },
        performance_by_objective: objectiveComparisons.map(obj => ({
          objective: obj.objective,
          status: obj.month2.results < obj.month1.results ? 'Declining' : 'Growing',
          data: {
            spend: { prev: parseFloat(obj.month1.spend.toFixed(2)), curr: parseFloat(obj.month2.spend.toFixed(2)) },
            results: { prev: obj.month1.results, curr: obj.month2.results },
            cpc: { prev: parseFloat(obj.month1.cpc.toFixed(2)), curr: parseFloat(obj.month2.cpc.toFixed(2)) },
            ctr: { prev: parseFloat(obj.month1.ctr.toFixed(2)), curr: parseFloat(obj.month2.ctr.toFixed(2)) }
          }
        })),
        top_campaigns: campaignComparisons.slice(0, 5).map(camp => ({
          name: camp.name,
          type: camp.objective,
          insight: camp.month2.results < camp.month1.results ?
            `Results dropped (${camp.month1.results} -> ${camp.month2.results})` :
            `Results improved (${camp.month1.results} -> ${camp.month2.results})`,
          jan_metrics: {
            spend: parseFloat(camp.month2.spend.toFixed(2)),
            results: camp.month2.results,
            cpc: parseFloat(camp.month2.cpc.toFixed(2))
          }
        })),
        ad_set_breakdown: adSetComparisons.slice(0, 5).map(adset => ({
          name: adset.name,
          trend: adset.month2.results < adset.month1.results ? 'Declining' : 'Growing',
          results: { prev: adset.month1.results, curr: adset.month2.results },
          spend: { prev: parseFloat(adset.month1.spend.toFixed(2)), curr: parseFloat(adset.month2.spend.toFixed(2)) }
        })),
        demographics_gender: genderComparisons.reduce((acc, gender) => {
          acc[gender.gender] = {
            insight: `${gender.gender} audience performance`,
            spend: parseFloat(gender.month2.spend.toFixed(2)),
            results: gender.month2.results,
            ctr: parseFloat(gender.month2.ctr.toFixed(2)),
            cpc: parseFloat(gender.month2.cpc.toFixed(2))
          };
          return acc;
        }, {} as any),
        platform_performance: platformComparisons.reduce((acc, platform) => {
          acc[platform.publisher_platform] = {
            insight: platform.month2.results > platform.month1.results ? 'Performance improved' : 'Performance declined',
            prev_spend: parseFloat(platform.month1.spend.toFixed(2)),
            curr_spend: parseFloat(platform.month2.spend.toFixed(2)),
            curr_results: platform.month2.results
          };
          return acc;
        }, {} as any)
      };

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-with-gemini`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptName: 'monthly_comparison_analysis',
          data: analysisData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to analyze data with AI';
        const detailsMessage = errorData.details ? `\n\nDetails: ${JSON.stringify(errorData.details, null, 2)}` : '';
        throw new Error(errorMessage + detailsMessage);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to analyze data with AI');
      }

      setAiAnalysis(result.analysis);
      setShowAnalysisModal(true);
    } catch (error: any) {
      console.error('Error analyzing with AI:', error);
      let errorMessage = error.message || 'Failed to analyze data with AI. Please check your Gemini API settings.';

      if (errorMessage.includes('Gemini API key not configured')) {
        errorMessage = 'Gemini API key not configured. Please add it in Marketing > Meta Ad > Settings page (gear icon).';
      } else if (errorMessage.includes('No active prompt found')) {
        errorMessage = 'Analysis prompt not configured. Please contact your administrator.';
      }

      setAiError(errorMessage);
    } finally {
      setAnalyzingWithAI(false);
    }
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Months to Compare</h3>
          <button
            onClick={handleAnalyzeWithAI}
            disabled={analyzingWithAI || !overallMonth1 || !overallMonth2}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            {analyzingWithAI ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Analyze with AI
              </>
            )}
          </button>
        </div>
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
        {aiError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-start gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <p>{aiError}</p>
          </div>
        )}
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
          onClick={() => setComparisonType('objectives')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            comparisonType === 'objectives'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          By Objective
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
        <button
          onClick={() => setComparisonType('resultTypes')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            comparisonType === 'resultTypes'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          By Result Type
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

      {comparisonType === 'objectives' && (
        <>
          {objectiveComparisons.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No objective data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch objective comparison data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Campaign Objective</th>
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
                {objectiveComparisons.map((objective) => (
                  <>
                    <tr key={`${objective.objective}-m1`} className="hover:bg-gray-50">
                      <td rowSpan={2} className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200 capitalize">
                        {objective.objective.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">HK${objective.month1.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month1.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month1.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month1.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month1.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${objective.month1.cpc.toFixed(2)}</td>
                    </tr>
                    <tr key={`${objective.objective}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-medium">HK${objective.month2.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month2.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month2.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month2.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{objective.month2.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${objective.month2.cpc.toFixed(2)}</td>
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

      {comparisonType === 'campaigns' && (() => {
        if (campaignComparisons.length === 0) {
          return (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No campaign data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch campaign comparison data</p>
            </div>
          );
        }

        const groupedByObjective = campaignComparisons.reduce((acc, campaign) => {
          const objective = campaign.objective || 'Unknown';
          if (!acc[objective]) {
            acc[objective] = [];
          }
          acc[objective].push(campaign);
          return acc;
        }, {} as Record<string, typeof campaignComparisons>);

        const objectiveTotals = Object.entries(groupedByObjective).map(([objective, campaigns]) => ({
          objective,
          month1_total_spend: campaigns.reduce((sum, c) => sum + c.month1.spend, 0),
          month2_total_spend: campaigns.reduce((sum, c) => sum + c.month2.spend, 0),
          month1_total_impressions: campaigns.reduce((sum, c) => sum + c.month1.impressions, 0),
          month2_total_impressions: campaigns.reduce((sum, c) => sum + c.month2.impressions, 0),
          month1_total_clicks: campaigns.reduce((sum, c) => sum + c.month1.clicks, 0),
          month2_total_clicks: campaigns.reduce((sum, c) => sum + c.month2.clicks, 0),
          month1_total_results: campaigns.reduce((sum, c) => sum + c.month1.results, 0),
          month2_total_results: campaigns.reduce((sum, c) => sum + c.month2.results, 0),
          campaigns: campaigns.sort((a, b) => (b.month1.spend + b.month2.spend) - (a.month1.spend + a.month2.spend))
        })).sort((a, b) => (b.month1_total_spend + b.month2_total_spend) - (a.month1_total_spend + a.month2_total_spend));

        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Campaign / Objective</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Month</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Spend</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Impressions</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Clicks</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Results</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">CTR</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">CPC</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {objectiveTotals.map(({ objective, month1_total_spend, month2_total_spend, month1_total_impressions, month2_total_impressions, month1_total_clicks, month2_total_clicks, month1_total_results, month2_total_results, campaigns }) => (
                    <>
                      <tr key={`objective-${objective}-m1`} className="bg-blue-50 border-t-2 border-blue-200">
                        <td rowSpan={2} className="px-4 py-3 font-bold text-blue-900 capitalize border-r border-blue-200">
                          {objective.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-semibold text-blue-800">{formatMonthDisplay(month1)}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">HK${month1_total_spend.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">{month1_total_impressions.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">{month1_total_clicks.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">{month1_total_results.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">
                          {month1_total_impressions > 0 ? ((month1_total_clicks / month1_total_impressions) * 100).toFixed(2) : '0.00'}%
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">
                          HK${month1_total_clicks > 0 ? (month1_total_spend / month1_total_clicks).toFixed(2) : '0.00'}
                        </td>
                      </tr>
                      <tr key={`objective-${objective}-m2`} className="bg-blue-50 border-b-2 border-blue-300">
                        <td className="px-4 py-2 text-right text-xs font-semibold text-blue-800">{formatMonthDisplay(month2)}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">HK${month2_total_spend.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">{month2_total_impressions.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">{month2_total_clicks.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">{month2_total_results.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">
                          {month2_total_impressions > 0 ? ((month2_total_clicks / month2_total_impressions) * 100).toFixed(2) : '0.00'}%
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-blue-900">
                          HK${month2_total_clicks > 0 ? (month2_total_spend / month2_total_clicks).toFixed(2) : '0.00'}
                        </td>
                      </tr>
                      {campaigns.map((campaign) => (
                        <>
                          <tr key={`${campaign.campaign_id}-m1`} className="hover:bg-gray-50 border-b border-gray-100">
                            <td rowSpan={2} className="px-4 py-2 text-gray-900 pl-8 border-r border-gray-200">{campaign.name}</td>
                            <td className="px-4 py-1.5 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">HK${campaign.month1.spend.toFixed(2)}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month1.impressions.toLocaleString()}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month1.clicks.toLocaleString()}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month1.results.toLocaleString()}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month1.ctr.toFixed(2)}%</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">HK${campaign.month1.cpc.toFixed(2)}</td>
                          </tr>
                          <tr key={`${campaign.campaign_id}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-200">
                            <td className="px-4 py-1.5 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">HK${campaign.month2.spend.toFixed(2)}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month2.impressions.toLocaleString()}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month2.clicks.toLocaleString()}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month2.results.toLocaleString()}</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">{campaign.month2.ctr.toFixed(2)}%</td>
                            <td className="px-4 py-1.5 text-right text-gray-700">HK${campaign.month2.cpc.toFixed(2)}</td>
                          </tr>
                        </>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
                {adSetComparisons.map((adset, idx) => (
                  <>
                    <tr key={`${adset.name}-${idx}-m1`} className="hover:bg-gray-50">
                      <td rowSpan={2} className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">
                        <div>{adset.name}</div>
                        {adset.adset_ids.length > 1 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {adset.adset_ids.length} ad sets grouped
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">HK${adset.month1.spend.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.results.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{adset.month1.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-700">HK${adset.month1.cpc.toFixed(2)}</td>
                    </tr>
                    <tr key={`${adset.name}-${idx}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
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
          {demographicComparisons.length === 0 && genderComparisons.length === 0 && ageComparisons.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No demographic data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch demographic comparison data</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setDemographicView('gender')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    demographicView === 'gender' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  By Gender
                </button>
                <button
                  onClick={() => setDemographicView('age')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    demographicView === 'age' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  By Age
                </button>
                <button
                  onClick={() => setDemographicView('combined')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    demographicView === 'combined' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Combined
                </button>
              </div>

              {demographicView === 'gender' && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Gender</th>
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
                        {genderComparisons.map((gender, idx) => (
                          <>
                            <tr key={`${idx}-m1`} className="hover:bg-gray-50">
                              <td rowSpan={2} className="px-4 py-3 border-r border-gray-200">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  gender.gender === 'male' ? 'bg-blue-100 text-blue-800' :
                                  gender.gender === 'female' ? 'bg-pink-100 text-pink-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {gender.gender === 'male' ? 'Male' : gender.gender === 'female' ? 'Female' : 'Unknown'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                              <td className="px-4 py-2 text-right text-gray-900">HK${gender.month1.spend.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month1.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month1.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month1.results.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month1.ctr.toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-gray-700">HK${gender.month1.cpc.toFixed(2)}</td>
                            </tr>
                            <tr key={`${idx}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                              <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                              <td className="px-4 py-2 text-right text-gray-900 font-medium">HK${gender.month2.spend.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month2.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month2.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month2.results.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{gender.month2.ctr.toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-gray-700">HK${gender.month2.cpc.toFixed(2)}</td>
                            </tr>
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {demographicView === 'age' && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Age Group</th>
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
                        {ageComparisons.map((age, idx) => (
                          <>
                            <tr key={`${idx}-m1`} className="hover:bg-gray-50">
                              <td rowSpan={2} className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">{age.age_group}</td>
                              <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                              <td className="px-4 py-2 text-right text-gray-900">HK${age.month1.spend.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month1.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month1.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month1.results.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month1.ctr.toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-gray-700">HK${age.month1.cpc.toFixed(2)}</td>
                            </tr>
                            <tr key={`${idx}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                              <td className="px-4 py-2 text-right text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                              <td className="px-4 py-2 text-right text-gray-900 font-medium">HK${age.month2.spend.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month2.impressions.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month2.clicks.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month2.results.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-700">{age.month2.ctr.toFixed(2)}%</td>
                              <td className="px-4 py-2 text-right text-gray-700">HK${age.month2.cpc.toFixed(2)}</td>
                            </tr>
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {demographicView === 'combined' && (
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

      {comparisonType === 'resultTypes' && (
        <>
          {resultTypeComparisons.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No result type data available</p>
              <p className="text-sm text-gray-500">Use "Sync Monthly Reports" to fetch data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Result Type</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Month</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Total Results</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Change</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {resultTypeComparisons.map((resultType) => {
                      const change = resultType.month1 > 0
                        ? ((resultType.month2 - resultType.month1) / resultType.month1) * 100
                        : resultType.month2 > 0 ? 100 : 0;
                      const isPositive = change >= 0;

                      return (
                        <>
                          <tr key={`${resultType.result_type}-m1`} className="hover:bg-gray-50">
                            <td rowSpan={2} className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">
                              {resultType.result_type}
                            </td>
                            <td className="px-4 py-2 text-center text-xs text-gray-500">{formatMonthDisplay(month1)}</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-medium text-lg">
                              {resultType.month1.toLocaleString()}
                            </td>
                            <td rowSpan={2} className="px-4 py-3 text-right border-l border-gray-200">
                              <div className="flex items-center justify-end gap-2">
                                {isPositive ? (
                                  <ArrowUp className="text-green-600" size={18} />
                                ) : (
                                  <ArrowDown className="text-red-600" size={18} />
                                )}
                                <span className={`font-semibold text-lg ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {Math.abs(change).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                          <tr key={`${resultType.result_type}-m2`} className="hover:bg-gray-50 border-b-2 border-gray-300">
                            <td className="px-4 py-2 text-center text-xs text-gray-500">{formatMonthDisplay(month2)}</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-bold text-lg">
                              {resultType.month2.toLocaleString()}
                            </td>
                          </tr>
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showAnalysisModal && aiAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600">
              <div className="flex items-center gap-3">
                <Sparkles className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">AI Analysis Report</h2>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              <div className="prose prose-sm max-w-none">
                <div
                  className="text-gray-800 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: aiAnalysis
                      .replace(/### (.*?)(\n|$)/g, '<h3 class="text-lg font-bold mt-6 mb-3 text-gray-900">$1</h3>')
                      .replace(/## (.*?)(\n|$)/g, '<h2 class="text-xl font-bold mt-8 mb-4 text-gray-900">$1</h2>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                      .replace(/\* (.*?)(\n|$)/g, '<li class="ml-4">$1</li>')
                      .replace(/🔴 STOP:/g, '<span class="inline-block px-2 py-1 bg-red-100 text-red-800 rounded font-semibold">🔴 STOP:</span>')
                      .replace(/🟢 START:/g, '<span class="inline-block px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">🟢 START:</span>')
                      .replace(/🔵 SCALE:/g, '<span class="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded font-semibold">🔵 SCALE:</span>')
                      .replace(/\n\n/g, '<br/><br/>')
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
