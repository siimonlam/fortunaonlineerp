import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Facebook, RefreshCw, Users, Image, ExternalLink, Calendar, Heart, MessageCircle, Eye, TrendingUp, Share2, Grid, List, Plus, X, Trash2 } from 'lucide-react';

interface FacebookAccount {
  id: string;
  page_id: string;
  name: string;
  category: string;
  description: string;
  picture: string;
  followers_count: number;
  website: string;
  client_number: string | null;
  last_updated: string;
  created_at: string;
}

interface FacebookPost {
  id: string;
  post_id: string;
  date: string;
  message: string;
  type: string;
  full_picture: string;
  link: string;
  permalink: string;
  reactions: number;
  comments_count: number;
  shares_count: number;
  page_id: string;
  client_number: string | null;
  created_at: string;
  updated_at: string;
}

interface PostMetrics {
  reactions: number;
  comments: number;
  shares: number;
  engagement: number;
}

interface MarketingFacebookSectionProps {
  projectId: string;
  clientNumber: string | null;
}

export default function MarketingFacebookSection({ projectId, clientNumber: initialClientNumber }: MarketingFacebookSectionProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<FacebookAccount[]>([]);
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [metrics, setMetrics] = useState<Record<string, PostMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [clientNumber, setClientNumber] = useState<string | null>(initialClientNumber);
  const [marketingReference, setMarketingReference] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectInfo();
  }, [projectId]);

  const fetchProjectInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_projects')
        .select('project_reference, client_number')
        .eq('id', projectId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setMarketingReference(data.project_reference);
        setClientNumber(data.client_number);
      }
    } catch (err: any) {
      console.error('Error fetching project info:', err);
    }
  };

  useEffect(() => {
    if (marketingReference) {
      fetchAccounts();
      fetchAllAccounts();
      fetchPosts();
      fetchMetrics();
    }

    const junctionSubscription = supabase
      .channel('marketing_project_facebook_junction')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'marketing_facebook_accounts',
        filter: `marketing_reference=eq.${marketingReference}`
      }, () => {
        fetchAccounts();
      })
      .subscribe();

    const postsSubscription = supabase
      .channel('marketing_facebook_posts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'facebook_posts'
      }, () => {
        fetchPosts();
      })
      .subscribe();

    const metricsSubscription = supabase
      .channel('marketing_facebook_metrics')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'facebook_post_metrics'
      }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      junctionSubscription.unsubscribe();
      postsSubscription.unsubscribe();
      metricsSubscription.unsubscribe();
    };
  }, [projectId, marketingReference]);

  useEffect(() => {
    if (selectedAccount) {
      fetchPosts();
      fetchMetrics();
    }
  }, [selectedAccount]);

  const fetchAccounts = async () => {
    try {
      const { data: junctionData, error: junctionError } = await supabase
        .from('marketing_facebook_accounts')
        .select('page_id')
        .eq('marketing_reference', marketingReference);

      if (junctionError) throw junctionError;

      const pageIds = junctionData?.map(j => j.page_id) || [];

      if (pageIds.length === 0) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('facebook_accounts')
        .select('*')
        .in('page_id', pageIds)
        .order('last_updated', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);

      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].page_id);
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAccounts = async () => {
    try {
      const { data: allAccountsData, error: accountsError } = await supabase
        .from('facebook_accounts')
        .select('*')
        .order('name', { ascending: true });

      if (accountsError) throw accountsError;

      const { data: usedAccounts, error: junctionError } = await supabase
        .from('marketing_facebook_accounts')
        .select('page_id');

      if (junctionError) throw junctionError;

      const usedPageIds = new Set(usedAccounts?.map(j => j.page_id) || []);

      const availableAccounts = allAccountsData?.filter(
        acc => !usedPageIds.has(acc.page_id) || accounts.find(a => a.page_id === acc.page_id)
      ) || [];

      setAllAccounts(availableAccounts);
    } catch (err: any) {
      console.error('Error fetching all accounts:', err);
    }
  };

  const fetchPosts = async () => {
    try {
      let query = supabase
        .from('facebook_posts')
        .select('*')
        .order('date', { ascending: false });

      if (selectedAccount) {
        query = query.eq('page_id', selectedAccount);
      } else if (marketingReference) {
        // Filter by marketing_reference (MP0xxx) for this marketing project
        query = query.eq('marketing_reference', marketingReference);
      } else {
        // No marketing reference yet, return empty
        setPosts([]);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (err: any) {
      console.error('Error fetching posts:', err);
      setError(err.message);
    }
  };

  const fetchMetrics = async () => {
    try {
      let query = supabase
        .from('facebook_post_metrics')
        .select('*')
        .order('date', { ascending: false });

      if (selectedAccount) {
        query = query.eq('page_id', selectedAccount);
      } else if (marketingReference) {
        // Filter by marketing_reference (MP0xxx) for this marketing project
        query = query.eq('marketing_reference', marketingReference);
      } else {
        // No marketing reference yet, return empty
        setMetrics({});
        return;
      }

      const { data, error } = await query;

      if (error) throw error;

      const metricsMap: Record<string, PostMetrics> = {};
      data?.forEach((metric: any) => {
        if (!metricsMap[metric.post_id]) {
          metricsMap[metric.post_id] = metric;
        }
      });

      setMetrics(metricsMap);
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
    }
  };

  const handleSyncAccount = async (pageId: string) => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-facebook-accounts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clientNumber }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync account');
      }

      const result = await response.json();
      setSuccessMessage(result.message);

      await handleSyncPosts(pageId);
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncPosts = async (pageId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-facebook-posts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId,
            clientNumber,
            marketingReference,
            limit: 50
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync posts');
      }

      const result = await response.json();
      setSuccessMessage(`${result.message}`);
    } catch (err: any) {
      console.error('Sync posts error:', err);
      setError(err.message);
    }
  };

  const handleAddAccount = async (pageId: string) => {
    try {
      const { error: junctionError } = await supabase
        .from('marketing_facebook_accounts')
        .insert({
          marketing_reference: marketingReference,
          page_id: pageId
        });

      if (junctionError) throw junctionError;

      setSuccessMessage('Account added successfully');
      setShowAddAccountModal(false);
      fetchAccounts();
    } catch (err: any) {
      console.error('Error adding account:', err);
      setError(err.message);
    }
  };

  const handleRemoveAccount = async (pageId: string) => {
    if (!confirm('Are you sure you want to remove this account from this project?')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('marketing_facebook_accounts')
        .delete()
        .eq('marketing_reference', marketingReference)
        .eq('page_id', pageId);

      if (deleteError) throw deleteError;

      setSuccessMessage('Account removed successfully');

      if (selectedAccount === pageId) {
        setSelectedAccount(null);
      }

      fetchAccounts();
    } catch (err: any) {
      console.error('Error removing account:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Facebook Pages</h3>
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Page
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="p-6 text-center">
            <Facebook className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No Facebook pages linked to this project</p>
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Your First Page
            </button>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all relative ${
                  selectedAccount === account.page_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedAccount(account.page_id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAccount(account.page_id);
                  }}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove account"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={account.picture}
                    alt={account.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{account.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{account.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900">{account.followers_count.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{account.page_id}</p>
                    <p className="text-xs text-gray-600">Page ID</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncAccount(account.page_id);
                  }}
                  disabled={syncing}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Posts'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Posts</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="p-6 text-center">
              <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No posts found</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {posts.map((post) => {
                const postMetrics = metrics[post.post_id];
                return (
                  <div key={post.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative aspect-square bg-gray-100">
                      {post.full_picture ? (
                        <img
                          src={post.full_picture}
                          alt={post.message}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <Image className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4 text-gray-600" />
                        </a>
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">{post.message || 'No message'}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          <span>{post.reactions.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments_count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Share2 className="w-4 h-4" />
                          <span>{post.shares_count.toLocaleString()}</span>
                        </div>
                      </div>

                      {postMetrics && (
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>{postMetrics.engagement.toLocaleString()}</span>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(post.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Image</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Message</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Reactions</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Comments</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Shares</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Engagement</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {posts.map((post) => {
                    const postMetrics = metrics[post.post_id];
                    return (
                      <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {new Date(post.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                            {post.full_picture ? (
                              <img
                                src={post.full_picture}
                                alt={post.message}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <Image className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700 line-clamp-2 max-w-md">
                            {post.message || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          {post.reactions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          {post.comments_count.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          {post.shares_count.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                          {postMetrics ? postMetrics.engagement.toLocaleString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4 inline" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Add Facebook Page</h2>
              <button onClick={() => setShowAddAccountModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {allAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <Facebook className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">No Facebook pages available</p>
                  <p className="text-sm text-gray-500">
                    Please configure and sync Facebook pages in Settings first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                        onClick={() => handleAddAccount(account.page_id)}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={account.picture}
                            alt={account.name}
                            className="w-12 h-12 rounded-full"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{account.name}</h4>
                            <p className="text-sm text-gray-600">{account.category}</p>
                          </div>
                          <div className="flex gap-4 text-xs text-gray-600">
                            <div>
                              <p className="font-semibold">{account.followers_count.toLocaleString()}</p>
                              <p>Followers</p>
                            </div>
                          </div>
                          <Plus className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  {allAccounts.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-600">All Facebook pages are already assigned to other projects.</p>
                      <p className="text-sm text-gray-500 mt-2">Remove a page from another project to add it here.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
