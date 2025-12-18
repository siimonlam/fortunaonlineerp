import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Plus, RefreshCw, Trash2, ExternalLink, TrendingUp, DollarSign, Eye, MousePointer } from 'lucide-react';

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
  avg_ctr: number;
  avg_cpc: number;
}

export default function MarketingMetaAdSection({ projectId, clientNumber }: MarketingMetaAdSectionProps) {
  const [availableAccounts, setAvailableAccounts] = useState<MetaAdAccount[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

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
          loadCampaignMetrics(accountIds);
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignMetrics = async (accountIds: string[]) => {
    try {
      const { data: campaignsData } = await supabase
        .from('meta_campaigns')
        .select('campaign_id, name, status, objective, account_id')
        .in('account_id', accountIds);

      if (!campaignsData) return;

      const metricsPromises = campaignsData.map(async (campaign) => {
        const { data: insights } = await supabase
          .from('meta_ad_insights')
          .select('spend, impressions, clicks, conversions, ctr, cpc')
          .eq('campaign_id', campaign.campaign_id);

        if (!insights || insights.length === 0) {
          return {
            ...campaign,
            total_spend: 0,
            total_impressions: 0,
            total_clicks: 0,
            total_conversions: 0,
            avg_ctr: 0,
            avg_cpc: 0
          };
        }

        const totals = insights.reduce((acc, insight) => ({
          spend: acc.spend + (Number(insight.spend) || 0),
          impressions: acc.impressions + (Number(insight.impressions) || 0),
          clicks: acc.clicks + (Number(insight.clicks) || 0),
          conversions: acc.conversions + (Number(insight.conversions) || 0),
          ctr: acc.ctr + (Number(insight.ctr) || 0),
          cpc: acc.cpc + (Number(insight.cpc) || 0)
        }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0 });

        return {
          ...campaign,
          total_spend: totals.spend,
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_conversions: totals.conversions,
          avg_ctr: insights.length > 0 ? totals.ctr / insights.length : 0,
          avg_cpc: insights.length > 0 ? totals.cpc / insights.length : 0
        };
      });

      const metrics = await Promise.all(metricsPromises);
      setCampaigns(metrics);
    } catch (err: any) {
      console.error('Error loading campaign metrics:', err);
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

      const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
      const url = `https://graph.facebook.com/v21.0/${formattedId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time&access_token=${settings.value}`;

      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch campaigns');
      }

      const data = await response.json();
      const campaigns = data.data || [];

      for (const campaign of campaigns) {
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
          dateRange: {
            since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            until: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!insightsResponse.ok) {
        const errorData = await insightsResponse.json();
        console.error('Failed to sync insights:', errorData);
        alert(`Synced ${campaigns.length} campaign(s), but failed to sync insights: ${errorData.error || 'Unknown error'}`);
      } else {
        const insightsData = await insightsResponse.json();
        alert(`Successfully synced ${campaigns.length} campaign(s) and ${insightsData.synced} insights records`);
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
          {linkedAccounts.map((link) => (
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
                    onClick={() => handleSyncCampaigns(link.account_id)}
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    Sync Campaigns
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
                {campaigns.filter(c => c.account_id === link.account_id).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No campaigns found. Click "Sync Campaigns" to fetch data.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {campaigns.filter(c => c.account_id === link.account_id).map((campaign) => (
                      <div key={campaign.campaign_id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h5 className="font-medium text-gray-900">{campaign.name}</h5>
                            <p className="text-xs text-gray-600">
                              {campaign.objective} • {campaign.status}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 mt-3">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                              <DollarSign size={14} />
                              <span className="text-xs font-medium">Spend</span>
                            </div>
                            <p className="text-sm font-semibold">${campaign.total_spend.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                              <Eye size={14} />
                              <span className="text-xs font-medium">Impressions</span>
                            </div>
                            <p className="text-sm font-semibold">{campaign.total_impressions.toLocaleString()}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                              <MousePointer size={14} />
                              <span className="text-xs font-medium">Clicks</span>
                            </div>
                            <p className="text-sm font-semibold">{campaign.total_clicks.toLocaleString()}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                              <TrendingUp size={14} />
                              <span className="text-xs font-medium">CTR</span>
                            </div>
                            <p className="text-sm font-semibold">{campaign.avg_ctr.toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
    </div>
  );
}
