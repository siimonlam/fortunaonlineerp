import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Plus, RefreshCw, Trash2, ExternalLink, TrendingUp, DollarSign, Eye, MousePointer, Filter, ChevronDown, Calendar } from 'lucide-react';
import MonthlyPerformanceChart from './MonthlyPerformanceChart';
import MonthlyComparison from './MonthlyComparison';
import CreativePerformanceGallery from './CreativePerformanceGallery';

// Helper function to get the next month in YYYY-MM format
const getNextMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
};

// Helper function to get priority action types based on campaign objective
const getPriorityActionTypes = (objective: string | null): string[] => {
  if (!objective) return [];

  switch (objective.toUpperCase()) {
    case 'OUTCOME_TRAFFIC':
    case 'LINK_CLICKS':
      return ['link_click', 'landing_page_view'];

    case 'OUTCOME_ENGAGEMENT':
    case 'POST_ENGAGEMENT':
    case 'PAGE_LIKES':
      return ['post_engagement', 'page_engagement'];

    case 'OUTCOME_LEADS':
    case 'LEAD_GENERATION':
      return ['lead', 'onsite_conversion.lead_grouped'];

    case 'OUTCOME_SALES':
    case 'CONVERSIONS':
      return ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];

    case 'OUTCOME_APP_PROMOTION':
    case 'APP_INSTALLS':
    case 'MOBILE_APP_INSTALLS':
      return ['app_install', 'mobile_app_install'];

    case 'VIDEO_VIEWS':
      return ['video_view'];

    case 'BRAND_AWARENESS':
    case 'OUTCOME_AWARENESS':
    case 'REACH':
      return ['reach', 'estimated_ad_recallers'];

    case 'MESSAGES':
      return ['onsite_conversion.messaging_conversation_started_7d'];

    default:
      return [];
  }
};

// Helper function to get display name for action types
const getActionDisplayName = (actionType: string): string => {
  // Map technical action types to user-friendly display names
  const displayNameMap: Record<string, string> = {
    // Purchase actions - all consolidate to "Purchase"
    'purchase': 'Purchase',
    'offsite_conversion.fb_pixel_purchase': 'Purchase',
    'omni_purchase': 'Purchase',

    // Link clicks
    'link_click': 'Link Click',
    'outbound_click': 'Link Click',

    // Landing page views
    'landing_page_view': 'Landing Page View',

    // Engagement actions - keep separate
    'post_engagement': 'Post Engagement',
    'page_engagement': 'Page Engagement',
    'like': 'Like',
    'post_reaction': 'Reaction',
    'comment': 'Comment',
    'post': 'Post',
    'onsite_conversion.post_save': 'Post Save',

    // Leads
    'lead': 'Lead',
    'onsite_conversion.lead_grouped': 'Lead',

    // Video views
    'video_view': 'Video View',

    // App installs
    'app_install': 'App Install',
    'mobile_app_install': 'App Install',

    // Awareness
    'reach': 'Reach',
    'estimated_ad_recallers': 'Estimated Ad Recalls',

    // Messages
    'onsite_conversion.messaging_conversation_started_7d': 'Messaging Conversations'
  };

  return displayNameMap[actionType] || actionType;
};


interface MarketingMetaAdSectionProps {
  projectId: string;
  clientNumber: string | null;
}

interface MetaAdAccount {
  account_id: string;
  account_name: string;
  currency: string;
  account_status: number;
  business_name: string;
}

interface LinkedAccount {
  id: string;
  account_id: string;
  meta_ad_accounts: MetaAdAccount;
}

interface CampaignMetrics {
  campaign_id: string;
  name: string;
  status: string;
  objective: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_results: number;
  result_types: string;
  action_breakdown: Record<string, number>;
  avg_ctr: number;
  avg_cpc: number;
}

interface DemographicBreakdown {
  age: string;
  gender: string;
  country: string;
  impressions: number;
  clicks: number;
  spend: number;
  results: number;
  sales: number;
  leads: number;
  traffic: number;
  engagement: number;
  awareness: number;
  app_installs: number;
}

interface AdSetMetrics {
  adset_id: string;
  name: string;
  status: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_results: number;
  total_sales: number;
  total_leads: number;
  total_traffic: number;
  total_engagement: number;
  total_awareness: number;
  total_app_installs: number;
}

interface CreativeMetrics {
  creative_id: string;
  name: string;
  title: string;
  ad_format: string;
  link_url: string | null;
  effective_object_url: string | null;
  image_url: string | null;
  video_id: string | null;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_results: number;
  total_sales: number;
  total_leads: number;
  total_traffic: number;
  total_engagement: number;
  total_awareness: number;
  total_app_installs: number;
  total_reach: number;
  avg_ctr: number;
  avg_cpc: number;
  roi: number;
  roas: number;
}

interface PlatformMetrics {
  publisher_platform: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_results: number;
  total_reach: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpm: number;
  total_sales: number;
  total_leads: number;
  total_traffic: number;
  total_engagement: number;
  total_awareness: number;
  total_app_installs: number;
}

export default function MarketingMetaAdSection({ projectId, clientNumber }: MarketingMetaAdSectionProps) {
  const [availableAccounts, setAvailableAccounts] = useState<MetaAdAccount[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [demographics, setDemographics] = useState<DemographicBreakdown[]>([]);
  const [adSets, setAdSets] = useState<AdSetMetrics[]>([]);
  const [creatives, setCreatives] = useState<CreativeMetrics[]>([]);
  const [platforms, setPlatforms] = useState<PlatformMetrics[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [reportView, setReportView] = useState<'monthly' | 'campaigns' | 'demographics' | 'adsets' | 'creatives' | 'platform' | 'comparison'>('monthly');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  const [monthlyReportResults, setMonthlyReportResults] = useState<any>(null);
  const [syncingMonthly, setSyncingMonthly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [demographicView, setDemographicView] = useState<'age' | 'gender' | 'all'>('age');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedAccountForView, setSelectedAccountForView] = useState<string>('');
  const [comparisonMonth1, setComparisonMonth1] = useState('');
  const [comparisonMonth2, setComparisonMonth2] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    if (selectedAccountForView) {
      loadCampaignMetrics(selectedAccountForView);
    }
  }, [selectedMonth, selectedAccountForView]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [accountsRes, linkedRes] = await Promise.all([
        supabase.from('meta_ad_accounts').select('*'),
        supabase
          .from('marketing_meta_ad_accounts')
          .select('*, meta_ad_accounts(*)')
          .eq('marketing_project_id', projectId)
      ]);

      if (accountsRes.data) setAvailableAccounts(accountsRes.data);
      if (linkedRes.data) {
        setLinkedAccounts(linkedRes.data as LinkedAccount[]);

        const accountIds = linkedRes.data.map((l: any) => l.account_id);
        if (accountIds.length > 0) {
          if (!selectedAccountForView && accountIds.length > 0) {
            setSelectedAccountForView(accountIds[0]);
          }
          loadAvailableMonths(accountIds);
          loadCampaignMetrics(selectedAccountForView || accountIds[0]);
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableMonths = async (accountIds: string[]) => {
    try {
      const { data } = await supabase
        .from('meta_monthly_insights')
        .select('month_year')
        .in('account_id', accountIds)
        .order('month_year', { ascending: false })
        .limit(10000);

      if (data) {
        const uniqueMonths = Array.from(new Set(data.map(d => {
          const date = new Date(d.month_year);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        })));
        setAvailableMonths(uniqueMonths);
      }
    } catch (err: any) {
      console.error('Error loading available months:', err);
    }
  };

  const loadCampaignMetrics = async (accountId: string) => {
    try {
      let monthStart: string;
      let monthEnd: string;

      // Handle special date ranges
      if (selectedMonth === 'last_6_months') {
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        monthStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
        monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}-01`;
      } else if (selectedMonth === 'last_12_months') {
        const today = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(today.getMonth() - 12);
        monthStart = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
        monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}-01`;
      } else {
        // Parse selected month
        const [year, month] = selectedMonth.split('-');
        monthStart = `${year}-${month}-01`;

        // Calculate next month (handle December -> January of next year)
        const currentMonth = Number(month);
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextYear = currentMonth === 12 ? Number(year) + 1 : Number(year);
        monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      }

      // Query monthly insights for the selected time range
      const { data: monthlyData } = await supabase
        .from('meta_monthly_insights')
        .select('*')
        .eq('account_id', accountId)
        .gte('month_year', monthStart)
        .lt('month_year', monthEnd)
        .limit(10000);

      if (!monthlyData || monthlyData.length === 0) {
        setCampaigns([]);
        setAdSets([]);
        setCreatives([]);
        setDemographics([]);
        return;
      }

      // Fetch campaign metadata (objective, status)
      const campaignIds = [...new Set(monthlyData.map(d => d.campaign_id).filter(Boolean))];
      const { data: campaignData } = await supabase
        .from('meta_campaigns')
        .select('campaign_id, objective, status')
        .in('campaign_id', campaignIds);

      const campaignMetadataMap = new Map(
        (campaignData || []).map(c => [c.campaign_id, { objective: c.objective, status: c.status }])
      );

      // Aggregate by campaign
      const campaignMap = new Map<string, any>();

      monthlyData.forEach((insight) => {
        if (!insight.campaign_id) return;

        if (!campaignMap.has(insight.campaign_id)) {
          const metadata = campaignMetadataMap.get(insight.campaign_id);
          campaignMap.set(insight.campaign_id, {
            campaign_id: insight.campaign_id,
            name: insight.campaign_name,
            account_id: insight.account_id,
            status: metadata?.status || 'UNKNOWN',
            objective: metadata?.objective || 'UNKNOWN',
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_conversions: 0,
            total_results: 0,
            result_type_set: new Set<string>(),
            action_breakdown: new Map<string, number>(),
            avg_ctr: 0,
            avg_cpc: 0,
            count: 0
          });
        }

        const campaign = campaignMap.get(insight.campaign_id);
        campaign.total_spend += Number(insight.spend) || 0;
        campaign.total_impressions += Number(insight.impressions) || 0;
        campaign.total_clicks += Number(insight.clicks) || 0;
        campaign.total_conversions += Number(insight.conversions) || 0;
        campaign.avg_ctr += Number(insight.ctr) || 0;
        campaign.avg_cpc += Number(insight.cpc) || 0;
        campaign.count += 1;

        // Special handling for OUTCOME_SALES: Show ALL THREE sales breakdown types
        const upperObjective = campaign.objective?.toUpperCase() || '';
        if (upperObjective === 'OUTCOME_SALES' || upperObjective === 'CONVERSIONS') {
          // Use dedicated sales columns to show the breakdown
          const purchase = Number(insight.sales_purchase) || 0;
          const addToCart = Number(insight.sales_add_to_cart) || 0;
          const initiateCheckout = Number(insight.sales_initiate_checkout) || 0;

          // For OUTCOME_SALES, total_results = sum of all three sales metrics
          campaign.total_results += purchase + addToCart + initiateCheckout;

          if (purchase > 0) {
            const currentCount = campaign.action_breakdown.get('Purchase') || 0;
            campaign.action_breakdown.set('Purchase', currentCount + purchase);
            campaign.result_type_set.add('Purchase');
          }
          if (addToCart > 0) {
            const currentCount = campaign.action_breakdown.get('Add to Cart') || 0;
            campaign.action_breakdown.set('Add to Cart', currentCount + addToCart);
            campaign.result_type_set.add('Add to Cart');
          }
          if (initiateCheckout > 0) {
            const currentCount = campaign.action_breakdown.get('Initiate Checkout') || 0;
            campaign.action_breakdown.set('Initiate Checkout', currentCount + initiateCheckout);
            campaign.result_type_set.add('Initiate Checkout');
          }
        } else {
          // For non-sales objectives, use the standard results field
          campaign.total_results += Number(insight.results) || 0;
          // For non-sales objectives: Parse actions JSON to get the PRIMARY action only
          if (insight.actions) {
            try {
              const actions = typeof insight.actions === 'string' ? JSON.parse(insight.actions) : insight.actions;
              if (Array.isArray(actions)) {
                // Get priority action types for this campaign's objective
                const priorityActions = getPriorityActionTypes(campaign.objective);

                // Find the FIRST priority action with value > 0 (highest priority only)
                for (const priorityActionType of priorityActions) {
                  const action = actions.find((a: any) => a.action_type === priorityActionType);
                  if (action) {
                    const value = parseInt(action.value || '0');
                    if (value > 0) {
                      // Found the primary action - use it and STOP
                      const displayName = getActionDisplayName(priorityActionType);
                      const currentCount = campaign.action_breakdown.get(displayName) || 0;
                      campaign.action_breakdown.set(displayName, currentCount + value);
                      campaign.result_type_set.add(displayName);

                      // CRITICAL: Stop here - don't look for other actions
                      break;
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing actions:', e);
            }
          }
        }
      });

      const metrics = Array.from(campaignMap.values()).map(campaign => ({
        ...campaign,
        avg_ctr: campaign.count > 0 ? campaign.avg_ctr / campaign.count : 0,
        avg_cpc: campaign.count > 0 ? campaign.avg_cpc / campaign.count : 0,
        result_types: Array.from(campaign.result_type_set || []).join(', '),
        action_breakdown: Object.fromEntries(campaign.action_breakdown || new Map())
      }));

      setCampaigns(metrics);

      if (metrics.length > 0) {
        loadAdSets(accountId, monthStart, monthEnd);
        // Pass the campaign IDs to filter demographics, creatives, and platforms
        const visibleCampaignIds = Array.from(campaignMap.keys());
        loadDemographics(accountId, visibleCampaignIds, monthStart, monthEnd);
        loadCreatives(accountId, visibleCampaignIds, monthStart, monthEnd);
        loadPlatforms(accountId, visibleCampaignIds, monthStart, monthEnd);
      } else {
        setAdSets([]);
        setDemographics([]);
        setCreatives([]);
        setPlatforms([]);
      }
    } catch (err: any) {
      console.error('Error loading campaign metrics:', err);
    }
  };

  const loadDemographics = async (accountId: string, campaignIds?: string[], monthStart?: string, monthEnd?: string) => {
    try {
      if (!campaignIds || campaignIds.length === 0) {
        setDemographics([]);
        return;
      }

      const { data: demographics, error: demographicsError } = await supabase
        .from('meta_monthly_demographics')
        .select('campaign_id, age_group, gender, country, impressions, clicks, spend, reach, results, conversions, sales, sales_purchase, sales_add_to_cart, sales_initiate_checkout, leads, traffic, engagement, awareness, app_installs')
        .eq('account_id', accountId)
        .in('campaign_id', campaignIds)
        .gte('month_year', monthStart || '2000-01-01')
        .lt('month_year', monthEnd || '2099-12-31')
        .limit(10000);

      if (demographicsError) {
        console.error('Error fetching demographic data:', demographicsError);
        setDemographics([]);
        return;
      }

      if (!demographics || demographics.length === 0) {
        setDemographics([]);
        return;
      }

      const aggregated = demographics.reduce((acc: any, demo: any) => {
        const key = `${demo.age_group || 'unknown'}_${demo.gender || 'unknown'}_${demo.country || 'unknown'}`;
        if (!acc[key]) {
          acc[key] = {
            age: demo.age_group || 'Unknown',
            gender: demo.gender || 'Unknown',
            country: demo.country || 'Unknown',
            impressions: 0,
            clicks: 0,
            spend: 0,
            results: 0,
            sales: 0,
            leads: 0,
            traffic: 0,
            engagement: 0,
            awareness: 0,
            app_installs: 0
          };
        }
        acc[key].impressions += Number(demo.impressions) || 0;
        acc[key].clicks += Number(demo.clicks) || 0;
        acc[key].spend += Number(demo.spend) || 0;
        acc[key].results += Number(demo.results) || 0;
        acc[key].sales += Number(demo.sales) || 0;
        acc[key].leads += Number(demo.leads) || 0;
        acc[key].traffic += Number(demo.traffic) || 0;
        acc[key].engagement += Number(demo.engagement) || 0;
        acc[key].awareness += Number(demo.awareness) || 0;
        acc[key].app_installs += Number(demo.app_installs) || 0;
        return acc;
      }, {});

      setDemographics(Object.values(aggregated));
    } catch (err: any) {
      console.error('Error loading demographics:', err);
    }
  };

  const getAggregatedDemographics = () => {
    if (demographicView === 'age') {
      const ageAggregated = demographics.reduce((acc: any, demo: any) => {
        const key = demo.age;
        if (!acc[key]) {
          acc[key] = {
            age: demo.age,
            impressions: 0,
            clicks: 0,
            spend: 0,
            results: 0,
            sales: 0,
            leads: 0,
            traffic: 0,
            engagement: 0,
            awareness: 0,
            app_installs: 0
          };
        }
        acc[key].impressions += demo.impressions;
        acc[key].clicks += demo.clicks;
        acc[key].spend += demo.spend;
        acc[key].results += demo.results;
        acc[key].sales += demo.sales;
        acc[key].leads += demo.leads;
        acc[key].traffic += demo.traffic;
        acc[key].engagement += demo.engagement;
        acc[key].awareness += demo.awareness;
        acc[key].app_installs += demo.app_installs;
        return acc;
      }, {});
      return Object.values(ageAggregated);
    } else if (demographicView === 'gender') {
      const genderAggregated = demographics.reduce((acc: any, demo: any) => {
        const key = demo.gender;
        if (!acc[key]) {
          acc[key] = {
            gender: demo.gender,
            impressions: 0,
            clicks: 0,
            spend: 0,
            results: 0,
            sales: 0,
            leads: 0,
            traffic: 0,
            engagement: 0,
            awareness: 0,
            app_installs: 0
          };
        }
        acc[key].impressions += demo.impressions;
        acc[key].clicks += demo.clicks;
        acc[key].spend += demo.spend;
        acc[key].results += demo.results;
        acc[key].sales += demo.sales;
        acc[key].leads += demo.leads;
        acc[key].traffic += demo.traffic;
        acc[key].engagement += demo.engagement;
        acc[key].awareness += demo.awareness;
        acc[key].app_installs += demo.app_installs;
        return acc;
      }, {});
      return Object.values(genderAggregated);
    }
    return demographics;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = (data: any[]) => {
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const getSortedCampaigns = (campaignsList: CampaignMetrics[]) => {
    return getSortedData(campaignsList) as CampaignMetrics[];
  };

  const loadAdSets = async (accountId: string, monthStart: string, monthEnd: string) => {
    try {
      if (!accountId) {
        setAdSets([]);
        return;
      }

      // Fetch ad sets directly from demographics table, grouping by adset_name
      const { data: demographicsData } = await supabase
        .from('meta_monthly_demographics')
        .select('adset_id, adset_name, campaign_id, spend, impressions, clicks, reach, results, conversions, sales, sales_purchase, sales_add_to_cart, sales_initiate_checkout, leads, traffic, engagement, awareness, app_installs')
        .eq('account_id', accountId)
        .gte('month_year', monthStart)
        .lt('month_year', monthEnd);

      if (!demographicsData || demographicsData.length === 0) {
        setAdSets([]);
        return;
      }

      // Group by adset_name (aggregating all demographic breakdowns for each ad set)
      const adsetNameMap = new Map<string, any>();

      demographicsData.forEach((demo) => {
        const adsetName = demo.adset_name || `Ad Set ${demo.adset_id?.slice(-6) || 'Unknown'}`;

        if (!adsetNameMap.has(adsetName)) {
          adsetNameMap.set(adsetName, {
            adset_id: demo.adset_id,
            name: adsetName,
            campaign_id: demo.campaign_id,
            status: 'ACTIVE',
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_results: 0,
            total_sales: 0,
            total_leads: 0,
            total_traffic: 0,
            total_engagement: 0,
            total_awareness: 0,
            total_app_installs: 0
          });
        }

        const adset = adsetNameMap.get(adsetName);

        // Aggregate metrics across all demographic segments
        adset.total_spend += Number(demo.spend) || 0;
        adset.total_impressions += Number(demo.impressions) || 0;
        adset.total_clicks += Number(demo.clicks) || 0;
        adset.total_results += Number(demo.results) || 0;

        // Aggregate objective-specific metrics
        adset.total_sales += Number(demo.sales) || 0;
        adset.total_leads += Number(demo.leads) || 0;
        adset.total_traffic += Number(demo.traffic) || 0;
        adset.total_engagement += Number(demo.engagement) || 0;
        adset.total_awareness += Number(demo.awareness) || 0;
        adset.total_app_installs += Number(demo.app_installs) || 0;
      });

      const metrics = Array.from(adsetNameMap.values());
      setAdSets(metrics);
    } catch (err: any) {
      console.error('Error loading ad sets:', err);
    }
  };

  const loadCreatives = async (accountId: string, campaignIds?: string[], monthStart?: string, monthEnd?: string) => {
    try {
      if (!campaignIds || campaignIds.length === 0) {
        setCreatives([]);
        return;
      }

      // Get all insights for this account in the selected period with objective-specific result columns
      const { data: insightsData } = await supabase
        .from('meta_ad_insights')
        .select('ad_id, campaign_id, spend, impressions, clicks, results, sales, leads, traffic, engagement, awareness, app_installs, reach, ctr, cpc, conversions, conversion_values')
        .eq('account_id', accountId)
        .in('campaign_id', campaignIds)
        .gte('date', monthStart || '2000-01-01')
        .lte('date', monthEnd || '2099-12-31')
        .limit(50000);

      if (!insightsData || insightsData.length === 0) {
        setCreatives([]);
        return;
      }

      // Get unique ad IDs
      const adIds = [...new Set(insightsData.map(i => i.ad_id))];

      // Get ads with their creative IDs and campaign IDs
      const { data: adsData } = await supabase
        .from('meta_ads')
        .select('ad_id, creative_id, campaign_id')
        .in('ad_id', adIds);

      if (!adsData || adsData.length === 0) {
        setCreatives([]);
        return;
      }

      // Get unique creative IDs
      const creativeIds = [...new Set(adsData.map(a => a.creative_id).filter(Boolean))];

      if (creativeIds.length === 0) {
        setCreatives([]);
        return;
      }

      // Fetch creative details with all fields
      const { data: creativesData } = await supabase
        .from('meta_ad_creatives')
        .select('creative_id, name, title, ad_format, link_url, effective_object_url, image_url, video_id')
        .in('creative_id', creativeIds);

      const creativeMap = new Map((creativesData || []).map(c => [c.creative_id, c]));
      const adToCreativeMap = new Map(adsData.map(a => [a.ad_id, { creative_id: a.creative_id, campaign_id: a.campaign_id }]));

      // Aggregate metrics by creative
      const creativeMetricsMap = new Map<string, any>();

      insightsData.forEach(insight => {
        const adInfo = adToCreativeMap.get(insight.ad_id);
        if (!adInfo) return;

        const creativeId = adInfo.creative_id;

        if (!creativeMetricsMap.has(creativeId)) {
          const creativeInfo = creativeMap.get(creativeId);
          creativeMetricsMap.set(creativeId, {
            creative_id: creativeId,
            name: creativeInfo?.name || `Creative ${creativeId.slice(-6)}`,
            title: creativeInfo?.title || '',
            ad_format: creativeInfo?.ad_format || 'unknown',
            link_url: creativeInfo?.link_url || null,
            effective_object_url: creativeInfo?.effective_object_url || null,
            image_url: creativeInfo?.image_url || null,
            video_id: creativeInfo?.video_id || null,
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_results: 0,
            total_sales: 0,
            total_leads: 0,
            total_traffic: 0,
            total_engagement: 0,
            total_awareness: 0,
            total_app_installs: 0,
            total_reach: 0,
            total_conversions: 0,
            total_conversion_values: 0,
            ctr_sum: 0,
            cpc_sum: 0,
            count: 0
          });
        }

        const creative = creativeMetricsMap.get(creativeId);
        creative.total_spend += Number(insight.spend) || 0;
        creative.total_impressions += Number(insight.impressions) || 0;
        creative.total_clicks += Number(insight.clicks) || 0;
        creative.total_results += Number(insight.results) || 0;
        creative.total_sales += Number(insight.sales) || 0;
        creative.total_leads += Number(insight.leads) || 0;
        creative.total_traffic += Number(insight.traffic) || 0;
        creative.total_engagement += Number(insight.engagement) || 0;
        creative.total_awareness += Number(insight.awareness) || 0;
        creative.total_app_installs += Number(insight.app_installs) || 0;
        creative.total_reach += Number(insight.reach) || 0;
        creative.total_conversions += Number(insight.conversions) || 0;
        creative.total_conversion_values += Number(insight.conversion_values) || 0;
        creative.ctr_sum += Number(insight.ctr) || 0;
        creative.cpc_sum += Number(insight.cpc) || 0;
        creative.count += 1;
      });

      // Calculate averages, ROI, and ROAS
      const metrics: CreativeMetrics[] = Array.from(creativeMetricsMap.values()).map(creative => {
        const avgCtr = creative.count > 0 ? creative.ctr_sum / creative.count : 0;
        const avgCpc = creative.count > 0 ? creative.cpc_sum / creative.count : 0;
        const roi = creative.total_spend > 0 ? ((creative.total_conversions * 100 - creative.total_spend) / creative.total_spend) : 0;
        const roas = creative.total_spend > 0 ? (creative.total_conversion_values / creative.total_spend) : 0;

        return {
          creative_id: creative.creative_id,
          name: creative.name,
          title: creative.title,
          ad_format: creative.ad_format,
          link_url: creative.link_url,
          effective_object_url: creative.effective_object_url,
          image_url: creative.image_url,
          video_id: creative.video_id,
          total_spend: creative.total_spend,
          total_impressions: creative.total_impressions,
          total_clicks: creative.total_clicks,
          total_results: creative.total_results,
          total_sales: creative.total_sales,
          total_leads: creative.total_leads,
          total_traffic: creative.total_traffic,
          total_engagement: creative.total_engagement,
          total_awareness: creative.total_awareness,
          total_app_installs: creative.total_app_installs,
          total_reach: creative.total_reach,
          avg_ctr: avgCtr,
          avg_cpc: avgCpc,
          roi: roi,
          roas: roas
        };
      });

      setCreatives(metrics);
    } catch (err: any) {
      console.error('Error loading creatives:', err);
      setCreatives([]);
    }
  };

  const loadPlatforms = async (accountId: string, campaignIds?: string[], monthStart?: string, monthEnd?: string) => {
    try {
      if (!campaignIds || campaignIds.length === 0) {
        setPlatforms([]);
        return;
      }

      const { data: platformData } = await supabase
        .from('meta_platform_insights')
        .select('*')
        .eq('account_id', accountId)
        .in('campaign_id', campaignIds)
        .gte('month_year', monthStart || '2000-01-01')
        .lt('month_year', monthEnd || '2099-12-31')
        .limit(10000);

      if (!platformData || platformData.length === 0) {
        setPlatforms([]);
        return;
      }

      // Aggregate by platform
      const platformMap = new Map<string, any>();

      platformData.forEach((insight) => {
        const platform = insight.publisher_platform;

        if (!platformMap.has(platform)) {
          platformMap.set(platform, {
            publisher_platform: platform,
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_results: 0,
            total_reach: 0,
            total_sales: 0,
            total_leads: 0,
            total_traffic: 0,
            total_engagement: 0,
            total_awareness: 0,
            total_app_installs: 0,
            ctr_sum: 0,
            cpc_sum: 0,
            cpm_sum: 0,
            count: 0
          });
        }

        const p = platformMap.get(platform);
        p.total_spend += Number(insight.spend) || 0;
        p.total_impressions += Number(insight.impressions) || 0;
        p.total_clicks += Number(insight.clicks) || 0;
        p.total_results += Number(insight.results) || 0;
        p.total_reach += Number(insight.reach) || 0;
        p.total_sales += Number(insight.sales) || 0;
        p.total_leads += Number(insight.leads) || 0;
        p.total_traffic += Number(insight.traffic) || 0;
        p.total_engagement += Number(insight.engagement) || 0;
        p.total_awareness += Number(insight.awareness) || 0;
        p.total_app_installs += Number(insight.app_installs) || 0;
        p.ctr_sum += Number(insight.ctr) || 0;
        p.cpc_sum += Number(insight.cpc) || 0;
        p.cpm_sum += Number(insight.cpm) || 0;
        p.count += 1;
      });

      const metrics: PlatformMetrics[] = Array.from(platformMap.values()).map(p => ({
        publisher_platform: p.publisher_platform,
        total_spend: p.total_spend,
        total_impressions: p.total_impressions,
        total_clicks: p.total_clicks,
        total_results: p.total_results,
        total_reach: p.total_reach,
        total_sales: p.total_sales,
        total_leads: p.total_leads,
        total_traffic: p.total_traffic,
        total_engagement: p.total_engagement,
        total_awareness: p.total_awareness,
        total_app_installs: p.total_app_installs,
        avg_ctr: p.count > 0 ? p.ctr_sum / p.count : 0,
        avg_cpc: p.count > 0 ? p.cpc_sum / p.count : 0,
        avg_cpm: p.count > 0 ? p.cpm_sum / p.count : 0
      }));

      setPlatforms(metrics);
    } catch (err: any) {
      console.error('Error loading platforms:', err);
      setPlatforms([]);
    }
  };

  const handleAddAccount = async () => {
    if (!selectedAccountId) return;

    try {
      const { error } = await supabase
        .from('marketing_meta_ad_accounts')
        .insert({
          marketing_project_id: projectId,
          account_id: selectedAccountId,
          client_number: clientNumber,
          marketing_reference: projectId
        });

      if (error) throw error;

      setShowAddModal(false);
      setSelectedAccountId('');
      await loadData();
    } catch (err: any) {
      console.error('Error adding account:', err);
      alert('Error adding account: ' + err.message);
    }
  };

  const handleRemoveAccount = async (linkId: string) => {
    if (!confirm('Remove this ad account from the project?')) return;

    try {
      const { error } = await supabase
        .from('marketing_meta_ad_accounts')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error removing account:', err);
      alert('Error removing account: ' + err.message);
    }
  };

  const handleSyncAccounts = async () => {
    setSyncing(true);
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_access_token')
        .maybeSingle();

      if (!settings?.value) {
        alert('Meta Ads access token not configured. Please go to Admin → Meta Ads to set it up.');
        return;
      }

      const { data: accountIdsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_account_ids')
        .maybeSingle();

      if (!accountIdsData?.value) {
        alert('No ad account IDs configured. Please go to Admin → Meta Ads to set them up.');
        return;
      }

      const accountIds = accountIdsData.value.split(',').map((id: string) => id.trim()).filter((id: string) => id);
      let syncedCount = 0;

      for (const accountId of accountIds) {
        const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
        const url = `https://graph.facebook.com/v21.0/${formattedId}?fields=id,name,currency,account_status,timezone_name,business{id,name}&access_token=${settings.value}`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();

        await supabase
          .from('meta_ad_accounts')
          .upsert({
            account_id: data.id.replace('act_', ''),
            account_name: data.name,
            currency: data.currency,
            account_status: data.account_status,
            timezone_name: data.timezone_name,
            business_id: data.business?.id,
            business_name: data.business?.name,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'account_id'
          });

        syncedCount++;
      }

      alert(`Successfully synced ${syncedCount} ad account(s)`);
      await loadData();
    } catch (err: any) {
      console.error('Error syncing accounts:', err);
      alert('Error syncing accounts: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestApiConnection = async (accountId: string) => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-meta-ads-token`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API test failed:', errorData);
        alert(`API test failed: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const testResults = await response.json();
      console.log('API Test Results:', testResults);

      let summary = `Meta Ads API Test Results for ${testResults.accountId}\n\n`;
      testResults.tests.forEach((test: any) => {
        summary += `${test.status} ${test.test}\n`;
        if (test.count !== undefined) {
          summary += `   Found: ${test.count} items\n`;
        }
        if (test.error) {
          summary += `   Error: ${test.error}\n`;
        }
        if (test.reason) {
          summary += `   Reason: ${test.reason}\n`;
        }
        if (test.response?.error) {
          summary += `   API Error: ${test.response.error.message}\n`;
        }
        summary += '\n';
      });

      summary += '\nFull details have been logged to the console.';
      alert(summary);
    } catch (err: any) {
      console.error('Error testing API:', err);
      alert('Error testing API: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncMonthlyReports = async (accountId: string, datePreset?: string) => {
    setSyncingMonthly(true);
    setMonthlyReportResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-monthly-reports`;

      // If no date preset provided, sync the selected month
      let syncDatePreset = datePreset;
      let customDateRange = null;

      if (!syncDatePreset) {
        // Check if selectedMonth is a special preset like "last_6_months" or "last_12_months"
        if (selectedMonth === 'last_6_months' || selectedMonth === 'last_12_months') {
          syncDatePreset = selectedMonth;
        } else {
          const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          if (selectedMonth === currentMonth) {
            syncDatePreset = 'this_month';
          } else {
            // For past months, use a custom date range
            const [year, month] = selectedMonth.split('-');
            const startDate = new Date(Number(year), Number(month) - 1, 1);
            const endDate = new Date(Number(year), Number(month), 0); // Last day of the month

            customDateRange = {
              since: startDate.toISOString().split('T')[0],
              until: endDate.toISOString().split('T')[0]
            };
          }
        }
      }

      const requestBody: any = {
        accountId: accountId
      };

      if (customDateRange) {
        requestBody.customDateRange = customDateRange;
      } else {
        requestBody.datePreset = syncDatePreset;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync monthly reports');
      }

      const results = await response.json();
      setMonthlyReportResults(results);
      setShowMonthlyReportModal(true);

      await loadData();
    } catch (err: any) {
      console.error('Error syncing monthly reports:', err);
      alert('Error syncing monthly reports: ' + err.message);
    } finally {
      setSyncingMonthly(false);
    }
  };

  const handleSyncCampaigns = async (accountId: string) => {
    setSyncing(true);
    try {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_ads_access_token')
        .maybeSingle();

      if (!settings?.value) {
        alert('Meta Ads access token not configured.');
        return;
      }

      // First, get existing campaigns linked to this marketing project
      const { data: existingCampaigns } = await supabase
        .from('meta_campaigns')
        .select('campaign_id')
        .eq('account_id', accountId)
        .eq('marketing_reference', projectId);

      const existingCampaignIds = existingCampaigns?.map(c => c.campaign_id) || [];

      // Fetch campaign details from Meta API to update them
      if (existingCampaignIds.length > 0) {
        const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

        for (const campaignId of existingCampaignIds) {
          const url = `https://graph.facebook.com/v21.0/${campaignId}?fields=id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time&access_token=${settings.value}`;

          const response = await fetch(url);
          if (response.ok) {
            const campaign = await response.json();

            await supabase
              .from('meta_campaigns')
              .upsert({
                campaign_id: campaign.id,
                account_id: accountId,
                name: campaign.name,
                objective: campaign.objective,
                status: campaign.status,
                daily_budget: campaign.daily_budget,
                lifetime_budget: campaign.lifetime_budget,
                created_time: campaign.created_time,
                updated_time: campaign.updated_time,
                client_number: clientNumber,
                marketing_reference: projectId,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'campaign_id'
              });
          }
        }
      }

      if (existingCampaignIds.length === 0) {
        alert('No campaigns linked to this marketing project. Please add campaigns first from the Admin → Meta Ads page.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-meta-ads-insights`;

      const insightsResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: accountId,
          campaignIds: existingCampaignIds,
          dateRange: {
            since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            until: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!insightsResponse.ok) {
        const errorData = await insightsResponse.json();
        console.error('Failed to sync insights:', errorData);
        alert(`Updated ${existingCampaignIds.length} campaign(s), but failed to sync insights: ${errorData.error || 'Unknown error'}`);
      } else {
        const insightsData = await insightsResponse.json();
        console.log('Sync results:', insightsData);

        if (insightsData.errors && insightsData.errors.length > 0) {
          const errorList = insightsData.errors.join('\n');
          alert(`Synced ${existingCampaignIds.length} campaign(s) for this project:\n- ${insightsData.totalAdSets || 0} ad sets found\n- ${insightsData.totalAds} ads found\n- ${insightsData.synced} insights records synced\n\nErrors encountered:\n${errorList}${insightsData.hasMoreErrors ? '\n... and more errors (check console)' : ''}`);
        } else {
          alert(`Successfully synced for this project:\n- ${existingCampaignIds.length} campaign(s)\n- ${insightsData.totalAdSets || 0} ad sets\n- ${insightsData.totalAds} ads\n- ${insightsData.synced} insights records`);
        }
      }

      await loadData();
    } catch (err: any) {
      console.error('Error syncing campaigns:', err);
      alert('Error syncing campaigns: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Meta Ad Accounts</h3>
          <p className="text-sm text-gray-600">Manage ad accounts and track campaign performance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncAccounts}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Sync All Accounts
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus size={18} />
            Add Account
          </button>
        </div>
      </div>

      {linkedAccounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 mb-4">
            <BarChart3 size={64} className="mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Ad Accounts Linked</h3>
          <p className="text-gray-600 mb-4">
            Add an ad account to start tracking campaign performance
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Your First Account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {linkedAccounts.length > 1 && (
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <BarChart3 size={20} className="text-gray-600" />
                <label className="text-sm font-medium text-gray-700">Select Account:</label>
                <select
                  value={selectedAccountForView}
                  onChange={(e) => setSelectedAccountForView(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {linkedAccounts.map((link) => (
                    <option key={link.id} value={link.account_id}>
                      {link.meta_ad_accounts.account_name} ({link.meta_ad_accounts.currency})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {linkedAccounts.filter(link => link.account_id === selectedAccountForView).map((link) => (
            <div key={link.id} className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{link.meta_ad_accounts.account_name}</h4>
                  <p className="text-sm text-gray-600">
                    Account ID: {link.account_id} • Currency: {link.meta_ad_accounts.currency}
                  </p>
                  {link.meta_ad_accounts.business_name && (
                    <p className="text-xs text-gray-500">Business: {link.meta_ad_accounts.business_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSyncMonthlyReports(link.account_id)}
                    disabled={syncingMonthly}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <BarChart3 size={14} className={syncingMonthly ? 'animate-spin' : ''} />
                    Sync Monthly Reports
                  </button>
                  <button
                    onClick={() => handleTestApiConnection(link.account_id)}
                    disabled={syncingMonthly}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    <BarChart3 size={14} />
                    Test API
                  </button>
                  <button
                    onClick={() => handleRemoveAccount(link.id)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-gray-600" />
                      <label className="text-sm font-medium text-gray-700">View Data For:</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}>
                          Current Month (Month-to-Date)
                        </option>
                        <option value="last_6_months">Last 6 Months</option>
                        <option value="last_12_months">Last 12 Months</option>
                        {availableMonths.filter(m => m !== `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).map(month => {
                          const [year, monthNum] = month.split('-');
                          const date = new Date(Number(year), Number(monthNum) - 1);
                          const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          return (
                            <option key={month} value={month}>
                              {monthName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="text-sm text-gray-600">
                      {campaigns.length} campaigns • {adSets.length} ad sets
                    </div>
                  </div>
                </div>

                {campaigns.filter(c => c.account_id === link.account_id).length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-600 mb-2 font-medium">
                      No data for {selectedMonth === 'last_6_months' ? 'Last 6 Months' : selectedMonth === 'last_12_months' ? 'Last 12 Months' : new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      Click "Sync Monthly Reports" above to fetch data for this period
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4 border-b border-gray-200">
                      <button
                        onClick={() => setReportView('monthly')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'monthly'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Monthly Overview
                      </button>
                      <button
                        onClick={() => setReportView('campaigns')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'campaigns'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Campaigns
                      </button>
                      <button
                        onClick={() => setReportView('demographics')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'demographics'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Demographics
                      </button>
                      <button
                        onClick={() => setReportView('adsets')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'adsets'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Ad Sets
                      </button>
                      <button
                        onClick={() => setReportView('creatives')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'creatives'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Creative
                      </button>
                      <button
                        onClick={() => setReportView('platform')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'platform'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Platform
                      </button>
                      <button
                        onClick={() => setReportView('comparison')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          reportView === 'comparison'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Monthly Report
                      </button>
                    </div>

                    {reportView === 'monthly' && (
                      <div className="mt-4">
                        <MonthlyPerformanceChart accountId={link.account_id} selectedMonth={selectedMonth} />
                      </div>
                    )}

                    {reportView === 'campaigns' && (() => {
                      const accountCampaigns = campaigns.filter(c => c.account_id === link.account_id);

                      const groupedByObjective = accountCampaigns.reduce((acc, campaign) => {
                        const objective = campaign.objective || 'Unknown';
                        if (!acc[objective]) {
                          acc[objective] = [];
                        }
                        acc[objective].push(campaign);
                        return acc;
                      }, {} as Record<string, typeof accountCampaigns>);

                      const objectiveTotals = Object.entries(groupedByObjective).map(([objective, campaigns]) => ({
                        objective,
                        total_spend: campaigns.reduce((sum, c) => sum + c.total_spend, 0),
                        total_impressions: campaigns.reduce((sum, c) => sum + c.total_impressions, 0),
                        total_clicks: campaigns.reduce((sum, c) => sum + c.total_clicks, 0),
                        total_results: campaigns.reduce((sum, c) => sum + c.total_results, 0),
                        campaigns: campaigns.sort((a, b) => b.total_spend - a.total_spend)
                      })).sort((a, b) => b.total_spend - a.total_spend);

                      const formatActionType = (actionType: string): string => {
                        // If it's already a display name (doesn't contain underscores or dots), return as-is
                        if (!actionType.includes('_') && !actionType.includes('.')) {
                          return actionType;
                        }

                        const typeMap: Record<string, string> = {
                          // Traffic actions
                          'link_click': 'Link Click',
                          'landing_page_view': 'Landing Page View',
                          'omni_landing_page_view': 'Landing Page View',
                          'outbound_click': 'Link Click',

                          // Engagement actions
                          'post_engagement': 'Post Engagement',
                          'page_engagement': 'Page Engagement',
                          'like': 'Like',
                          'post_like': 'Like',
                          'page_like': 'Like',
                          'onsite_conversion.post_net_like': 'Like',
                          'comment': 'Comment',
                          'post': 'Post',
                          'post_reaction': 'Reaction',
                          'video_view': 'Video View',
                          'onsite_conversion.post_save': 'Post Save',
                          'onsite_conversion.post_net_save': 'Post Save',

                          // Sales/Conversion actions - ALL consolidate to "Purchase"
                          'purchase': 'Purchase',
                          'offsite_conversion.fb_pixel_purchase': 'Purchase',
                          'omni_purchase': 'Purchase',
                          'onsite_web_purchase': 'Purchase',
                          'onsite_web_app_purchase': 'Purchase',
                          'web_in_store_purchase': 'Purchase',
                          'web_app_in_store_purchase': 'Purchase',
                          'add_to_cart': 'Add to Cart',
                          'offsite_conversion.fb_pixel_add_to_cart': 'Add to Cart',
                          'omni_add_to_cart': 'Add to Cart',
                          'onsite_web_add_to_cart': 'Add to Cart',
                          'onsite_web_app_add_to_cart': 'Add to Cart',
                          'initiate_checkout': 'Initiate Checkout',
                          'offsite_conversion.fb_pixel_initiate_checkout': 'Initiate Checkout',
                          'omni_initiated_checkout': 'Initiate Checkout',
                          'onsite_web_initiate_checkout': 'Initiate Checkout',
                          'view_content': 'View Content',
                          'offsite_conversion.fb_pixel_view_content': 'View Content',
                          'omni_view_content': 'View Content',

                          // Lead actions - ALL consolidate to "Lead"
                          'lead': 'Lead',
                          'onsite_conversion.lead_grouped': 'Lead',

                          // App actions - ALL consolidate to "App Install"
                          'app_install': 'App Install',
                          'mobile_app_install': 'App Install',

                          // Awareness actions
                          'reach': 'Reach',
                          'frequency': 'Frequency',
                          'estimated_ad_recallers': 'Estimated Ad Recalls',

                          // Messaging actions
                          'onsite_conversion.messaging_conversation_started_7d': 'Conversation Started'
                        };

                        return typeMap[actionType] || actionType.split('_').map(word =>
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                      };

                      const formatResultTypes = (resultTypes: string | null, actionBreakdown?: Record<string, number>): string => {
                        if (!resultTypes) return '-';
                        const types = resultTypes.split(', ');
                        const formatted = types.map(type => {
                          const trimmedType = type.trim();
                          const formattedName = formatActionType(trimmedType);
                          const count = actionBreakdown?.[trimmedType];
                          return count ? `${formattedName} (${count.toLocaleString()})` : formattedName;
                        });
                        return formatted.join(', ');
                      };

                      const getResultTypeNote = (objective: string) => {
                        const obj = objective.toUpperCase();
                        if (obj.includes('TRAFFIC') || obj.includes('LINK_CLICKS')) {
                          return 'Link Click, Landing Page View';
                        } else if (obj.includes('ENGAGEMENT') || obj.includes('PAGE_LIKES') || obj.includes('POST_ENGAGEMENT')) {
                          return 'Post Engagement, Page Engagement';
                        } else if (obj.includes('LEAD') || obj === 'LEAD_GENERATION') {
                          return 'Lead';
                        } else if (obj.includes('SALES') || obj.includes('CONVERSIONS')) {
                          return 'Purchase';
                        } else if (obj.includes('APP') || obj.includes('INSTALLS')) {
                          return 'App Install';
                        } else if (obj.includes('VIDEO')) {
                          return 'Video View';
                        } else if (obj === 'BRAND_AWARENESS' || obj === 'OUTCOME_AWARENESS' || obj === 'REACH') {
                          return 'Reach, Estimated Ad Recalls';
                        } else if (obj.includes('MESSAGES')) {
                          return 'Messaging Conversations';
                        }
                        return 'Various conversion actions';
                      };

                      return (
                        <div>
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <div className="text-blue-600 mt-0.5">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-blue-900 mb-1">What counts as Results?</h4>
                                <p className="text-xs text-blue-800 leading-relaxed mb-2">
                                  Results vary by campaign objective. The system counts all relevant action types:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-800">
                                  <div>
                                    <div className="font-semibold">Traffic Campaigns</div>
                                    <div className="pl-2">Link Clicks, Landing Page Views, Outbound Clicks</div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">Engagement Campaigns</div>
                                    <div className="pl-2">Post Engagement, Page Engagement, Likes, Video Views, Comments, Reactions, Post Saves</div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">Sales/Conversions Campaigns</div>
                                    <div className="pl-2">Purchase, Add to Cart, Initiate Checkout, All pixel conversion variations</div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">Awareness Campaigns</div>
                                    <div className="pl-2">Reach, Frequency, Estimated Ad Recalls</div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">Lead Generation</div>
                                    <div className="pl-2">Leads, Lead Form Submissions</div>
                                  </div>
                                  <div>
                                    <div className="font-semibold">Other Objectives</div>
                                    <div className="pl-2">App Installs, Video Views, Messages, etc.</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">
                                  Campaign / Objective
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  Spend
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  Impressions
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  Clicks
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  Results
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs">
                                  Action Types
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  CTR
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                  CPC
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {objectiveTotals.map(({ objective, total_spend, total_impressions, total_clicks, total_results, campaigns }) => {
                                const allResultTypes = Array.from(new Set(campaigns.flatMap(c => c.result_types ? c.result_types.split(', ') : []))).join(', ');
                                // Aggregate action breakdowns for all campaigns in this objective
                                const aggregatedBreakdown: Record<string, number> = {};
                                campaigns.forEach(c => {
                                  if (c.action_breakdown) {
                                    Object.entries(c.action_breakdown).forEach(([action, count]) => {
                                      aggregatedBreakdown[action] = (aggregatedBreakdown[action] || 0) + (count as number);
                                    });
                                  }
                                });
                                const formattedResultTypes = formatResultTypes(allResultTypes, aggregatedBreakdown);
                                return (
                                <>
                                  <tr key={`objective-${objective}`} className="bg-blue-50 border-t-2 border-blue-200">
                                    <td className="px-4 py-3 font-bold text-blue-900 capitalize" colSpan={2}>
                                      {objective.replace(/_/g, ' ')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-900">
                                      ${total_spend.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-900">
                                      {total_impressions.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-900">
                                      {total_clicks.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-900">
                                      {total_results.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-left font-bold text-blue-900 text-xs">
                                      {formattedResultTypes || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-900">
                                      {total_impressions > 0 ? ((total_clicks / total_impressions) * 100).toFixed(2) : '0.00'}%
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-900">
                                      ${total_clicks > 0 ? (total_spend / total_clicks).toFixed(2) : '0.00'}
                                    </td>
                                  </tr>
                                  {campaigns.map((campaign) => (
                                    <tr key={campaign.campaign_id} className="hover:bg-gray-50 border-b border-gray-100">
                                      <td className="px-4 py-2 text-gray-900 pl-8">{campaign.name}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                          campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                          campaign.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {campaign.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-right text-gray-700">${campaign.total_spend.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-right text-gray-700">{campaign.total_impressions.toLocaleString()}</td>
                                      <td className="px-4 py-2 text-right text-gray-700">{campaign.total_clicks.toLocaleString()}</td>
                                      <td className="px-4 py-2 text-right text-gray-700">{campaign.total_results.toLocaleString()}</td>
                                      <td className="px-4 py-2 text-left text-gray-600 text-xs truncate max-w-xs" title={formatResultTypes(campaign.result_types, campaign.action_breakdown)}>
                                        {formatResultTypes(campaign.result_types, campaign.action_breakdown)}
                                      </td>
                                      <td className="px-4 py-2 text-right text-gray-700">{campaign.avg_ctr.toFixed(2)}%</td>
                                      <td className="px-4 py-2 text-right text-gray-700">${campaign.avg_cpc.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </>
                              )})}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      );
                    })()}

                    {reportView === 'demographics' && (
                      <div>
                        <div className="flex gap-2 mb-4 border-b border-gray-200">
                          <button
                            onClick={() => { setDemographicView('age'); setSortConfig(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              demographicView === 'age'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Demographic
                          </button>
                          <button
                            onClick={() => { setDemographicView('gender'); setSortConfig(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              demographicView === 'gender'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Gender
                          </button>
                          <button
                            onClick={() => { setDemographicView('all'); setSortConfig(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              demographicView === 'all'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            All
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          {(() => {
                            const displayData = getSortedData(getAggregatedDemographics());

                            if (demographicView === 'age') {
                              return (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('age')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Age Group
                                          {sortConfig?.key === 'age' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('spend')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Spend
                                          {sortConfig?.key === 'spend' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('impressions')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Impressions
                                          {sortConfig?.key === 'impressions' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('clicks')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Clicks
                                          {sortConfig?.key === 'clicks' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('results')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Results
                                          {sortConfig?.key === 'results' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('sales')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Sales
                                          {sortConfig?.key === 'sales' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('leads')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Leads
                                          {sortConfig?.key === 'leads' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('traffic')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Traffic
                                          {sortConfig?.key === 'traffic' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('engagement')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Engagement
                                          {sortConfig?.key === 'engagement' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('awareness')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Awareness
                                          {sortConfig?.key === 'awareness' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('app_installs')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          App Installs
                                          {sortConfig?.key === 'app_installs' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayData.length === 0 ? (
                                      <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                                          No demographic data available. Sync monthly reports to fetch demographic insights.
                                        </td>
                                      </tr>
                                    ) : (
                                      displayData.map((demo: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                          <td className="px-4 py-2 font-medium">{demo.age}</td>
                                          <td className="px-4 py-2 text-right font-medium">${demo.spend.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right">{demo.impressions.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.clicks.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.results.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-green-600 font-medium">{demo.sales.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-blue-600 font-medium">{demo.leads.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-purple-600 font-medium">{demo.traffic.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-orange-600 font-medium">{demo.engagement.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-pink-600 font-medium">{demo.awareness.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-indigo-600 font-medium">{demo.app_installs.toLocaleString()}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              );
                            } else if (demographicView === 'gender') {
                              return (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('gender')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Gender
                                          {sortConfig?.key === 'gender' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('spend')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Spend
                                          {sortConfig?.key === 'spend' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('impressions')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Impressions
                                          {sortConfig?.key === 'impressions' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('clicks')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Clicks
                                          {sortConfig?.key === 'clicks' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('results')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Results
                                          {sortConfig?.key === 'results' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('sales')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Sales
                                          {sortConfig?.key === 'sales' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('leads')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Leads
                                          {sortConfig?.key === 'leads' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('traffic')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Traffic
                                          {sortConfig?.key === 'traffic' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('engagement')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Engagement
                                          {sortConfig?.key === 'engagement' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('awareness')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Awareness
                                          {sortConfig?.key === 'awareness' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('app_installs')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          App Installs
                                          {sortConfig?.key === 'app_installs' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayData.length === 0 ? (
                                      <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                                          No demographic data available. Sync monthly reports to fetch demographic insights.
                                        </td>
                                      </tr>
                                    ) : (
                                      displayData.map((demo: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                          <td className="px-4 py-2 font-medium capitalize">{demo.gender}</td>
                                          <td className="px-4 py-2 text-right font-medium">${demo.spend.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right">{demo.impressions.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.clicks.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.results.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-green-600 font-medium">{demo.sales.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-blue-600 font-medium">{demo.leads.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-purple-600 font-medium">{demo.traffic.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-orange-600 font-medium">{demo.engagement.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-pink-600 font-medium">{demo.awareness.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-indigo-600 font-medium">{demo.app_installs.toLocaleString()}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              );
                            } else {
                              return (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('age')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Age
                                          {sortConfig?.key === 'age' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('gender')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Gender
                                          {sortConfig?.key === 'gender' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('country')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Country
                                          {sortConfig?.key === 'country' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('spend')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Spend
                                          {sortConfig?.key === 'spend' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('impressions')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Impressions
                                          {sortConfig?.key === 'impressions' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('clicks')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Clicks
                                          {sortConfig?.key === 'clicks' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('results')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Results
                                          {sortConfig?.key === 'results' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('sales')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Sales
                                          {sortConfig?.key === 'sales' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('leads')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Leads
                                          {sortConfig?.key === 'leads' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('traffic')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Traffic
                                          {sortConfig?.key === 'traffic' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('engagement')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Engagement
                                          {sortConfig?.key === 'engagement' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('awareness')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          Awareness
                                          {sortConfig?.key === 'awareness' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('app_installs')}
                                      >
                                        <div className="flex items-center justify-end gap-1">
                                          App Installs
                                          {sortConfig?.key === 'app_installs' && (
                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayData.length === 0 ? (
                                      <tr>
                                        <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                                          No demographic data available. Sync monthly reports to fetch demographic insights.
                                        </td>
                                      </tr>
                                    ) : (
                                      displayData.map((demo: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                          <td className="px-4 py-2">{demo.age}</td>
                                          <td className="px-4 py-2 capitalize">{demo.gender}</td>
                                          <td className="px-4 py-2">{demo.country}</td>
                                          <td className="px-4 py-2 text-right font-medium">${demo.spend.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-right">{demo.impressions.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.clicks.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right">{demo.results.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-green-600 font-medium">{demo.sales.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-blue-600 font-medium">{demo.leads.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-purple-600 font-medium">{demo.traffic.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-orange-600 font-medium">{demo.engagement.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-pink-600 font-medium">{demo.awareness.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-right text-indigo-600 font-medium">{demo.app_installs.toLocaleString()}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}

                    {reportView === 'adsets' && (
                      <div className="overflow-x-auto">
                        {adSets.filter(as => campaigns.find(c => c.campaign_id === as.campaign_id && c.account_id === link.account_id)).length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No ad sets found.
                          </p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th
                                  className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('name')}
                                >
                                  Ad Set Name {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('status')}
                                >
                                  Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_spend')}
                                >
                                  Spend {sortConfig?.key === 'total_spend' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_impressions')}
                                >
                                  Impressions {sortConfig?.key === 'total_impressions' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_clicks')}
                                >
                                  Clicks {sortConfig?.key === 'total_clicks' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_results')}
                                >
                                  Results {sortConfig?.key === 'total_results' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_sales')}
                                >
                                  Sales {sortConfig?.key === 'total_sales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_leads')}
                                >
                                  Leads {sortConfig?.key === 'total_leads' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_traffic')}
                                >
                                  Traffic {sortConfig?.key === 'total_traffic' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_engagement')}
                                >
                                  Engagement {sortConfig?.key === 'total_engagement' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_awareness')}
                                >
                                  Awareness {sortConfig?.key === 'total_awareness' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_app_installs')}
                                >
                                  App Installs {sortConfig?.key === 'total_app_installs' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(getSortedData(adSets.filter(as => campaigns.find(c => c.campaign_id === as.campaign_id && c.account_id === link.account_id))) as AdSetMetrics[]).map((adset) => (
                                <tr key={adset.adset_id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-900 font-medium">{adset.name}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                      adset.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                      adset.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {adset.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900 font-medium">${adset.total_spend.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{adset.total_impressions.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{adset.total_clicks.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{adset.total_results.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-green-600 font-medium">{adset.total_sales.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-blue-600 font-medium">{adset.total_leads.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-purple-600 font-medium">{adset.total_traffic.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-orange-600 font-medium">{adset.total_engagement.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-pink-600 font-medium">{adset.total_awareness.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-indigo-600 font-medium">{adset.total_app_installs.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {reportView === 'creatives' && (
                      <CreativePerformanceGallery
                        accountId={selectedAccountForView}
                        dateRange={selectedMonth === 'last_6_months' ? {
                          since: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
                          until: new Date().toISOString().split('T')[0]
                        } : selectedMonth === 'last_3_months' ? {
                          since: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
                          until: new Date().toISOString().split('T')[0]
                        } : undefined}
                      />
                    )}

                    {reportView === 'platform' && (
                      <div className="overflow-x-auto">
                        {platforms.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No platform data found. Click "Sync Monthly Reports" to fetch platform metrics.
                          </p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th
                                  className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('publisher_platform')}
                                >
                                  Platform {sortConfig?.key === 'publisher_platform' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_spend')}
                                >
                                  Spend {sortConfig?.key === 'total_spend' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_impressions')}
                                >
                                  Impressions {sortConfig?.key === 'total_impressions' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_reach')}
                                >
                                  Reach {sortConfig?.key === 'total_reach' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_clicks')}
                                >
                                  Clicks {sortConfig?.key === 'total_clicks' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_results')}
                                >
                                  Results {sortConfig?.key === 'total_results' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_sales')}
                                >
                                  Sales {sortConfig?.key === 'total_sales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_leads')}
                                >
                                  Leads {sortConfig?.key === 'total_leads' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_traffic')}
                                >
                                  Traffic {sortConfig?.key === 'total_traffic' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_engagement')}
                                >
                                  Engagement {sortConfig?.key === 'total_engagement' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_awareness')}
                                >
                                  Awareness {sortConfig?.key === 'total_awareness' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('total_app_installs')}
                                >
                                  App Installs {sortConfig?.key === 'total_app_installs' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('avg_ctr')}
                                >
                                  CTR {sortConfig?.key === 'avg_ctr' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('avg_cpc')}
                                >
                                  CPC {sortConfig?.key === 'avg_cpc' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                  className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                                  onClick={() => handleSort('avg_cpm')}
                                >
                                  CPM {sortConfig?.key === 'avg_cpm' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(getSortedData(platforms) as PlatformMetrics[]).map((platform) => (
                                <tr key={platform.publisher_platform} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-900 font-medium capitalize">
                                    {platform.publisher_platform.replace(/_/g, ' ')}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900 font-medium">${platform.total_spend.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{platform.total_impressions.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{platform.total_reach.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{platform.total_clicks.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{platform.total_results.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-green-600 font-medium">{platform.total_sales.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-blue-600 font-medium">{platform.total_leads.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-purple-600 font-medium">{platform.total_traffic.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-orange-600 font-medium">{platform.total_engagement.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-pink-600 font-medium">{platform.total_awareness.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-indigo-600 font-medium">{platform.total_app_installs.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{platform.avg_ctr.toFixed(2)}%</td>
                                  <td className="px-4 py-3 text-right text-gray-700">${platform.avg_cpc.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">${platform.avg_cpm.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {reportView === 'comparison' && (
                      <div className="mt-4">
                        <MonthlyComparison accountId={link.account_id} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Meta Ad Account</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Ad Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose an account...</option>
                {availableAccounts
                  .filter(acc => !linkedAccounts.some(link => link.account_id === acc.account_id))
                  .map(acc => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.account_name} ({acc.account_id})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Only showing accounts not already linked to this project
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedAccountId('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!selectedAccountId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}

      {showMonthlyReportModal && monthlyReportResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Monthly Report Sync Results</h3>
              <button
                onClick={() => setShowMonthlyReportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-green-700">Campaigns:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.campaigns?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Ad Sets:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.adSets?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Insights Synced:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.totalInsightsSynced || 0}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Date Preset:</span>
                    <span className="ml-2 font-semibold">{monthlyReportResults.datePreset || 'last_month'}</span>
                  </div>
                </div>
              </div>

              {monthlyReportResults.campaigns && monthlyReportResults.campaigns.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Campaigns Processed</h4>
                  <div className="space-y-2">
                    {monthlyReportResults.campaigns.map((campaign: any) => (
                      <div key={campaign.campaign_id} className="bg-gray-50 rounded p-3">
                        <div className="font-medium text-gray-900">{campaign.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {campaign.objective} • {campaign.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {monthlyReportResults.errors && monthlyReportResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                  <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                    {monthlyReportResults.errors.slice(0, 5).map((error: string, idx: number) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {monthlyReportResults.errors.length > 5 && (
                      <li className="text-red-600">... and {monthlyReportResults.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowMonthlyReportModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
