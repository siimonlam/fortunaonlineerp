import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CheckCircle, Circle, Clock, Edit2, Trash2, User, Calendar, ExternalLink, X, ChevronDown, ChevronRight, Instagram, Facebook } from 'lucide-react';

interface SocialPost {
  id: string;
  marketing_project_id: string;
  title: string;
  content: string;
  design_link: string;
  scheduled_post_date: string;
  current_step: number;
  version: number;
  draft_edit_date: string;
  status: string;
  created_by: string;
  created_at: string;
  instagram_account_ids: string[];
  facebook_account_ids: string[];
  creator?: {
    full_name: string;
  };
}

interface PostStep {
  id: string;
  post_id: string;
  step_number: number;
  step_name: string;
  assigned_to: string;
  due_date: string;
  completed_at: string;
  completed_by: string;
  status: string;
  notes: string;
  assignee?: {
    full_name: string;
  };
  completer?: {
    full_name: string;
  };
}

interface SocialMediaPostsManagerProps {
  marketingProjectId: string;
}

export function SocialMediaPostsManager({ marketingProjectId }: SocialMediaPostsManagerProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [postSteps, setPostSteps] = useState<Record<string, PostStep[]>>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [facebookAccounts, setFacebookAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    design_link: '',
    scheduled_post_date: '',
    instagram_account_ids: [] as string[],
    facebook_account_ids: [] as string[],
  });

  const [stepFormData, setStepFormData] = useState({
    assigned_to: '',
    due_date: '',
    notes: '',
  });

  useEffect(() => {
    loadPosts();
    loadStaff();
    loadAccounts();
    subscribeToChanges();
  }, [marketingProjectId]);

  const subscribeToChanges = () => {
    const postsChannel = supabase
      .channel('marketing_social_posts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_social_posts', filter: `marketing_project_id=eq.${marketingProjectId}` }, () => {
        loadPosts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_social_post_steps' }, () => {
        loadPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
    };
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data: postsData, error: postsError } = await supabase
        .from('marketing_social_posts')
        .select(`
          *,
          creator:staff!created_by(full_name)
        `)
        .eq('marketing_project_id', marketingProjectId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      setPosts(postsData || []);

      const postIds = (postsData || []).map(p => p.id);
      if (postIds.length > 0) {
        const { data: stepsData, error: stepsError } = await supabase
          .from('marketing_social_post_steps')
          .select(`
            *,
            assignee:staff!assigned_to(full_name),
            completer:staff!completed_by(full_name)
          `)
          .in('post_id', postIds)
          .order('step_number', { ascending: true });

        if (stepsError) throw stepsError;

        const stepsMap: Record<string, PostStep[]> = {};
        (stepsData || []).forEach((step: any) => {
          if (!stepsMap[step.post_id]) {
            stepsMap[step.post_id] = [];
          }
          stepsMap[step.post_id].push(step);
        });

        setPostSteps(stepsMap);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      const { data: marketingProject } = await supabase
        .from('marketing_projects')
        .select('project_reference')
        .eq('id', marketingProjectId)
        .single();

      if (!marketingProject) return;

      // Load Instagram accounts linked to this marketing project
      const { data: linkedIgAccounts } = await supabase
        .from('marketing_project_instagram_accounts')
        .select('account_id')
        .eq('marketing_project_id', marketingProjectId);

      if (linkedIgAccounts && linkedIgAccounts.length > 0) {
        const accountIds = linkedIgAccounts.map(link => link.account_id);
        const { data: igAccounts } = await supabase
          .from('instagram_accounts')
          .select('id, name, username, account_id')
          .in('account_id', accountIds);

        setInstagramAccounts(igAccounts || []);
      } else {
        setInstagramAccounts([]);
      }

      // Load Facebook accounts linked to this marketing project
      const { data: linkedFbAccounts } = await supabase
        .from('marketing_facebook_accounts')
        .select('page_id')
        .eq('marketing_reference', marketingProject.project_reference);

      if (linkedFbAccounts && linkedFbAccounts.length > 0) {
        const pageIds = linkedFbAccounts.map(link => link.page_id);
        const { data: fbAccounts } = await supabase
          .from('facebook_accounts')
          .select('id, name, username, page_id')
          .in('page_id', pageIds);

        setFacebookAccounts(fbAccounts || []);
      } else {
        setFacebookAccounts([]);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user.id)
        .single();

      const { data: newPost, error: postError } = await supabase
        .from('marketing_social_posts')
        .insert({
          marketing_project_id: marketingProjectId,
          title: formData.title,
          content: formData.content,
          design_link: formData.design_link,
          scheduled_post_date: formData.scheduled_post_date || null,
          instagram_account_ids: formData.instagram_account_ids,
          facebook_account_ids: formData.facebook_account_ids,
          created_by: staffData?.id,
        })
        .select()
        .single();

      if (postError) throw postError;

      setShowCreateModal(false);
      setFormData({
        title: '',
        content: '',
        design_link: '',
        scheduled_post_date: '',
        instagram_account_ids: [],
        facebook_account_ids: []
      });
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  };

  const handleUpdatePost = async (postId: string, updates: Partial<SocialPost>) => {
    try {
      const { error } = await supabase
        .from('marketing_social_posts')
        .update({
          ...updates,
          draft_edit_date: new Date().toISOString(),
          version: updates.version ? updates.version + 1 : undefined,
        })
        .eq('id', postId);

      if (error) throw error;
      loadPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post');
    }
  };

  const handleCompleteStep = async (post: SocialPost, stepNumber: number) => {
    if (!user) return;

    try {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user.id)
        .single();

      const steps = postSteps[post.id] || [];
      const currentStep = steps.find(s => s.step_number === stepNumber);

      if (!currentStep) return;

      await supabase
        .from('marketing_social_post_steps')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: staffData?.id,
        })
        .eq('id', currentStep.id);

      if (stepNumber < 3) {
        const nextStepNumber = stepNumber + 1;
        const nextStepNames = ['', 'Content Drafting', 'Approval', 'Content Posted'];
        const nextStepStatuses = ['', 'draft', 'in_approval', 'approved'];

        await supabase
          .from('marketing_social_post_steps')
          .insert({
            post_id: post.id,
            step_number: nextStepNumber,
            step_name: nextStepNames[nextStepNumber],
            assigned_to: nextStepNumber === 3 ? post.created_by : null,
            due_date: nextStepNumber === 3 ? post.scheduled_post_date : null,
            status: 'pending',
          });

        await supabase
          .from('marketing_social_posts')
          .update({
            current_step: nextStepNumber,
            status: nextStepStatuses[nextStepNumber],
          })
          .eq('id', post.id);
      } else {
        await supabase
          .from('marketing_social_posts')
          .update({
            status: 'posted',
          })
          .eq('id', post.id);
      }

      loadPosts();
    } catch (error) {
      console.error('Error completing step:', error);
      alert('Failed to complete step');
    }
  };

  const handleUpdateStep = async () => {
    if (!selectedPost || !selectedStep) return;

    try {
      const steps = postSteps[selectedPost.id] || [];
      const step = steps.find(s => s.step_number === selectedStep);

      if (!step) return;

      const { error } = await supabase
        .from('marketing_social_post_steps')
        .update({
          assigned_to: stepFormData.assigned_to || null,
          due_date: stepFormData.due_date || null,
          notes: stepFormData.notes,
          status: stepFormData.assigned_to ? 'in_progress' : step.status,
        })
        .eq('id', step.id);

      if (error) throw error;

      setShowStepModal(false);
      setStepFormData({ assigned_to: '', due_date: '', notes: '' });
      loadPosts();
    } catch (error) {
      console.error('Error updating step:', error);
      alert('Failed to update step');
    }
  };

  const openStepModal = (post: SocialPost, stepNumber: number) => {
    setSelectedPost(post);
    setSelectedStep(stepNumber);
    const steps = postSteps[post.id] || [];
    const step = steps.find(s => s.step_number === stepNumber);

    if (step) {
      setStepFormData({
        assigned_to: step.assigned_to || '',
        due_date: step.due_date ? new Date(step.due_date).toISOString().split('T')[0] : '',
        notes: step.notes || '',
      });
    }

    setShowStepModal(true);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const { error } = await supabase
        .from('marketing_social_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  const togglePostExpand = (postId: string) => {
    const newExpanded = new Set(expandedPosts);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedPosts(newExpanded);
  };

  const getStepIcon = (step: PostStep) => {
    if (step.status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (step.status === 'in_progress') {
      return <Clock className="w-5 h-5 text-blue-600" />;
    } else {
      return <Circle className="w-5 h-5 text-slate-300" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'in_approval': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'posted': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading posts...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Social Media Posts</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <p className="text-slate-600 mb-4">No social media posts yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const steps = postSteps[post.id] || [];
            const isExpanded = expandedPosts.has(post.id);

            return (
              <div key={post.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => togglePostExpand(post.id)}
                      className="mt-1 text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{post.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                              {post.status}
                            </span>
                            <span>Step {post.current_step} of 3</span>
                            <span>v{post.version}</span>
                            {post.creator && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {post.creator.full_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <label className="text-slate-600">Content:</label>
                              <p className="text-slate-900 mt-1">{post.content || 'No content yet'}</p>
                            </div>
                            <div>
                              <label className="text-slate-600">Design Link:</label>
                              {post.design_link ? (
                                <a href={post.design_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-1">
                                  View Design <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <p className="text-slate-400 mt-1">No link</p>
                              )}
                            </div>
                            <div>
                              <label className="text-slate-600">Scheduled Date:</label>
                              <p className="text-slate-900 mt-1">
                                {post.scheduled_post_date ? new Date(post.scheduled_post_date).toLocaleString() : 'Not scheduled'}
                              </p>
                            </div>
                            <div>
                              <label className="text-slate-600">Last Edited:</label>
                              <p className="text-slate-900 mt-1">
                                {new Date(post.draft_edit_date).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 pt-4 border-t border-slate-200">
                            <h5 className="font-medium text-slate-900">Workflow Steps</h5>
                            {[1, 2, 3].map((stepNum) => {
                              const step = steps.find(s => s.step_number === stepNum);
                              const stepNames = ['', 'Content Drafting', 'Approval', 'Content Posted'];

                              return (
                                <div key={stepNum} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                  <div className="mt-0.5">
                                    {step ? getStepIcon(step) : <Circle className="w-5 h-5 text-slate-300" />}
                                  </div>

                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <h6 className="font-medium text-slate-900">{stepNames[stepNum]}</h6>
                                      {step && step.status !== 'completed' && (
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => openStepModal(post, stepNum)}
                                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                          >
                                            Edit Step
                                          </button>
                                          {step.status === 'in_progress' && (
                                            <button
                                              onClick={() => handleCompleteStep(post, stepNum)}
                                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                            >
                                              Complete
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {step && (
                                      <div className="mt-2 text-sm text-slate-600 space-y-1">
                                        {step.assignee && (
                                          <p className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            Assigned to: {step.assignee.full_name}
                                          </p>
                                        )}
                                        {step.due_date && (
                                          <p className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Due: {new Date(step.due_date).toLocaleDateString()}
                                          </p>
                                        )}
                                        {step.completed_at && step.completer && (
                                          <p className="flex items-center gap-1 text-green-600">
                                            <CheckCircle className="w-3 h-3" />
                                            Completed by {step.completer.full_name} on {new Date(step.completed_at).toLocaleDateString()}
                                          </p>
                                        )}
                                        {step.notes && (
                                          <p className="text-slate-700 mt-1">Note: {step.notes}</p>
                                        )}
                                      </div>
                                    )}

                                    {!step && stepNum > 1 && (
                                      <p className="text-slate-400 text-sm mt-1">Complete previous step to activate</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Create New Social Media Post</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Post Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Post content or description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Design Link</label>
                <input
                  type="url"
                  value={formData.design_link}
                  onChange={(e) => setFormData({ ...formData, design_link: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Post Date</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_post_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_post_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {instagramAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Instagram className="w-4 h-4 inline mr-1" />
                    Instagram Accounts
                  </label>
                  <div className="space-y-2 p-3 bg-slate-50 rounded-lg max-h-32 overflow-y-auto">
                    {instagramAccounts.map((account) => (
                      <label key={account.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.instagram_account_ids.includes(account.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                instagram_account_ids: [...formData.instagram_account_ids, account.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                instagram_account_ids: formData.instagram_account_ids.filter(id => id !== account.id)
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-900">
                          {account.name} {account.username && `(@${account.username})`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {facebookAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Facebook className="w-4 h-4 inline mr-1" />
                    Facebook Accounts
                  </label>
                  <div className="space-y-2 p-3 bg-slate-50 rounded-lg max-h-32 overflow-y-auto">
                    {facebookAccounts.map((account) => (
                      <label key={account.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.facebook_account_ids.includes(account.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                facebook_account_ids: [...formData.facebook_account_ids, account.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                facebook_account_ids: formData.facebook_account_ids.filter(id => id !== account.id)
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-900">
                          {account.name} {account.username && `(@${account.username})`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {instagramAccounts.length === 0 && facebookAccounts.length === 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Note:</strong> No social media accounts found. To select accounts for posting:
                  </p>
                  <ul className="text-sm text-blue-800 mt-2 ml-4 list-disc space-y-1">
                    <li>Make sure this marketing project is linked to a client</li>
                    <li>Add Instagram or Facebook accounts to the client in their respective sections</li>
                    <li>Then you'll be able to select which accounts to post to</li>
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStepModal && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Update Step {selectedStep}</h3>
              <button onClick={() => setShowStepModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                <select
                  value={stepFormData.assigned_to}
                  onChange={(e) => setStepFormData({ ...stepFormData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select User --</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={stepFormData.due_date}
                  onChange={(e) => setStepFormData({ ...stepFormData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={stepFormData.notes}
                  onChange={(e) => setStepFormData({ ...stepFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add notes or instructions..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStepModal(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStep}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update Step
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
