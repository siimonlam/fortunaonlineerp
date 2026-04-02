import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CreditCard as Edit2, Trash2, X, ExternalLink, TrendingUp, DollarSign, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Eye, Download, Upload, Image as ImageIcon, Clipboard } from 'lucide-react';

interface PostLink {
  url: string;
  description?: string;
}

interface Screenshot {
  drive_url: string;
  file_id: string;
  filename: string;
  uploaded_at: string;
}

interface InfluencerCollab {
  id: string;
  marketing_project_id: string;
  campaign_name: string;
  item: string;
  collaborator_name: string;
  phone_number: string;
  platform: string;
  platforms: string[];
  category: string;
  primary_market: string;
  primary_markets: string[];
  page_link: string;
  tiktok_link: string;
  youtube_link: string;
  facebook_link: string;
  instagram_link: string;
  script: string;
  follower_count: number;
  engagement: number;
  suggested_price: number;
  outreach_date: string;
  address: string;
  status: string;
  collaboration_type: string;
  compensation: string;
  compensation_currency: string;
  compensation_amount: number;
  affiliate_link: string;
  coupon_code: string;
  post_link: string;
  post_links: PostLink[];
  post_likes: number;
  post_comments: number;
  post_views: number;
  post_date: string;
  sales: number;
  use_right: string[];
  ad_boosted: boolean;
  compensation_paid: boolean;
  screenshots: Screenshot[];
  created_at: string;
}

interface InfluencerCollaborationProps {
  marketingProjectId: string;
}

type SortField = 'outreach_date' | 'collaborator_name' | 'platform' | 'follower_count' | 'engagement' | 'suggested_price' | 'status' | 'post_likes' | 'post_comments' | 'post_views' | 'sales' | 'post_date';
type SortDirection = 'asc' | 'desc';

export function InfluencerCollaboration({ marketingProjectId }: InfluencerCollaborationProps) {
  const { user } = useAuth();
  const [collaborations, setCollaborations] = useState<InfluencerCollab[]>([]);
  const [filteredCollaborations, setFilteredCollaborations] = useState<InfluencerCollab[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCollab, setEditingCollab] = useState<InfluencerCollab | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingMetrics, setUpdatingMetrics] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('outreach_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [projectFolderId, setProjectFolderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    campaign_name: '',
    item: '',
    collaborator_name: '',
    phone_number: '',
    platform: '',
    platforms: [] as string[],
    category: '',
    primary_market: '',
    primary_markets: [] as string[],
    page_link: '',
    tiktok_link: '',
    youtube_link: '',
    facebook_link: '',
    instagram_link: '',
    script: '',
    follower_count: '',
    engagement: '',
    suggested_price: '',
    outreach_date: '',
    address: '',
    status: 'Contacted',
    collaboration_type: '',
    compensation: '',
    compensation_currency: 'USD',
    compensation_amount: '',
    affiliate_link: '',
    coupon_code: '',
    post_link: '',
    post_links: [] as PostLink[],
    post_likes: '',
    post_comments: '',
    post_views: '',
    post_date: '',
    sales: '',
    use_right: [] as string[],
    ad_boosted: false,
    compensation_paid: false,
  });

  useEffect(() => {
    loadCollaborations();
    loadProjectFolderId();
    subscribeToChanges();
  }, [marketingProjectId]);

  useEffect(() => {
    filterAndSortCollaborations();
  }, [collaborations, searchQuery, platformFilter, statusFilter, sortField, sortDirection]);

  const loadProjectFolderId = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_projects')
        .select('google_drive_folder_id')
        .eq('id', marketingProjectId)
        .single();

      if (error) throw error;
      setProjectFolderId(data?.google_drive_folder_id || null);
    } catch (error) {
      console.error('Error loading project folder ID:', error);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('influencer_collab_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_influencer_collaborations', filter: `marketing_project_id=eq.${marketingProjectId}` }, () => {
        loadCollaborations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadCollaborations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('marketing_influencer_collaborations')
        .select('*')
        .eq('marketing_project_id', marketingProjectId);

      if (error) throw error;
      setCollaborations(data || []);
    } catch (error) {
      console.error('Error loading collaborations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCollaborations = () => {
    let filtered = [...collaborations];

    if (searchQuery) {
      filtered = filtered.filter(collab =>
        collab.collaborator_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collab.item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collab.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        collab.primary_market?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (platformFilter) {
      filtered = filtered.filter(collab =>
        collab.platforms && collab.platforms.includes(platformFilter)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(collab => collab.status === statusFilter);
    }

    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (sortField === 'outreach_date' || sortField === 'post_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredCollaborations(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Campaign Name',
      'Item',
      'Collaborator Name',
      'Phone Number',
      'Platforms',
      'Category',
      'Primary Markets',
      'Page Link',
      'TikTok Link',
      'YouTube Link',
      'Facebook Link',
      'Instagram Link',
      'Script',
      'Follower Count',
      'Engagement',
      'Suggested Price',
      'Outreach Date',
      'Address',
      'Status',
      'Collaboration Type',
      'Compensation',
      'Compensation Currency',
      'Compensation Amount',
      'Affiliate Link',
      'Coupon Code',
      'Post Links',
      'Post Likes',
      'Post Comments',
      'Post Views',
      'Post Date',
      'Sales',
      'Use Rights',
      'Ad Boosted',
      'Compensation Paid'
    ];

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          return value.map(item => `${item.url}${item.description ? ' (' + item.description + ')' : ''}`).join('; ');
        }
        return value.join('; ');
      }
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = filteredCollaborations.map(collab => [
      escapeCSV(collab.campaign_name),
      escapeCSV(collab.item),
      escapeCSV(collab.collaborator_name),
      escapeCSV(collab.phone_number),
      escapeCSV(collab.platforms),
      escapeCSV(collab.category),
      escapeCSV(collab.primary_markets),
      escapeCSV(collab.page_link),
      escapeCSV(collab.tiktok_link),
      escapeCSV(collab.youtube_link),
      escapeCSV(collab.facebook_link),
      escapeCSV(collab.instagram_link),
      escapeCSV(collab.script),
      escapeCSV(collab.follower_count),
      escapeCSV(collab.engagement),
      escapeCSV(collab.suggested_price),
      escapeCSV(collab.outreach_date),
      escapeCSV(collab.address),
      escapeCSV(collab.status),
      escapeCSV(collab.collaboration_type),
      escapeCSV(collab.compensation),
      escapeCSV(collab.compensation_currency),
      escapeCSV(collab.compensation_amount),
      escapeCSV(collab.affiliate_link),
      escapeCSV(collab.coupon_code),
      escapeCSV(collab.post_links),
      escapeCSV(collab.post_likes),
      escapeCSV(collab.post_comments),
      escapeCSV(collab.post_views),
      escapeCSV(collab.post_date),
      escapeCSV(collab.sales),
      escapeCSV(collab.use_right),
      escapeCSV(collab.ad_boosted ? 'Yes' : 'No'),
      escapeCSV(collab.compensation_paid ? 'Yes' : 'No')
    ].join(','));

    const csvContent = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `influencer_collaborations_${timestamp}.csv`;
    link.click();
  };

  const handleFileUpload = async (file: File, collab: InfluencerCollab) => {
    if (!projectFolderId) {
      alert('Project folder not found. Please ensure the marketing project has a Google Drive folder.');
      return;
    }

    try {
      setUploadingScreenshot(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        await uploadScreenshot(base64Data, collab);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      alert('Failed to upload screenshot');
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handlePaste = async (e: ClipboardEvent, collab: InfluencerCollab) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleFileUpload(file, collab);
        }
        break;
      }
    }
  };

  const uploadScreenshot = async (imageData: string, collab: InfluencerCollab) => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-influencer-screenshot`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collaborationId: collab.id,
          projectFolderId: projectFolderId,
          collaboratorName: collab.collaborator_name,
          postDate: collab.post_date,
          imageData: imageData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload screenshot');
      }

      const result = await response.json();

      await loadCollaborations();

      alert(`Screenshot uploaded successfully: ${result.screenshot.filename}`);
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      throw error;
    }
  };

  const deleteScreenshot = async (collab: InfluencerCollab, screenshotIndex: number) => {
    if (!confirm('Are you sure you want to delete this screenshot?')) return;

    try {
      const updatedScreenshots = collab.screenshots.filter((_, index) => index !== screenshotIndex);

      const { error } = await supabase
        .from('marketing_influencer_collaborations')
        .update({ screenshots: updatedScreenshots })
        .eq('id', collab.id);

      if (error) throw error;

      await loadCollaborations();
    } catch (error) {
      console.error('Error deleting screenshot:', error);
      alert('Failed to delete screenshot');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const uniquePlatforms = Array.from(new Set(collaborations.flatMap(c => c.platforms || []).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(collaborations.map(c => c.status)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user.id)
        .single();

      const collabData = {
        marketing_project_id: marketingProjectId,
        campaign_name: formData.campaign_name || null,
        item: formData.item || null,
        collaborator_name: formData.collaborator_name,
        phone_number: formData.phone_number || null,
        platform: formData.platform || null,
        platforms: formData.platforms.length > 0 ? formData.platforms : null,
        category: formData.category || null,
        primary_market: formData.primary_market || null,
        primary_markets: formData.primary_markets.length > 0 ? formData.primary_markets : null,
        page_link: formData.page_link || null,
        tiktok_link: formData.tiktok_link || null,
        youtube_link: formData.youtube_link || null,
        facebook_link: formData.facebook_link || null,
        instagram_link: formData.instagram_link || null,
        script: formData.script || null,
        follower_count: formData.follower_count ? parseInt(formData.follower_count) : null,
        engagement: formData.engagement ? parseFloat(formData.engagement) : null,
        suggested_price: formData.suggested_price ? parseFloat(formData.suggested_price) : null,
        outreach_date: formData.outreach_date || null,
        address: formData.address || null,
        status: formData.status,
        collaboration_type: formData.collaboration_type || null,
        compensation: formData.compensation || null,
        compensation_currency: formData.compensation_currency || 'USD',
        compensation_amount: formData.compensation_amount ? parseFloat(formData.compensation_amount) : null,
        affiliate_link: formData.affiliate_link || null,
        coupon_code: formData.coupon_code || null,
        post_link: formData.post_link || null,
        post_links: formData.post_links.filter(link => link.url.trim() !== ''),
        post_likes: formData.post_likes ? parseInt(formData.post_likes) : 0,
        post_comments: formData.post_comments ? parseInt(formData.post_comments) : 0,
        post_views: formData.post_views ? parseInt(formData.post_views) : 0,
        post_date: formData.post_date || null,
        sales: formData.sales ? parseFloat(formData.sales) : 0,
        use_right: formData.use_right.length > 0 ? formData.use_right : null,
        ad_boosted: formData.ad_boosted,
        compensation_paid: formData.compensation_paid,
        created_by: staffData?.id,
      };

      if (editingCollab) {
        const { error } = await supabase
          .from('marketing_influencer_collaborations')
          .update(collabData)
          .eq('id', editingCollab.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketing_influencer_collaborations')
          .insert(collabData);

        if (error) throw error;
      }

      closeModal();
      loadCollaborations();
    } catch (error) {
      console.error('Error saving collaboration:', error);
      alert('Failed to save collaboration');
    }
  };

  const handleEdit = (collab: InfluencerCollab) => {
    setEditingCollab(collab);
    setFormData({
      campaign_name: collab.campaign_name || '',
      item: collab.item || '',
      collaborator_name: collab.collaborator_name || '',
      phone_number: collab.phone_number || '',
      platform: collab.platform || '',
      platforms: collab.platforms || [],
      category: collab.category || '',
      primary_market: collab.primary_market || '',
      primary_markets: collab.primary_markets || [],
      page_link: collab.page_link || '',
      tiktok_link: collab.tiktok_link || '',
      youtube_link: collab.youtube_link || '',
      facebook_link: collab.facebook_link || '',
      instagram_link: collab.instagram_link || '',
      script: collab.script || '',
      follower_count: collab.follower_count?.toString() || '',
      engagement: collab.engagement?.toString() || '',
      suggested_price: collab.suggested_price?.toString() || '',
      outreach_date: collab.outreach_date || '',
      address: collab.address || '',
      status: collab.status || 'Contacted',
      collaboration_type: collab.collaboration_type || '',
      compensation: collab.compensation || '',
      compensation_currency: collab.compensation_currency || 'USD',
      compensation_amount: collab.compensation_amount?.toString() || '',
      affiliate_link: collab.affiliate_link || '',
      coupon_code: collab.coupon_code || '',
      post_link: collab.post_link || '',
      post_links: collab.post_links && collab.post_links.length > 0 ? collab.post_links : [{ url: '', description: '' }],
      post_likes: collab.post_likes?.toString() || '',
      post_comments: collab.post_comments?.toString() || '',
      post_views: collab.post_views?.toString() || '',
      post_date: collab.post_date || '',
      sales: collab.sales?.toString() || '',
      use_right: collab.use_right || [],
      ad_boosted: collab.ad_boosted || false,
      compensation_paid: collab.compensation_paid || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collaboration?')) return;

    try {
      const { error } = await supabase
        .from('marketing_influencer_collaborations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadCollaborations();
    } catch (error) {
      console.error('Error deleting collaboration:', error);
      alert('Failed to delete collaboration');
    }
  };

  const handleUpdateMetrics = async (collab: InfluencerCollab) => {
    if (!collab.post_link) {
      alert('No post link available');
      return;
    }

    try {
      setUpdatingMetrics(collab.id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-influencer-post-metrics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postUrl: collab.post_link,
            collaborationId: collab.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch metrics');
      }

      alert(`Successfully updated metrics!\nViews: ${result.metrics.views.toLocaleString()}\nLikes: ${result.metrics.likes.toLocaleString()}\nComments: ${result.metrics.comments.toLocaleString()}`);
      await loadCollaborations();
    } catch (error: any) {
      console.error('Error updating metrics:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setUpdatingMetrics(null);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCollab(null);
    setFormData({
      campaign_name: '',
      item: '',
      collaborator_name: '',
      phone_number: '',
      platform: '',
      platforms: [] as string[],
      category: '',
      primary_market: '',
      primary_markets: [] as string[],
      page_link: '',
      tiktok_link: '',
      youtube_link: '',
      facebook_link: '',
      instagram_link: '',
      script: '',
      follower_count: '',
      engagement: '',
      suggested_price: '',
      outreach_date: '',
      address: '',
      status: 'Contacted',
      collaboration_type: '',
      compensation: '',
      compensation_currency: 'USD',
      compensation_amount: '',
      affiliate_link: '',
      coupon_code: '',
      post_link: '',
      post_links: [] as PostLink[],
      post_likes: '',
      post_comments: '',
      post_views: '',
      post_date: '',
      sales: '',
      use_right: [] as string[],
      ad_boosted: false,
      compensation_paid: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Contacted': return 'bg-blue-100 text-blue-700';
      case 'Negotiating': return 'bg-yellow-100 text-yellow-700';
      case 'Sent Sample': return 'bg-purple-100 text-purple-700';
      case 'Posted': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading collaborations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Influencer Collaborations</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Collaboration
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, item, category, market..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-600" />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Platforms</option>
            {uniquePlatforms.map((platform) => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          {(searchQuery || platformFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPlatformFilter('');
                setStatusFilter('');
              }}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {filteredCollaborations.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <p className="text-slate-600 mb-4">
            {collaborations.length === 0 ? 'No influencer collaborations yet' : 'No collaborations match your filters'}
          </p>
          {collaborations.length === 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first collaboration
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow">
            <thead className="bg-slate-100">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('outreach_date')}
                >
                  <div className="flex items-center gap-1">
                    Outreach Date {getSortIcon('outreach_date')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('collaborator_name')}
                >
                  <div className="flex items-center gap-1">
                    Collaborator {getSortIcon('collaborator_name')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Platforms</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Use Right</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Markets</th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('follower_count')}
                >
                  <div className="flex items-center gap-1">
                    Followers {getSortIcon('follower_count')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('engagement')}
                >
                  <div className="flex items-center gap-1">
                    Engagement {getSortIcon('engagement')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                  Compensation
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status {getSortIcon('status')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Type</th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('post_date')}
                >
                  <div className="flex items-center gap-1">
                    Post Date {getSortIcon('post_date')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase">Ad Boosted</th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('post_views')}
                >
                  <div className="flex items-center gap-1">
                    Views {getSortIcon('post_views')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('post_likes')}
                >
                  <div className="flex items-center gap-1">
                    Likes {getSortIcon('post_likes')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('post_comments')}
                >
                  <div className="flex items-center gap-1">
                    Comments {getSortIcon('post_comments')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase cursor-pointer hover:bg-slate-200"
                  onClick={() => handleSort('sales')}
                >
                  <div className="flex items-center gap-1">
                    Sales {getSortIcon('sales')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCollaborations.map((collab) => (
                <tr
                  key={collab.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
                      return;
                    }
                    handleEdit(collab);
                  }}
                >
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.outreach_date ? new Date(collab.outreach_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-slate-900">{collab.collaborator_name}</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {collab.instagram_link && (
                        <a href={collab.instagram_link} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline text-xs flex items-center gap-1">
                          Instagram <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {collab.tiktok_link && (
                        <a href={collab.tiktok_link} target="_blank" rel="noopener noreferrer" className="text-slate-900 hover:underline text-xs flex items-center gap-1">
                          TikTok <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {collab.facebook_link && (
                        <a href={collab.facebook_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                          Facebook <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {collab.youtube_link && (
                        <a href={collab.youtube_link} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline text-xs flex items-center gap-1">
                          YouTube <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {collab.page_link && !collab.instagram_link && !collab.tiktok_link && !collab.facebook_link && !collab.youtube_link && (
                        <a href={collab.page_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                          View Profile <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.campaign_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.item || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {collab.platforms && collab.platforms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {collab.platforms.map((platform) => (
                          <span key={platform} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                            {platform}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {collab.use_right && collab.use_right.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {collab.use_right.map((right) => (
                          <span key={right} className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            {right}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.category || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {collab.primary_markets && collab.primary_markets.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {collab.primary_markets.map((market) => (
                          <span key={market} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {market}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.follower_count ? collab.follower_count.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.engagement ? `${collab.engagement}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {collab.compensation_amount ? (
                      <div className="space-y-1">
                        <div className="text-slate-900">
                          {collab.compensation_currency || 'USD'} {collab.compensation_amount.toLocaleString()}
                        </div>
                        {collab.compensation_paid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            <DollarSign className="w-3 h-3" />
                            Paid
                          </span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(collab.status)}`}>
                      {collab.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.collaboration_type || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.post_date ? new Date(collab.post_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {collab.ad_boosted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                        <TrendingUp className="w-3 h-3" />
                        Boosted
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.post_views?.toLocaleString() || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.post_links && collab.post_links.length > 0 ? (
                      <div className="space-y-1">
                        {collab.post_links.map((link, idx) => (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                            title={link.description || link.url}
                          >
                            <ExternalLink className="w-3 h-3" />
                            {link.description || `Post ${idx + 1}`}
                          </a>
                        ))}
                        <div className="text-slate-900">{collab.post_likes?.toLocaleString() || 0} likes</div>
                      </div>
                    ) : collab.post_link ? (
                      <a href={collab.post_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {collab.post_likes?.toLocaleString() || 0}
                      </a>
                    ) : (
                      collab.post_likes?.toLocaleString() || '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.post_comments?.toLocaleString() || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">
                    {collab.sales ? `$${collab.sales.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {collab.post_link && (
                        <button
                          onClick={() => handleUpdateMetrics(collab)}
                          disabled={updatingMetrics === collab.id}
                          className="text-green-600 hover:text-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Update post metrics"
                        >
                          {updatingMetrics === collab.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(collab)}
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(collab.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingCollab ? 'Edit Collaboration' : 'Add New Collaboration'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name</label>
                    <input
                      type="text"
                      value={formData.campaign_name}
                      onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Summer Sale 2026, Product Launch..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Collaborator Name *</label>
                    <input
                      type="text"
                      value={formData.collaborator_name}
                      onChange={(e) => setFormData({ ...formData, collaborator_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+852 1234 5678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Item/Product</label>
                    <input
                      type="text"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Fashion, Tech, Food..."
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Primary Markets (Select Multiple)</label>
                    <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-3 space-y-2">
                      {['United States', 'United Kingdom', 'Hong Kong', 'China', 'Canada', 'Australia', 'Singapore', 'Japan', 'South Korea', 'Taiwan', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'India', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Brazil', 'Mexico', 'United Arab Emirates', 'Saudi Arabia'].map((country) => (
                        <label key={country} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={formData.primary_markets.includes(country)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, primary_markets: [...formData.primary_markets, country] });
                              } else {
                                setFormData({ ...formData, primary_markets: formData.primary_markets.filter(c => c !== country) });
                              }
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="text-sm text-slate-700">{country}</span>
                        </label>
                      ))}
                    </div>
                    {formData.primary_markets.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.primary_markets.map((market) => (
                          <span key={market} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {market}
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, primary_markets: formData.primary_markets.filter(m => m !== market) })}
                              className="text-blue-700 hover:text-blue-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Platforms (Select Multiple)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {['TikTok', 'YouTube', 'Facebook', 'Instagram', 'Others'].map((platform) => (
                        <label key={platform} className="flex items-center gap-2 p-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={formData.platforms.includes(platform)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, platforms: [...formData.platforms, platform] });
                              } else {
                                setFormData({ ...formData, platforms: formData.platforms.filter(p => p !== platform) });
                              }
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="text-sm text-slate-700">{platform}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Script / Talking Points</label>
                    <textarea
                      value={formData.script}
                      onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter collaboration script or talking points..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900">Social Media Links</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">TikTok Link</label>
                    <input
                      type="url"
                      value={formData.tiktok_link}
                      onChange={(e) => setFormData({ ...formData, tiktok_link: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://www.tiktok.com/@username"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">YouTube Link</label>
                    <input
                      type="url"
                      value={formData.youtube_link}
                      onChange={(e) => setFormData({ ...formData, youtube_link: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://www.youtube.com/@channelname"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Facebook Link</label>
                    <input
                      type="url"
                      value={formData.facebook_link}
                      onChange={(e) => setFormData({ ...formData, facebook_link: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://www.facebook.com/pagename"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Instagram Link</label>
                    <input
                      type="url"
                      value={formData.instagram_link}
                      onChange={(e) => setFormData({ ...formData, instagram_link: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://www.instagram.com/username"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Page Link (Legacy)</label>
                    <input
                      type="url"
                      value={formData.page_link}
                      onChange={(e) => setFormData({ ...formData, page_link: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900">Metrics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Follower Count</label>
                    <input
                      type="number"
                      value={formData.follower_count}
                      onChange={(e) => setFormData({ ...formData, follower_count: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Engagement (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.engagement}
                      onChange={(e) => setFormData({ ...formData, engagement: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Suggested Compensation Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.suggested_price}
                      onChange={(e) => setFormData({ ...formData, suggested_price: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900">Collaboration Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Contacted">Contacted</option>
                      <option value="Negotiating">Negotiating</option>
                      <option value="Sent Sample">Sent Sample</option>
                      <option value="Posted">Posted</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Outreach Date</label>
                    <input
                      type="date"
                      value={formData.outreach_date}
                      onChange={(e) => setFormData({ ...formData, outreach_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Collaboration Type</label>
                    <input
                      type="text"
                      value={formData.collaboration_type}
                      onChange={(e) => setFormData({ ...formData, collaboration_type: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Sponsored Post, Product Review..."
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Use Right</label>
                    <div className="grid grid-cols-4 gap-3">
                      {['KOL IG', 'KOL TIKTOK', 'KOL Facebook', 'Brand Accounts'].map((right) => (
                        <label key={right} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.use_right.includes(right)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, use_right: [...formData.use_right, right] });
                              } else {
                                setFormData({ ...formData, use_right: formData.use_right.filter(r => r !== right) });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{right}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Compensation</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <select
                          value={formData.compensation_currency}
                          onChange={(e) => setFormData({ ...formData, compensation_currency: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="HKD">HKD (HK$)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="CNY">CNY (¥)</option>
                          <option value="JPY">JPY (¥)</option>
                          <option value="SGD">SGD (S$)</option>
                          <option value="AUD">AUD (A$)</option>
                          <option value="CAD">CAD (C$)</option>
                          <option value="KRW">KRW (₩)</option>
                          <option value="TWD">TWD (NT$)</option>
                          <option value="MYR">MYR (RM)</option>
                          <option value="THB">THB (฿)</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.compensation_amount}
                          onChange={(e) => setFormData({ ...formData, compensation_amount: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Amount"
                          min="0"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={formData.compensation}
                          onChange={(e) => setFormData({ ...formData, compensation: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Type (Product, Commission...)"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.compensation_paid}
                          onChange={(e) => setFormData({ ...formData, compensation_paid: e.target.checked })}
                          className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          Compensation Paid
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Affiliate Link</label>
                    <input
                      type="url"
                      value={formData.affiliate_link}
                      onChange={(e) => setFormData({ ...formData, affiliate_link: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Coupon Code</label>
                    <input
                      type="text"
                      value={formData.coupon_code}
                      onChange={(e) => setFormData({ ...formData, coupon_code: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900">Post Performance</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Post Links</label>
                    {formData.post_links.map((link, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...formData.post_links];
                            newLinks[index] = { ...newLinks[index], url: e.target.value };
                            setFormData({ ...formData, post_links: newLinks });
                          }}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://..."
                        />
                        <input
                          type="text"
                          value={link.description || ''}
                          onChange={(e) => {
                            const newLinks = [...formData.post_links];
                            newLinks[index] = { ...newLinks[index], description: e.target.value };
                            setFormData({ ...formData, post_links: newLinks });
                          }}
                          className="w-48 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Description (optional)"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newLinks = formData.post_links.filter((_, i) => i !== index);
                            setFormData({ ...formData, post_links: newLinks });
                          }}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          post_links: [...formData.post_links, { url: '', description: '' }]
                        });
                      }}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Post Link
                    </button>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports YouTube and Instagram. Use the Update button in the table to fetch metrics automatically.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Post Date</label>
                    <input
                      type="date"
                      value={formData.post_date}
                      onChange={(e) => setFormData({ ...formData, post_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.ad_boosted}
                        onChange={(e) => setFormData({ ...formData, ad_boosted: e.target.checked })}
                        className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-orange-600" />
                        Ad Boosted
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Post Views</label>
                    <input
                      type="number"
                      value={formData.post_views}
                      onChange={(e) => setFormData({ ...formData, post_views: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Post Likes</label>
                    <input
                      type="number"
                      value={formData.post_likes}
                      onChange={(e) => setFormData({ ...formData, post_likes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Post Comments</label>
                    <input
                      type="number"
                      value={formData.post_comments}
                      onChange={(e) => setFormData({ ...formData, post_comments: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sales</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sales}
                      onChange={(e) => setFormData({ ...formData, sales: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {editingCollab && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Screenshots
                  </h4>

                  <div
                    ref={pasteAreaRef}
                    onPaste={(e: any) => handlePaste(e, editingCollab)}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-center gap-3">
                        <Upload className="w-8 h-8 text-slate-400" />
                        <Clipboard className="w-8 h-8 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Click to upload or paste from clipboard
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Screenshots will be saved to: marketing/KOL Program/
                        </p>
                        <p className="text-xs text-slate-500">
                          Filename: {(editingCollab.post_date || new Date().toISOString().split('T')[0]).replace(/-/g, '')}-{editingCollab.collaborator_name}-###
                        </p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, editingCollab);
                      }}
                    />
                  </div>

                  {uploadingScreenshot && (
                    <div className="text-center py-4">
                      <div className="inline-flex items-center gap-2 text-blue-600">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Uploading screenshot...
                      </div>
                    </div>
                  )}

                  {editingCollab.screenshots && editingCollab.screenshots.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {editingCollab.screenshots.map((screenshot, index) => (
                        <div key={index} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                          <a
                            href={screenshot.drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-video bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                            <div className="flex items-center justify-center h-full">
                              <ImageIcon className="w-8 h-8 text-slate-400" />
                            </div>
                          </a>
                          <div className="p-2 bg-white">
                            <p className="text-xs text-slate-600 truncate" title={screenshot.filename}>
                              {screenshot.filename}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(screenshot.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteScreenshot(editingCollab, index)}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingCollab ? 'Update' : 'Add'} Collaboration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
