import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Instagram, RefreshCw, Users, Image, ExternalLink, Calendar, Heart, MessageCircle, Eye, TrendingUp, Bookmark, Grid, List } from 'lucide-react';

interface InstagramAccount {
  id: string;
  account_id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  website: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  client_number: string | null;
  last_updated: string;
  created_at: string;
}

interface InstagramPost {
  id: string;
  media_id: string;
  date: string;
  caption: string;
  media_type: string;
  media_url: string;
  permalink: string;
  thumbnail_url: string;
  likes_count: number;
  comments_count: number;
  account_id: string;
  client_number: string | null;
  created_at: string;
  updated_at: string;
}

interface PostMetrics {
  impressions: number;
  reach: number;
  engagement: number;
  saved: number;
  video_views: number;
  shares: number;
}

interface MarketingInstagramSectionProps {
  clientNumber: string | null;
}

export default function MarketingInstagramSection({ clientNumber }: MarketingInstagramSectionProps) {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [metrics, setMetrics] = useState<Record<string, PostMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchAccounts();
    fetchPosts();
    fetchMetrics();

    const accountsSubscription = supabase
      .channel('marketing_instagram_accounts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'instagram_accounts',
        filter: clientNumber ? `client_number=eq.${clientNumber}` : undefined
      }, () => {
        fetchAccounts();
      })
      .subscribe();

    const postsSubscription = supabase
      .channel('marketing_instagram_posts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'instagram_posts',
        filter: clientNumber ? `client_number=eq.${clientNumber}` : undefined
      }, () => {
        fetchPosts();
      })
      .subscribe();

    const metricsSubscription = supabase
      .channel('marketing_instagram_metrics')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'instagram_post_metrics',
        filter: clientNumber ? `client_number=eq.${clientNumber}` : undefined
      }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      accountsSubscription.unsubscribe();
      postsSubscription.unsubscribe();
      metricsSubscription.unsubscribe();
    };
  }, [clientNumber]);

  useEffect(() => {
    if (selectedAccount) {
      fetchPosts();
      fetchMetrics();
    }
  }, [selectedAccount]);

  const fetchAccounts = async () => {
    try {
      let query = supabase
        .from('instagram_accounts')
        .select('*')
        .order('last_updated', { ascending: false });

      if (clientNumber) {
        query = query.eq('client_number', clientNumber);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAccounts(data || []);

      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].account_id);
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      let query = supabase
        .from('instagram_posts')
        .select('*')
        .order('date', { ascending: false });

      if (selectedAccount) {
        query = query.eq('account_id', selectedAccount);
      } else if (clientNumber) {
        query = query.eq('client_number', clientNumber);
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
        .from('instagram_post_metrics')
        .select('*')
        .order('date', { ascending: false });

      if (selectedAccount) {
        query = query.eq('account_id', selectedAccount);
      } else if (clientNumber) {
        query = query.eq('client_number', clientNumber);
      }

      const { data, error } = await query;

      if (error) throw error;

      const metricsMap: Record<string, PostMetrics> = {};
      data?.forEach((metric: any) => {
        if (!metricsMap[metric.media_id]) {
          metricsMap[metric.media_id] = metric;
        }
      });

      setMetrics(metricsMap);
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
    }
  };

  const handleSyncAccount = async (accountId: string) => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-instagram-accounts`,
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

      await handleSyncPosts(accountId);
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncPosts = async (accountId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-instagram-posts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId,
            clientNumber,
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
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Instagram Accounts</h3>
        </div>

        {accounts.length === 0 ? (
          <div className="p-6 text-center">
            <Instagram className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No Instagram accounts linked to this project</p>
            <p className="text-sm text-gray-500">
              Configure Instagram accounts in Settings and sync them with this client number: {clientNumber || 'N/A'}
            </p>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedAccount === account.account_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedAccount(account.account_id)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={account.profile_picture_url}
                    alt={account.username}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">@{account.username}</h4>
                    <p className="text-sm text-gray-600 truncate">{account.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900">{account.media_count}</p>
                    <p className="text-xs text-gray-600">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900">{account.followers_count.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900">{account.follows_count.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Following</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncAccount(account.account_id);
                  }}
                  disabled={syncing}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Account'}
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
                const postMetrics = metrics[post.media_id];
                return (
                  <div key={post.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative aspect-square bg-gray-100">
                      {post.media_type === 'VIDEO' ? (
                        <video
                          src={post.media_url}
                          poster={post.thumbnail_url}
                          className="w-full h-full object-cover"
                          controls={false}
                        />
                      ) : (
                        <img
                          src={post.media_url || post.thumbnail_url}
                          alt={post.caption}
                          className="w-full h-full object-cover"
                        />
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
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">{post.caption}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          <span>{post.likes_count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments_count.toLocaleString()}</span>
                        </div>
                      </div>

                      {postMetrics && (
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            <span>{postMetrics.impressions.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>{postMetrics.reach.toLocaleString()}</span>
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
            <div className="divide-y divide-gray-200">
              {posts.map((post) => {
                const postMetrics = metrics[post.media_id];
                return (
                  <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                        {post.media_type === 'VIDEO' ? (
                          <video
                            src={post.media_url}
                            poster={post.thumbnail_url}
                            className="w-full h-full object-cover"
                            controls={false}
                          />
                        ) : (
                          <img
                            src={post.media_url || post.thumbnail_url}
                            alt={post.caption}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm text-gray-700 line-clamp-3">{post.caption}</p>
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 p-2 text-gray-400 hover:text-gray-600"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4" />
                            <span>{post.likes_count.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            <span>{post.comments_count.toLocaleString()}</span>
                          </div>
                          {postMetrics && (
                            <>
                              <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                <span>{postMetrics.impressions.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                <span>{postMetrics.reach.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Bookmark className="w-4 h-4" />
                                <span>{postMetrics.saved.toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(post.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
