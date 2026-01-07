import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FetchRequest {
  postUrl: string;
  collaborationId: string;
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/\s]{11})/,
    /youtube\.com\/shorts\/([^&\?\/\s]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractInstagramShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function detectPlatform(url: string): 'youtube' | 'instagram' | 'facebook' | 'unknown' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
  return 'unknown';
}

async function fetchYouTubeMetrics(videoId: string, apiKey: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`YouTube API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found');
  }

  const video = data.items[0];
  const stats = video.statistics;
  const snippet = video.snippet;

  return {
    views: parseInt(stats.viewCount || '0'),
    likes: parseInt(stats.likeCount || '0'),
    comments: parseInt(stats.commentCount || '0'),
    publishedAt: snippet.publishedAt,
    title: snippet.title,
  };
}

async function fetchInstagramMetrics(shortcode: string, postUrl: string, accessToken: string, businessAccountId: string) {
  try {
    const oembedUrl = `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&access_token=${accessToken}`;
    const oembedResponse = await fetch(oembedUrl);

    if (!oembedResponse.ok) {
      const error = await oembedResponse.json();
      throw new Error(`Instagram OEmbed error: ${error.error?.message || 'Unknown error'}`);
    }

    const oembedData = await oembedResponse.json();
    const username = oembedData.author_name;

    if (!username) {
      throw new Error('Could not extract username from post');
    }

    const discoveryUrl = `https://graph.facebook.com/v21.0/${businessAccountId}?fields=business_discovery.username(${username}){media.limit(50){shortcode,like_count,comments_count,timestamp,media_type}}&access_token=${accessToken}`;
    const discoveryResponse = await fetch(discoveryUrl);

    if (!discoveryResponse.ok) {
      const error = await discoveryResponse.json();
      throw new Error(`Instagram Business Discovery error: ${error.error?.message || 'Unknown error'}`);
    }

    const discoveryData = await discoveryResponse.json();
    const media = discoveryData.business_discovery?.media?.data || [];

    const post = media.find((item: any) => item.shortcode === shortcode);

    if (!post) {
      throw new Error('Post too old to track via Discovery API or not found in recent media');
    }

    return {
      views: 0,
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
      publishedAt: post.timestamp,
      mediaType: post.media_type,
    };
  } catch (error: any) {
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { postUrl, collaborationId }: FetchRequest = await req.json();

    if (!postUrl) {
      throw new Error('Post URL is required');
    }

    const platform = detectPlatform(postUrl);

    if (platform === 'unknown') {
      throw new Error('Unsupported platform. Only YouTube and Instagram are supported.');
    }

    if (platform === 'facebook') {
      throw new Error('Facebook public tracking is not supported.');
    }

    let metrics: any = null;

    if (platform === 'youtube') {
      const { data: youtubeKey } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'youtube_api_key')
        .maybeSingle();

      if (!youtubeKey?.value) {
        throw new Error('YouTube API key not configured in system settings');
      }

      const videoId = extractYouTubeVideoId(postUrl);
      if (!videoId) {
        throw new Error('Could not extract YouTube video ID from URL');
      }

      metrics = await fetchYouTubeMetrics(videoId, youtubeKey.value);
    } else if (platform === 'instagram') {
      const [tokenData, businessIdData] = await Promise.all([
        supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'meta_ads_access_token')
          .maybeSingle(),
        supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'instagram_business_account_id')
          .maybeSingle()
      ]);

      if (!tokenData?.data?.value) {
        throw new Error('Instagram access token not configured in system settings');
      }

      if (!businessIdData?.data?.value) {
        throw new Error('Instagram Business Account ID not configured in system settings');
      }

      const shortcode = extractInstagramShortcode(postUrl);
      if (!shortcode) {
        throw new Error('Could not extract Instagram shortcode from URL');
      }

      metrics = await fetchInstagramMetrics(
        shortcode,
        postUrl,
        tokenData.data.value,
        businessIdData.data.value
      );
    }

    if (collaborationId) {
      const updateData: any = {
        post_likes: metrics.likes,
        post_comments: metrics.comments,
        post_views: metrics.views || 0,
        updated_at: new Date().toISOString(),
      };

      if (metrics.publishedAt) {
        updateData.post_date = new Date(metrics.publishedAt).toISOString().split('T')[0];
      }

      const { error: updateError } = await supabase
        .from('marketing_influencer_collaborations')
        .update(updateData)
        .eq('id', collaborationId);

      if (updateError) {
        console.error('Error updating collaboration:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform,
        metrics: {
          views: metrics.views || 0,
          likes: metrics.likes,
          comments: metrics.comments,
          publishedAt: metrics.publishedAt,
          title: metrics.title || null,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Fetch error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});