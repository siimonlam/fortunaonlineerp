import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CheckCircle, Circle, Clock, CreditCard as Edit2, Trash2, User, Calendar, ExternalLink, X, ChevronDown, ChevronRight, Instagram, Facebook, Check, XCircle as XIcon, Save, Copy } from 'lucide-react';

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
  const [filteredPosts, setFilteredPosts] = useState<SocialPost[]>([]);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [postSteps, setPostSteps] = useState<Record<string, PostStep[]>>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [facebookAccounts, setFacebookAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountDesigners, setAccountDesigners] = useState<Record<string, string>>({});
  const [accountApprovers, setAccountApprovers] = useState<Record<string, string>>({});
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editingAccount, setEditingAccount] = useState<{ type: string; id: string } | null>(null);
  const [tempDesigner, setTempDesigner] = useState('');
  const [tempApprover, setTempApprover] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    design_link: '',
    scheduled_post_date: '',
    instagram_account_ids: [] as string[],
    facebook_account_ids: [] as string[],
  });

  const [editFormData, setEditFormData] = useState({
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

  useEffect(() => {
    filterPosts();
  }, [posts, accountFilter, assigneeFilter, sortOrder]);

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

  const filterPosts = () => {
    let filtered = [...posts];

    // Account filter
    if (accountFilter === 'instagram') {
      filtered = filtered.filter(p => p.instagram_account_ids && p.instagram_account_ids.length > 0);
    } else if (accountFilter === 'facebook') {
      filtered = filtered.filter(p => p.facebook_account_ids && p.facebook_account_ids.length > 0);
    } else if (accountFilter.startsWith('ig-')) {
      const accountId = accountFilter.substring(3);
      filtered = filtered.filter(p => p.instagram_account_ids && p.instagram_account_ids.includes(accountId));
    } else if (accountFilter.startsWith('fb-')) {
      const accountId = accountFilter.substring(3);
      filtered = filtered.filter(p => p.facebook_account_ids && p.facebook_account_ids.includes(accountId));
    }

    // Assignee filter
    if (assigneeFilter !== 'all' && user) {
      filtered = filtered.filter(p => {
        const steps = postSteps[p.id] || [];
        const currentStep = steps.find(s => s.step_number === p.current_step);
        if (assigneeFilter === 'me') {
          return currentStep && currentStep.assigned_to === user.id;
        } else {
          return currentStep && currentStep.assigned_to === assigneeFilter;
        }
      });
    }

    // Sort by scheduled_post_date
    filtered.sort((a, b) => {
      const dateA = a.scheduled_post_date ? new Date(a.scheduled_post_date).getTime() : 0;
      const dateB = b.scheduled_post_date ? new Date(b.scheduled_post_date).getTime() : 0;

      if (sortOrder === 'asc') {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    });

    setFilteredPosts(filtered);
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

      // Load Instagram accounts with designer/approver
      const { data: linkedIgAccounts } = await supabase
        .from('marketing_project_instagram_accounts')
        .select('account_id, designer_id, approver_id')
        .eq('marketing_project_id', marketingProjectId);

      if (linkedIgAccounts && linkedIgAccounts.length > 0) {
        const accountIds = linkedIgAccounts.map(link => link.account_id);
        const { data: igAccounts } = await supabase
          .from('instagram_accounts')
          .select('id, name, username, account_id')
          .in('account_id', accountIds);

        setInstagramAccounts(igAccounts || []);

        // Store designer/approver mappings
        const designers: Record<string, string> = {};
        const approvers: Record<string, string> = {};
        linkedIgAccounts.forEach(link => {
          if (link.designer_id) designers[link.account_id] = link.designer_id;
          if (link.approver_id) approvers[link.account_id] = link.approver_id;
        });
        setAccountDesigners(prev => ({ ...prev, ...designers }));
        setAccountApprovers(prev => ({ ...prev, ...approvers }));
      } else {
        setInstagramAccounts([]);
      }

      // Load Facebook accounts with designer/approver
      const { data: linkedFbAccounts } = await supabase
        .from('marketing_facebook_accounts')
        .select('page_id, designer_id, approver_id')
        .eq('marketing_reference', marketingProject.project_reference);

      if (linkedFbAccounts && linkedFbAccounts.length > 0) {
        const pageIds = linkedFbAccounts.map(link => link.page_id);
        const { data: fbAccounts } = await supabase
          .from('facebook_accounts')
          .select('id, name, username, page_id')
          .in('page_id', pageIds);

        setFacebookAccounts(fbAccounts || []);

        // Store designer/approver mappings
        const designers: Record<string, string> = {};
        const approvers: Record<string, string> = {};
        linkedFbAccounts.forEach(link => {
          if (link.designer_id) designers[link.page_id] = link.designer_id;
          if (link.approver_id) approvers[link.page_id] = link.approver_id;
        });
        setAccountDesigners(prev => ({ ...prev, ...designers }));
        setAccountApprovers(prev => ({ ...prev, ...approvers }));
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

  const handleUpdatePost = async (postId: string) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const { error } = await supabase
        .from('marketing_social_posts')
        .update({
          title: editFormData.title,
          content: editFormData.content,
          design_link: editFormData.design_link,
          scheduled_post_date: editFormData.scheduled_post_date || null,
          instagram_account_ids: editFormData.instagram_account_ids,
          facebook_account_ids: editFormData.facebook_account_ids,
          draft_edit_date: new Date().toISOString(),
          version: post.version + 1,
        })
        .eq('id', postId);

      if (error) throw error;
      setEditingPost(null);
      loadPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post');
    }
  };

  const startEditing = (post: SocialPost) => {
    setEditingPost(post.id);
    setEditFormData({
      title: post.title,
      content: post.content,
      design_link: post.design_link,
      scheduled_post_date: post.scheduled_post_date ? new Date(post.scheduled_post_date).toISOString().slice(0, 16) : '',
      instagram_account_ids: post.instagram_account_ids || [],
      facebook_account_ids: post.facebook_account_ids || [],
    });
  };

  const handleApproveStep = async (post: SocialPost, step: PostStep) => {
    if (!user) return;

    try {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user.id)
        .single();

      const completedAt = new Date().toISOString();

      // Mark step 2 as completed
      await supabase
        .from('marketing_social_post_steps')
        .update({
          status: 'completed',
          completed_at: completedAt,
          completed_by: staffData?.id,
          notes: (step.notes || '') + '\n✓ Approved',
        })
        .eq('id', step.id);

      // Get designer for step 3
      const allAccountIds = [
        ...(post.instagram_account_ids || []),
        ...(post.facebook_account_ids || [])
      ];
      const designerId = allAccountIds.length > 0 ? accountDesigners[allAccountIds[0]] : post.created_by;

      // Create step 3 with due_date set to step 2 approval date
      await supabase
        .from('marketing_social_post_steps')
        .insert({
          post_id: post.id,
          step_number: 3,
          step_name: 'Content Posted',
          assigned_to: designerId || post.created_by,
          due_date: completedAt,
          status: 'pending',
        });

      // Update post status
      await supabase
        .from('marketing_social_posts')
        .update({
          current_step: 3,
          status: 'approved',
        })
        .eq('id', post.id);

      loadPosts();
    } catch (error) {
      console.error('Error approving step:', error);
      alert('Failed to approve');
    }
  };

  const handleDisapproveStep = async (post: SocialPost, step: PostStep) => {
    if (!user) return;

    const reason = prompt('Reason for disapproval:');
    if (!reason) return;

    try {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user.id)
        .single();

      // Update step 2 notes with disapproval
      await supabase
        .from('marketing_social_post_steps')
        .update({
          notes: (step.notes || '') + `\n✗ Disapproved: ${reason}`,
        })
        .eq('id', step.id);

      // Mark step 1 as incomplete
      const step1 = (postSteps[post.id] || []).find(s => s.step_number === 1);
      if (step1) {
        await supabase
          .from('marketing_social_post_steps')
          .update({
            status: 'in_progress',
            completed_at: null,
            completed_by: null,
          })
          .eq('id', step1.id);
      }

      // Delete step 2
      await supabase
        .from('marketing_social_post_steps')
        .delete()
        .eq('id', step.id);

      // Update post back to draft
      await supabase
        .from('marketing_social_posts')
        .update({
          current_step: 1,
          status: 'draft',
        })
        .eq('id', post.id);

      loadPosts();
    } catch (error) {
      console.error('Error disapproving step:', error);
      alert('Failed to disapprove');
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

      const completedAt = new Date().toISOString();

      // Mark current step as completed
      await supabase
        .from('marketing_social_post_steps')
        .update({
          status: 'completed',
          completed_at: completedAt,
          completed_by: staffData?.id,
        })
        .eq('id', currentStep.id);

      if (stepNumber === 1) {
        // Get approver for step 2
        const allAccountIds = [
          ...(post.instagram_account_ids || []),
          ...(post.facebook_account_ids || [])
        ];
        const approverId = allAccountIds.length > 0 ? accountApprovers[allAccountIds[0]] : null;

        // Create step 2 with due_date set to step 1 completion date
        await supabase
          .from('marketing_social_post_steps')
          .insert({
            post_id: post.id,
            step_number: 2,
            step_name: 'Approval',
            assigned_to: approverId,
            due_date: completedAt,
            status: 'pending',
          });

        await supabase
          .from('marketing_social_posts')
          .update({
            current_step: 2,
            status: 'in_approval',
          })
          .eq('id', post.id);
      } else if (stepNumber === 3) {
        // Mark post as posted
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

      const originalDueDate = step.due_date ? new Date(step.due_date).toISOString().split('T')[0] : '';

      const updateData: any = {};

      if (stepFormData.assigned_to !== (step.assigned_to || '')) {
        updateData.assigned_to = stepFormData.assigned_to || null;
      }

      if (stepFormData.due_date !== originalDueDate) {
        updateData.due_date = stepFormData.due_date || null;
      }

      if (stepFormData.notes !== (step.notes || '')) {
        updateData.notes = stepFormData.notes || null;
      }

      if (Object.keys(updateData).length === 0) {
        setShowStepModal(false);
        return;
      }

      const { error } = await supabase
        .from('marketing_social_post_steps')
        .update(updateData)
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

  const handleDuplicatePost = async (postId: string) => {
    if (!user) return;

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const { data: newPost, error } = await supabase
        .from('marketing_social_posts')
        .insert({
          marketing_project_id: post.marketing_project_id,
          title: `${post.title} (Copy)`,
          content: post.content,
          design_link: post.design_link,
          scheduled_post_date: post.scheduled_post_date,
          instagram_account_ids: post.instagram_account_ids,
          facebook_account_ids: post.facebook_account_ids,
          current_step: 1,
          version: 1,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (newPost) {
        const allAccountIds = [
          ...(newPost.instagram_account_ids || []),
          ...(newPost.facebook_account_ids || [])
        ];
        const designerId = allAccountIds.length > 0 ? accountDesigners[allAccountIds[0]] : user.id;

        await supabase
          .from('marketing_social_post_steps')
          .insert({
            post_id: newPost.id,
            step_number: 1,
            step_name: 'Content Drafting',
            assigned_to: designerId,
            status: 'pending',
          });
      }

      loadPosts();
      alert('Post duplicated successfully!');
    } catch (error) {
      console.error('Error duplicating post:', error);
      alert('Failed to duplicate post');
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

  const handleUpdateAccountAssignments = async (type: 'instagram' | 'facebook', accountId: string) => {
    try {
      if (type === 'instagram') {
        const { error } = await supabase
          .from('marketing_project_instagram_accounts')
          .update({
            designer_id: tempDesigner || null,
            approver_id: tempApprover || null,
          })
          .eq('marketing_project_id', marketingProjectId)
          .eq('account_id', accountId);

        if (error) throw error;
      } else {
        const { data: marketingProject } = await supabase
          .from('marketing_projects')
          .select('project_reference')
          .eq('id', marketingProjectId)
          .single();

        if (!marketingProject) throw new Error('Marketing project not found');

        const { error } = await supabase
          .from('marketing_facebook_accounts')
          .update({
            designer_id: tempDesigner || null,
            approver_id: tempApprover || null,
          })
          .eq('marketing_reference', marketingProject.project_reference)
          .eq('page_id', accountId);

        if (error) throw error;
      }

      setAccountDesigners(prev => ({
        ...prev,
        [accountId]: tempDesigner || ''
      }));
      setAccountApprovers(prev => ({
        ...prev,
        [accountId]: tempApprover || ''
      }));
      setEditingAccount(null);
      loadAccounts();
    } catch (error) {
      console.error('Error updating account assignments:', error);
      alert('Failed to update account assignments');
    }
  };

  const startEditingAccount = (type: string, accountId: string) => {
    setEditingAccount({ type, id: accountId });
    setTempDesigner(accountDesigners[accountId] || '');
    setTempApprover(accountApprovers[accountId] || '');
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading posts...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Filter by Account</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setAccountFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  accountFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
          <button
            onClick={() => setAccountFilter('instagram')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
              accountFilter === 'instagram'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Instagram className="w-4 h-4" />
            All Instagram
          </button>
          <button
            onClick={() => setAccountFilter('facebook')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
              accountFilter === 'facebook'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Facebook className="w-4 h-4" />
            All Facebook
          </button>

          {instagramAccounts.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-slate-500 mr-1">|</span>
              {instagramAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setAccountFilter(`ig-${account.id}`)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                    accountFilter === `ig-${account.id}`
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200'
                  }`}
                >
                  <Instagram className="w-3.5 h-3.5" />
                  {account.name || account.username}
                </button>
              ))}
            </div>
          )}

          {facebookAccounts.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-slate-500 mr-1">|</span>
              {facebookAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setAccountFilter(`fb-${account.id}`)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                    accountFilter === `fb-${account.id}`
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  <Facebook className="w-3.5 h-3.5" />
                  {account.name || account.username}
                </button>
              ))}
            </div>
          )}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Filter by Assignee</label>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Posts</option>
                <option value="me">My Tasks</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Sort by Date</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {(instagramAccounts.length > 0 || facebookAccounts.length > 0) && (
        <div className="bg-white rounded-lg border border-slate-200">
          <button
            onClick={() => setShowAccountSettings(!showAccountSettings)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-600" />
              <span className="font-medium text-slate-900">Account Settings (Designer & Approver)</span>
            </div>
            {showAccountSettings ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>

          {showAccountSettings && (
            <div className="p-4 border-t border-slate-200 space-y-4">
              {instagramAccounts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1">
                    <Instagram className="w-4 h-4" />
                    Instagram Accounts
                  </h4>
                  <div className="space-y-2">
                    {instagramAccounts.map((account) => {
                      const isEditing = editingAccount?.type === 'instagram' && editingAccount?.id === account.account_id;
                      const designerName = staff.find(s => s.id === accountDesigners[account.account_id])?.full_name || 'Not assigned';
                      const approverName = staff.find(s => s.id === accountApprovers[account.account_id])?.full_name || 'Not assigned';

                      return (
                        <div key={account.id} className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-200">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{account.name || account.username}</div>
                            {!isEditing ? (
                              <div className="text-sm text-slate-600 mt-1">
                                <div>Designer: <span className="font-medium">{designerName}</span></div>
                                <div>Approver: <span className="font-medium">{approverName}</span></div>
                              </div>
                            ) : (
                              <div className="space-y-2 mt-2">
                                <select
                                  value={tempDesigner}
                                  onChange={(e) => setTempDesigner(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select Designer</option>
                                  {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                                  ))}
                                </select>
                                <select
                                  value={tempApprover}
                                  onChange={(e) => setTempApprover(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select Approver</option>
                                  {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {!isEditing ? (
                              <button
                                onClick={() => startEditingAccount('instagram', account.account_id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleUpdateAccountAssignments('instagram', account.account_id)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingAccount(null)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {facebookAccounts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1">
                    <Facebook className="w-4 h-4" />
                    Facebook Accounts
                  </h4>
                  <div className="space-y-2">
                    {facebookAccounts.map((account) => {
                      const isEditing = editingAccount?.type === 'facebook' && editingAccount?.id === account.page_id;
                      const designerName = staff.find(s => s.id === accountDesigners[account.page_id])?.full_name || 'Not assigned';
                      const approverName = staff.find(s => s.id === accountApprovers[account.page_id])?.full_name || 'Not assigned';

                      return (
                        <div key={account.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{account.name || account.username}</div>
                            {!isEditing ? (
                              <div className="text-sm text-slate-600 mt-1">
                                <div>Designer: <span className="font-medium">{designerName}</span></div>
                                <div>Approver: <span className="font-medium">{approverName}</span></div>
                              </div>
                            ) : (
                              <div className="space-y-2 mt-2">
                                <select
                                  value={tempDesigner}
                                  onChange={(e) => setTempDesigner(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select Designer</option>
                                  {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                                  ))}
                                </select>
                                <select
                                  value={tempApprover}
                                  onChange={(e) => setTempApprover(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select Approver</option>
                                  {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {!isEditing ? (
                              <button
                                onClick={() => startEditingAccount('facebook', account.page_id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleUpdateAccountAssignments('facebook', account.page_id)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingAccount(null)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {filteredPosts.length === 0 ? (
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
          {filteredPosts.map((post) => {
            const steps = postSteps[post.id] || [];
            const isExpanded = expandedPosts.has(post.id);
            const isEditing = editingPost === post.id;
            const canEdit = true;

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
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editFormData.title}
                                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm font-semibold"
                                placeholder="Title"
                              />
                              <textarea
                                value={editFormData.content}
                                onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                                placeholder="Content..."
                              />
                              <input
                                type="url"
                                value={editFormData.design_link}
                                onChange={(e) => setEditFormData({ ...editFormData, design_link: e.target.value })}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                                placeholder="Design link..."
                              />
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Scheduled Post Date
                                </label>
                                <input
                                  type="datetime-local"
                                  value={editFormData.scheduled_post_date}
                                  onChange={(e) => setEditFormData({ ...editFormData, scheduled_post_date: e.target.value })}
                                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                                />
                              </div>

                              {instagramAccounts.length > 0 && (
                                <div>
                                  <label className="text-xs font-medium text-slate-600 mb-1 block">Instagram Accounts</label>
                                  <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-200 rounded p-2">
                                    {instagramAccounts.map((account) => (
                                      <label key={account.id} className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={editFormData.instagram_account_ids.includes(account.account_id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setEditFormData({
                                                ...editFormData,
                                                instagram_account_ids: [...editFormData.instagram_account_ids, account.account_id]
                                              });
                                            } else {
                                              setEditFormData({
                                                ...editFormData,
                                                instagram_account_ids: editFormData.instagram_account_ids.filter(id => id !== account.account_id)
                                              });
                                            }
                                          }}
                                          className="rounded border-slate-300"
                                        />
                                        <Instagram className="w-3.5 h-3.5 text-pink-600" />
                                        <span>{account.name || account.username}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {facebookAccounts.length > 0 && (
                                <div>
                                  <label className="text-xs font-medium text-slate-600 mb-1 block">Facebook Accounts</label>
                                  <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-200 rounded p-2">
                                    {facebookAccounts.map((account) => (
                                      <label key={account.id} className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={editFormData.facebook_account_ids.includes(account.page_id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setEditFormData({
                                                ...editFormData,
                                                facebook_account_ids: [...editFormData.facebook_account_ids, account.page_id]
                                              });
                                            } else {
                                              setEditFormData({
                                                ...editFormData,
                                                facebook_account_ids: editFormData.facebook_account_ids.filter(id => id !== account.page_id)
                                              });
                                            }
                                          }}
                                          className="rounded border-slate-300"
                                        />
                                        <Facebook className="w-3.5 h-3.5 text-blue-600" />
                                        <span>{account.name || account.username}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdatePost(post.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                >
                                  <Save className="w-3 h-3" />
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingPost(null)}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-900">{post.title}</h4>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-slate-600 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                                  {post.status}
                                </span>
                                <span>Step {post.current_step} of 3</span>
                                <span>v{post.version}</span>
                                {post.scheduled_post_date && (
                                  <span className="flex items-center gap-1 text-slate-700 font-medium">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(post.scheduled_post_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                )}
                                {post.instagram_account_ids && post.instagram_account_ids.length > 0 && (
                                  <span className="flex items-center gap-1 text-pink-600">
                                    <Instagram className="w-3 h-3" />
                                    {post.instagram_account_ids.length}
                                  </span>
                                )}
                                {post.facebook_account_ids && post.facebook_account_ids.length > 0 && (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <Facebook className="w-3 h-3" />
                                    {post.facebook_account_ids.length}
                                  </span>
                                )}
                                {post.creator && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {post.creator.full_name}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditing(post)}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Edit post"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicatePost(post.id)}
                              className="text-slate-400 hover:text-green-600 transition-colors"
                              title="Duplicate post"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete post"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isExpanded && !isEditing && (
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <label className="text-slate-600 font-medium">Content:</label>
                              <p className="text-slate-900 mt-1">{post.content || 'No content yet'}</p>
                            </div>
                            <div>
                              <label className="text-slate-600 font-medium">Design Link:</label>
                              {post.design_link ? (
                                <a href={post.design_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-1">
                                  View Design <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <p className="text-slate-400 mt-1">No link</p>
                              )}
                            </div>
                            <div>
                              <label className="text-slate-600 font-medium">Scheduled Date:</label>
                              <p className="text-slate-900 mt-1">
                                {post.scheduled_post_date ? new Date(post.scheduled_post_date).toLocaleString() : 'Not scheduled'}
                              </p>
                            </div>
                            <div>
                              <label className="text-slate-600 font-medium">Last Edited:</label>
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
                                      {step && (
                                        <div className="flex items-center gap-2">
                                          {stepNum === 2 && step.status !== 'completed' && (
                                            <>
                                              <button
                                                onClick={() => openStepModal(post, stepNum)}
                                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                              >
                                                Edit Step
                                              </button>
                                              <button
                                                onClick={() => handleApproveStep(post, step)}
                                                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                              >
                                                <Check className="w-3 h-3" />
                                                Approve
                                              </button>
                                              <button
                                                onClick={() => handleDisapproveStep(post, step)}
                                                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                              >
                                                <XIcon className="w-3 h-3" />
                                                Disapprove
                                              </button>
                                            </>
                                          )}
                                          {step.status !== 'completed' && stepNum !== 2 && (
                                            <>
                                              <button
                                                onClick={() => openStepModal(post, stepNum)}
                                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                              >
                                                Edit Step
                                              </button>
                                              {(step.status === 'in_progress' || step.status === 'pending') && (
                                                <button
                                                  onClick={() => handleCompleteStep(post, stepNum)}
                                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                                >
                                                  Complete
                                                </button>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      )}
                                      {!step && stepNum === post.current_step && stepNum === 2 && (
                                        <button
                                          onClick={async () => {
                                            const allAccountIds = [
                                              ...(post.instagram_account_ids || []),
                                              ...(post.facebook_account_ids || [])
                                            ];
                                            const approverId = allAccountIds.length > 0 ? accountApprovers[allAccountIds[0]] : null;
                                            await supabase
                                              .from('marketing_social_post_steps')
                                              .insert({
                                                post_id: post.id,
                                                step_number: 2,
                                                step_name: 'Approval',
                                                assigned_to: approverId,
                                                status: 'pending',
                                              });
                                            loadPosts();
                                          }}
                                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                        >
                                          Create Step 2
                                        </button>
                                      )}
                                    </div>

                                    {step && (
                                      <div className="mt-2 text-sm text-slate-600 space-y-1">
                                        {step.assignee ? (
                                          <p className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            Assigned to: {step.assignee.full_name}
                                          </p>
                                        ) : (
                                          <p className="flex items-center gap-1 text-orange-600">
                                            <User className="w-3 h-3" />
                                            Unassigned (Click "Edit Step" to assign)
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
                                          <p className="text-slate-700 mt-1 whitespace-pre-line">Note: {step.notes}</p>
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
