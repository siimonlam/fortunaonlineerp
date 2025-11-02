import { useEffect, useState } from 'react';
import { Tag, Plus, X, Edit2, Save, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Label {
  id: string;
  name: string;
  color: string;
  order_index: number;
  created_at: string;
}

export function LabelManagement() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  useEffect(() => {
    loadLabels();
  }, []);

  async function loadLabels() {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .order('order_index');

    if (error) {
      console.error('Error loading labels:', error);
    } else if (data) {
      setLabels(data);
    }
  }

  async function handleCreateLabel() {
    if (!newLabelName.trim()) {
      alert('Please enter a label name');
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const maxOrder = labels.length > 0 ? Math.max(...labels.map(l => l.order_index)) : 0;

      const { error } = await supabase
        .from('labels')
        .insert({
          name: newLabelName.trim(),
          color: newLabelColor,
          created_by: userData.user.id,
          order_index: maxOrder + 1
        });

      if (error) throw error;

      setNewLabelName('');
      setNewLabelColor('#3B82F6');
      await loadLabels();
    } catch (error: any) {
      console.error('Error creating label:', error);
      alert(`Failed to create label: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateLabel(id: string) {
    if (!editName.trim()) {
      alert('Please enter a label name');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('labels')
        .update({
          name: editName.trim(),
          color: editColor
        })
        .eq('id', id);

      if (error) throw error;

      setEditingId(null);
      await loadLabels();
    } catch (error: any) {
      console.error('Error updating label:', error);
      alert(`Failed to update label: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteLabel(id: string) {
    if (!confirm('Are you sure you want to delete this label? It will be removed from all projects.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('labels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadLabels();
    } catch (error: any) {
      console.error('Error deleting label:', error);
      alert(`Failed to delete label: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function startEditing(label: Label) {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  }

  const predefinedColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Tag className="w-5 h-5 text-slate-600" />
        <h2 className="text-xl font-semibold text-slate-900">Label Management</h2>
      </div>

      <div className="mb-6 p-4 bg-slate-50 rounded-lg">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Create New Label</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            placeholder="Label name"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
          />
          <div className="relative">
            <input
              type="color"
              value={newLabelColor}
              onChange={(e) => setNewLabelColor(e.target.value)}
              className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
            />
          </div>
          <button
            onClick={handleCreateLabel}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {predefinedColors.map(color => (
            <button
              key={color}
              onClick={() => setNewLabelColor(color)}
              className={`w-8 h-8 rounded border-2 transition-all ${
                newLabelColor === color ? 'border-slate-900 scale-110' : 'border-slate-300'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {labels.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No labels created yet. Create your first label above.
          </div>
        ) : (
          labels.map(label => (
            <div
              key={label.id}
              className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <GripVertical className="w-4 h-4 text-slate-400" />

              {editingId === label.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-10 h-10 border border-slate-300 rounded cursor-pointer"
                  />
                  <button
                    onClick={() => handleUpdateLabel(label.id)}
                    disabled={loading}
                    className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 font-medium text-slate-900">{label.name}</span>
                  <button
                    onClick={() => startEditing(label)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLabel(label.id)}
                    disabled={loading}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
