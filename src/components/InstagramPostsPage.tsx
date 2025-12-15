import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Instagram, RefreshCw, ArrowLeft, Heart, MessageCircle, Eye, TrendingUp, Bookmark, ExternalLink, Calendar, BarChart3 } from 'lucide-react';

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

interface InstagramAccount {
  account_id: string;
  username: string;
  name: string;
  profile_picture_url: string;
}

export default function InstagramPostsPage() {
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [metrics, setMetrics] = useState<Record<string, PostMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);

  const accountId = new URLSearchParams(window.location.search).get('accountId');

  useEffect(() => {
    if (accountId) {
      fetchAccount();
      fetchPosts();
      fetchMetrics();

      const postsSubscription = supabase
        .channel('instagram_posts_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'instagram_posts',
          filter: `account_id=eq.${accountId}`
        }, () => {
          fetchPosts();
        })
        .subscribe();

      const metricsSubscription = supabase
        .channel('instagram_metrics_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'instagram_post_metrics',
          filter: `account_id=eq.${accountId}`
        }, () => {
          fetchMetrics();
        })
        .subscribe();

      return () => {
        postsSubscription.unsubscribe();
        metricsSubscription.unsubscribe();
      };
    }
  }, [accountId]);

  const fetchAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('instagram_accounts')
        .select('account_id, username, name, profile_picture_url')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) throw error;
      setAccount(data);
    } catch (err: any) {
      console.error('Error fetching account:', err);
      setError(err.message);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('instagram_posts')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err: any) {
      console.error('Error fetching posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('instagram_post_metrics')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) throw error;

      const metricsMap: Record<string, PostMetrics> = {};
      (data || []).forEach((metric: any) => {
        if (!metricsMap[metric.media_id]) {
          metricsMap[metric.media_id] = {
            impressions: metric.impressions,
            reach: metric.reach,
            engagement: metric.engagement,
            saved: metric.saved,
            video_views: metric.video_views,
            shares: metric.shares,
          };
        }
      });
      setMetrics(metricsMap);
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
    }
  };

  const handleSyncPosts = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

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
            clientNumber: null,
            limit: 25
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync posts');
      }

      setSuccessMessage(result.message);
      await fetchPosts();
      await fetchMetrics();
    } catch (err: any) {
      console.error('Error syncing posts:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
      case 'REELS':
        return '🎥';
      case 'CAROUSEL_ALBUM':
        return '📷';
      default:
        return '🖼️';
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <a
            href="/instagram-accounts"
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft size={20} />
          </a>
          <div className="flex items-center gap-3">
            {account?.profile_picture_url ? (
              <img
                src={account.profile_picture_url}
                alt={account.username}
                className="w-12 h-12 rounded-full border-2 border-gray-200"
              />
            ) : (
              <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-2 rounded-lg">
                <Instagram className="text-white" size={24} />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {account?.name || account?.username || 'Instagram Posts'}
              </h1>
              <p className="text-sm text-gray-600">
                @{account?.username} - {posts.length} posts
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSyncPosts}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? (
            <>
              <RefreshCw className="animate-spin" size={18} />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Sync Posts
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Instagram className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No posts yet</h3>
          <p className="text-gray-600 mb-4">
            Click "Sync Posts" to fetch the latest posts from this Instagram account
          </p>
          <button
            onClick={handleSyncPosts}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <RefreshCw size={20} />
            Sync Posts
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const postMetrics = metrics[post.media_id];
            return (
              <div
                key={post.id}
                className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                <div className="relative">
                  <img
                    src={post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url}
                    alt={post.caption}
                    className="w-full h-64 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/400x400?text=No+Image';
                    }}
                  />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                    {getMediaTypeIcon(post.media_type)} {post.media_type}
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                    {post.caption || 'No caption'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Heart size={16} className="text-red-500" />
                      <span>{formatNumber(post.likes_count)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MessageCircle size={16} className="text-blue-500" />
                      <span>{formatNumber(post.comments_count)}</span>
                    </div>
                  </div>

                  {postMetrics && (
                    <div className="grid grid-cols-2 gap-2 mb-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Eye size={14} className="text-purple-500" />
                        <span>{formatNumber(postMetrics.impressions)} impressions</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <TrendingUp size={14} className="text-green-500" />
                        <span>{formatNumber(postMetrics.reach)} reach</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <BarChart3 size={14} className="text-orange-500" />
                        <span>{formatNumber(postMetrics.engagement)} engagement</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Bookmark size={14} className="text-yellow-500" />
                        <span>{formatNumber(postMetrics.saved)} saved</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>{formatDate(post.date)}</span>
                    </div>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPost && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Post Details</h2>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <img
                    src={selectedPost.media_type === 'VIDEO' ? selectedPost.thumbnail_url : selectedPost.media_url}
                    alt={selectedPost.caption}
                    className="w-full rounded-lg"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/400x400?text=No+Image';
                    }}
                  />
                </div>

                <div>
                  <div className="mb-4">
                    <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      {getMediaTypeIcon(selectedPost.media_type)} {selectedPost.media_type}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-4">{selectedPost.caption || 'No caption'}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded p-3">
                      <div className="flex items-center gap-2 text-red-500 mb-1">
                        <Heart size={18} />
                        <span className="font-semibold">Likes</span>
                      </div>
                      <div className="text-2xl font-bold">{formatNumber(selectedPost.likes_count)}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <div className="flex items-center gap-2 text-blue-500 mb-1">
                        <MessageCircle size={18} />
                        <span className="font-semibold">Comments</span>
                      </div>
                      <div className="text-2xl font-bold">{formatNumber(selectedPost.comments_count)}</div>
                    </div>
                  </div>

                  {metrics[selectedPost.media_id] && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-purple-50 rounded p-3">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                          <Eye size={18} />
                          <span className="font-semibold text-sm">Impressions</span>
                        </div>
                        <div className="text-xl font-bold">{formatNumber(metrics[selectedPost.media_id].impressions)}</div>
                      </div>
                      <div className="bg-green-50 rounded p-3">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                          <TrendingUp size={18} />
                          <span className="font-semibold text-sm">Reach</span>
                        </div>
                        <div className="text-xl font-bold">{formatNumber(metrics[selectedPost.media_id].reach)}</div>
                      </div>
                      <div className="bg-orange-50 rounded p-3">
                        <div className="flex items-center gap-2 text-orange-600 mb-1">
                          <BarChart3 size={18} />
                          <span className="font-semibold text-sm">Engagement</span>
                        </div>
                        <div className="text-xl font-bold">{formatNumber(metrics[selectedPost.media_id].engagement)}</div>
                      </div>
                      <div className="bg-yellow-50 rounded p-3">
                        <div className="flex items-center gap-2 text-yellow-600 mb-1">
                          <Bookmark size={18} />
                          <span className="font-semibold text-sm">Saved</span>
                        </div>
                        <div className="text-xl font-bold">{formatNumber(metrics[selectedPost.media_id].saved)}</div>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      <span>Posted: {formatDate(selectedPost.date)}</span>
                    </div>
                  </div>

                  <a
                    href={selectedPost.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View on Instagram
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
