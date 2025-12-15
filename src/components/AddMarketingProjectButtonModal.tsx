import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MarketingProject {
  id: string;
  title: string;
  company_name: string;
  brand_name: string;
  project_name: string;
}

interface AddMarketingProjectButtonModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddMarketingProjectButtonModal({ onClose, onSuccess }: AddMarketingProjectButtonModalProps) {
  const [buttonName, setButtonName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dealWonProjects, setDealWonProjects] = useState<MarketingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDealWonProjects();
  }, []);

  const loadDealWonProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: statusData, error: statusError } = await supabase
        .from('marketing_statuses')
        .select('id')
        .eq('name', 'Deal won')
        .maybeSingle();

      if (statusError) throw statusError;
      if (!statusData) {
        setError('Deal Won status not found');
        setLoading(false);
        return;
      }

      const { data: projects, error: projectsError } = await supabase
        .from('marketing_projects')
        .select('id, title, company_name, brand_name, project_name')
        .eq('status_id', statusData.id)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      setDealWonProjects(projects || []);
    } catch (err) {
      console.error('Error loading Deal Won projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!buttonName.trim() || !selectedProjectId) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: maxOrder } = await supabase
        .from('marketing_project_buttons')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newOrder = (maxOrder?.display_order || 0) + 1;

      const { error: insertError } = await supabase
        .from('marketing_project_buttons')
        .insert({
          name: buttonName.trim(),
          marketing_project_id: selectedProjectId,
          display_order: newOrder,
          created_by: user.id
        });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating button:', err);
      setError(err instanceof Error ? err.message : 'Failed to create button');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Add Marketing Project Button</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select Marketing Project *
              </label>
              {loading ? (
                <div className="text-sm text-slate-500">Loading projects...</div>
              ) : dealWonProjects.length === 0 ? (
                <div className="text-sm text-slate-500">No Deal Won projects available</div>
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Choose a project...</option>
                  {dealWonProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.brand_name || project.company_name || project.project_name || project.title || 'Untitled Project'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Button Name *
              </label>
              <input
                type="text"
                value={buttonName}
                onChange={(e) => setButtonName(e.target.value)}
                placeholder="Enter button name..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading || !selectedProjectId || !buttonName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Creating...' : 'Create Button'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
