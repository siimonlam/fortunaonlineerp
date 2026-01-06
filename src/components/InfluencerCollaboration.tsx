import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, X, ExternalLink, TrendingUp, DollarSign } from 'lucide-react';

interface InfluencerCollab {
  id: string;
  marketing_project_id: string;
  item: string;
  collaborator_name: string;
  platform: string;
  category: string;
  primary_market: string;
  page_link: string;
  follower_count: number;
  engagement: number;
  suggested_price: number;
  outreach_date: string;
  address: string;
  status: string;
  collaboration_type: string;
  compensation: string;
  affiliate_link: string;
  coupon_code: string;
  post_link: string;
  post_likes: number;
  post_comments: number;
  sales: number;
  created_at: string;
}

interface InfluencerCollaborationProps {
  marketingProjectId: string;
}

export function InfluencerCollaboration({ marketingProjectId }: InfluencerCollaborationProps) {
  const { user } = useAuth();
  const [collaborations, setCollaborations] = useState<InfluencerCollab[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCollab, setEditingCollab] = useState<InfluencerCollab | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    item: '',
    collaborator_name: '',
    platform: '',
    category: '',
    primary_market: '',
    page_link: '',
    follower_count: '',
    engagement: '',
    suggested_price: '',
    outreach_date: '',
    address: '',
    status: 'Contacted',
    collaboration_type: '',
    compensation: '',
    affiliate_link: '',
    coupon_code: '',
    post_link: '',
    post_likes: '',
    post_comments: '',
    sales: '',
  });

  useEffect(() => {
    loadCollaborations();
    subscribeToChanges();
  }, [marketingProjectId]);

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
        .eq('marketing_project_id', marketingProjectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCollaborations(data || []);
    } catch (error) {
      console.error('Error loading collaborations:', error);
    } finally {
      setLoading(false);
    }
  };

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
        item: formData.item || null,
        collaborator_name: formData.collaborator_name,
        platform: formData.platform || null,
        category: formData.category || null,
        primary_market: formData.primary_market || null,
        page_link: formData.page_link || null,
        follower_count: formData.follower_count ? parseInt(formData.follower_count) : null,
        engagement: formData.engagement ? parseFloat(formData.engagement) : null,
        suggested_price: formData.suggested_price ? parseFloat(formData.suggested_price) : null,
        outreach_date: formData.outreach_date || null,
        address: formData.address || null,
        status: formData.status,
        collaboration_type: formData.collaboration_type || null,
        compensation: formData.compensation || null,
        affiliate_link: formData.affiliate_link || null,
        coupon_code: formData.coupon_code || null,
        post_link: formData.post_link || null,
        post_likes: formData.post_likes ? parseInt(formData.post_likes) : 0,
        post_comments: formData.post_comments ? parseInt(formData.post_comments) : 0,
        sales: formData.sales ? parseFloat(formData.sales) : 0,
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
      item: collab.item || '',
      collaborator_name: collab.collaborator_name || '',
      platform: collab.platform || '',
      category: collab.category || '',
      primary_market: collab.primary_market || '',
      page_link: collab.page_link || '',
      follower_count: collab.follower_count?.toString() || '',
      engagement: collab.engagement?.toString() || '',
      suggested_price: collab.suggested_price?.toString() || '',
      outreach_date: collab.outreach_date || '',
      address: collab.address || '',
      status: collab.status || 'Contacted',
      collaboration_type: collab.collaboration_type || '',
      compensation: collab.compensation || '',
      affiliate_link: collab.affiliate_link || '',
      coupon_code: collab.coupon_code || '',
      post_link: collab.post_link || '',
      post_likes: collab.post_likes?.toString() || '',
      post_comments: collab.post_comments?.toString() || '',
      sales: collab.sales?.toString() || '',
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

  const closeModal = () => {
    setShowModal(false);
    setEditingCollab(null);
    setFormData({
      item: '',
      collaborator_name: '',
      platform: '',
      category: '',
      primary_market: '',
      page_link: '',
      follower_count: '',
      engagement: '',
      suggested_price: '',
      outreach_date: '',
      address: '',
      status: 'Contacted',
      collaboration_type: '',
      compensation: '',
      affiliate_link: '',
      coupon_code: '',
      post_link: '',
      post_likes: '',
      post_comments: '',
      sales: '',
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
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Collaboration
        </button>
      </div>

      {collaborations.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <p className="text-slate-600 mb-4">No influencer collaborations yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Add your first collaboration
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Collaborator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Market</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Followers</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Engagement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Outreach</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Post Likes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Post Comments</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Sales</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {collaborations.map((collab) => (
                <tr key={collab.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.item || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-slate-900">{collab.collaborator_name}</div>
                    {collab.page_link && (
                      <a href={collab.page_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                        View Profile <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.platform || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.category || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.primary_market || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.follower_count ? collab.follower_count.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.engagement ? `${collab.engagement}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.suggested_price ? `$${collab.suggested_price.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.outreach_date ? new Date(collab.outreach_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(collab.status)}`}>
                      {collab.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{collab.collaboration_type || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {collab.post_link ? (
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Item/Product</label>
                    <input
                      type="text"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                    <input
                      type="text"
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Instagram, TikTok, YouTube..."
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

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primary Market</label>
                    <input
                      type="text"
                      value={formData.primary_market}
                      onChange={(e) => setFormData({ ...formData, primary_market: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Hong Kong, China, Asia..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Page Link</label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Suggested Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.suggested_price}
                      onChange={(e) => setFormData({ ...formData, suggested_price: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
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

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Compensation</label>
                    <input
                      type="text"
                      value={formData.compensation}
                      onChange={(e) => setFormData({ ...formData, compensation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Monetary, Product, Commission..."
                    />
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
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Post Link</label>
                    <input
                      type="url"
                      value={formData.post_link}
                      onChange={(e) => setFormData({ ...formData, post_link: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://..."
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
