import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChevronRight, ChevronLeft, Clock, MessageSquare, Phone, FileText } from 'lucide-react';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface ProjectHistory {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  staff?: Staff;
}

interface ProjectComment {
  id: string;
  comment_type: string;
  content: string;
  created_at: string;
  staff?: Staff;
}

interface ProjectActivitySidebarProps {
  projectId: string;
  isOpen?: boolean;
  onToggle?: () => void;
  embedded?: boolean;
}

const COMMENT_TYPES = [
  { value: 'Note', label: 'Note', icon: FileText },
  { value: 'Call', label: 'Call Log', icon: Phone },
  { value: 'Meeting', label: 'Meeting', icon: MessageSquare },
];

export function ProjectActivitySidebar({ projectId, isOpen = true, onToggle, embedded = false }: ProjectActivitySidebarProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<ProjectHistory[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState('Note');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (embedded || isOpen) {
      loadHistory();
      loadComments();

      const channel = supabase
        .channel(`project-activity-${projectId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_history', filter: `project_id=eq.${projectId}` },
          () => {
            console.log('History changed, reloading...');
            loadHistory();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'project_comments', filter: `project_id=eq.${projectId}` },
          () => {
            console.log('Comments changed, reloading...');
            loadComments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [projectId, isOpen, embedded]);

  async function loadHistory() {
    try {
      const { data, error } = await supabase
        .from('project_history')
        .select(`
          *,
          staff:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('project_id', projectId)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  async function loadComments() {
    try {
      const { data, error } = await supabase
        .from('project_comments')
        .select(`
          *,
          staff:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_comments')
        .insert({
          project_id: projectId,
          user_id: user.id,
          comment_type: commentType,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      await loadComments();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(`Failed to add comment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function formatFieldName(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const getCommentIcon = (type: string) => {
    const commentType = COMMENT_TYPES.find(t => t.value === type);
    return commentType ? commentType.icon : FileText;
  };

  const activityContent = (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Edit History
              </h4>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No edit history yet</p>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                      <p className="font-medium text-slate-900">{formatFieldName(item.field_name)}</p>
                      <div className="text-slate-600 mt-1">
                        <span className="text-red-600 line-through">{item.old_value || '(empty)'}</span>
                        {' → '}
                        <span className="text-green-600">{item.new_value || '(empty)'}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.staff?.full_name || 'Unknown'} • {new Date(item.changed_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Comments & Logs
              </h4>
              <div className="space-y-3 mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No comments yet</p>
                ) : (
                  comments.map((comment) => {
                    const Icon = getCommentIcon(comment.comment_type);
                    return (
                      <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <Icon className="w-4 h-4 mr-2 text-slate-600" />
                            <span className="text-xs font-semibold text-slate-700">{comment.comment_type}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-900 mb-2">{comment.content}</p>
                        <p className="text-xs text-slate-600">{comment.staff?.full_name || 'Unknown'}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

      <div className="border-t border-slate-200 p-4 bg-slate-50">
        <form onSubmit={handleAddComment} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={commentType}
                  onChange={(e) => setCommentType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COMMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a note, call log, or meeting summary..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  required
                />
              </div>
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {loading ? 'Adding...' : 'Add Comment'}
          </button>
        </form>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col border-l border-slate-200 bg-slate-50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h3 className="text-lg font-semibold text-slate-900">Project Activity</h3>
        </div>
        {activityContent}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={onToggle}
        className={`fixed top-1/2 -translate-y-1/2 z-50 bg-blue-600 text-white p-2 rounded-l-lg shadow-lg hover:bg-blue-700 transition-all ${
          isOpen ? 'right-96' : 'right-0'
        }`}
      >
        {isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Project Activity</h3>
          </div>
          {activityContent}
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
}
