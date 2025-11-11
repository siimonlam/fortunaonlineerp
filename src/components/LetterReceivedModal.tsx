import { useState, useEffect } from 'react';
import { X, Save, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface LetterReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId: string;
  companyCode: string;
  companyName: string;
}

export function LetterReceivedModal({
  isOpen,
  onClose,
  onSuccess,
  clientId,
  companyCode,
  companyName
}: LetterReceivedModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    letter_received_date: new Date().toISOString().split('T')[0],
    sender_name: '',
    letter_reference_number: '',
    pickup_preference: 'Pickup',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        letter_received_date: new Date().toISOString().split('T')[0],
        sender_name: '',
        letter_reference_number: '',
        pickup_preference: 'Pickup',
        notes: ''
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('virtual_office_letters')
        .insert({
          comsec_client_id: clientId,
          company_code: companyCode,
          company_name: companyName,
          letter_received_date: formData.letter_received_date,
          sender_name: formData.sender_name,
          letter_reference_number: formData.letter_reference_number || null,
          pickup_preference: formData.pickup_preference,
          notes: formData.notes || null,
          created_by: user?.id
        });

      if (error) throw error;

      alert('Letter received recorded successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error recording letter:', error);
      alert(`Failed to record letter: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Record Letter Received
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{companyCode}</span> - {companyName}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Letter Received Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.letter_received_date}
              onChange={(e) => setFormData({ ...formData, letter_received_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sender's Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.sender_name}
              onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
              placeholder="Enter sender's name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Letter Reference Number
            </label>
            <input
              type="text"
              value={formData.letter_reference_number}
              onChange={(e) => setFormData({ ...formData, letter_reference_number: e.target.value })}
              placeholder="Optional reference number"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pickup Preference <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.pickup_preference}
              onChange={(e) => setFormData({ ...formData, pickup_preference: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Pickup">Pickup</option>
              <option value="Mail">Mail</option>
              <option value="Scan & Email">Scan & Email</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Letter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
