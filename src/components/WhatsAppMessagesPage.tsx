import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Send, User, Phone, Clock, CheckCircle, Circle, AlertCircle, Search, Filter, UserPlus, StickyNote, ArrowRight, Tag, ChevronDown, ChevronUp, Settings, Plus } from 'lucide-react';

interface WhatsAppPhoneNumber {
  id: string;
  phone_number_id: string;
  phone_number: string;
  display_name: string;
  verified_status: string;
  quality_rating: string;
  is_active: boolean;
}

interface WhatsAppContact {
  id: string;
  phone_number: string;
  name: string;
  profile_name: string;
  client_id: string | null;
  tags: string[];
  notes: string;
  last_message_at: string;
}

interface WhatsAppMessage {
  id: string;
  whatsapp_phone_number_id: string;
  contact_phone: string;
  message_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  message_content: any;
  text_body: string;
  media_url: string | null;
  status: string;
  assigned_to: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_replied: boolean;
  replied_at: string | null;
  timestamp: string;
  assigned_user?: {
    full_name: string;
  };
  notes?: MessageNote[];
}

interface MessageNote {
  id: string;
  note: string;
  created_by: string;
  created_at: string;
  staff?: {
    full_name: string;
  };
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

export function WhatsAppMessagesPage() {
  const { user } = useAuth();
  const [phoneNumbers, setPhoneNumbers] = useState<WhatsAppPhoneNumber[]>([]);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const [messageNotes, setMessageNotes] = useState<MessageNote[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [registrationForm, setRegistrationForm] = useState({
    phone_number_id: '',
    pin: '',
    access_token: '',
    display_name: '',
    phone_number: '',
    meta_business_account_id: ''
  });
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPhoneNumbers();
    fetchContacts();
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedPhoneNumber) {
      fetchMessages();
    }
  }, [selectedPhoneNumber]);

  useEffect(() => {
    if (selectedMessage) {
      fetchMessageNotes();
    }
  }, [selectedMessage]);

  const fetchPhoneNumbers = async () => {
    const { data, error } = await supabase
      .from('whatsapp_phone_numbers')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPhoneNumbers(data);
      if (data.length > 0 && !selectedPhoneNumber) {
        setSelectedPhoneNumber(data[0].id);
      }
    }
  };

  const fetchMessages = async () => {
    if (!selectedPhoneNumber) return;

    let query = supabase
      .from('whatsapp_messages')
      .select(`
        *,
        assigned_user:assigned_to(full_name)
      `)
      .eq('whatsapp_phone_number_id', selectedPhoneNumber)
      .order('timestamp', { ascending: false });

    if (filterDirection !== 'all') {
      query = query.eq('direction', filterDirection);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'replied') {
        query = query.eq('is_replied', true);
      } else if (filterStatus === 'pending') {
        query = query.eq('is_replied', false);
      }
    }

    if (filterAssigned !== 'all') {
      if (filterAssigned === 'unassigned') {
        query = query.is('assigned_to', null);
      } else {
        query = query.eq('assigned_to', filterAssigned);
      }
    }

    const { data, error } = await query;

    if (!error && data) {
      setMessages(data);
    }
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      setContacts(data);
    }
  };

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, full_name, email')
      .order('full_name');

    if (!error && data) {
      setStaff(data);
    }
  };

  const fetchMessageNotes = async () => {
    if (!selectedMessage) return;

    const { data, error } = await supabase
      .from('whatsapp_message_notes')
      .select(`
        *,
        staff:created_by(full_name)
      `)
      .eq('message_id', selectedMessage.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMessageNotes(data);
    }
  };

  const handleRegisterNumber = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-whatsapp-number`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registrationForm),
        }
      );

      const result = await response.json();

      if (result.success) {
        alert('WhatsApp number registered successfully!');
        setShowRegisterModal(false);
        setRegistrationForm({
          phone_number_id: '',
          pin: '',
          access_token: '',
          display_name: '',
          phone_number: '',
          meta_business_account_id: ''
        });
        fetchPhoneNumbers();
      } else {
        // Show detailed error from Meta API
        let errorMessage = `Registration failed: ${result.error}`;
        if (result.details) {
          const details = JSON.stringify(result.details, null, 2);
          console.error('Meta API Error Details:', details);
          errorMessage += `\n\nDetails: ${details}`;
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error registering number:', error);
      alert('Failed to register number. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignMessage = async () => {
    if (!selectedMessage || !selectedAssignee) return;

    setLoading(true);
    try {
      // Update message assignment
      const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update({ assigned_to: selectedAssignee })
        .eq('id', selectedMessage.id);

      if (updateError) throw updateError;

      // Record assignment history
      const { error: historyError } = await supabase
        .from('whatsapp_message_assignments')
        .insert({
          message_id: selectedMessage.id,
          assigned_from: selectedMessage.assigned_to,
          assigned_to: selectedAssignee,
          transferred_by: user.id,
          transfer_note: transferNote
        });

      if (historyError) throw historyError;

      alert('Message assigned successfully!');
      setShowAssignModal(false);
      setSelectedAssignee('');
      setTransferNote('');
      fetchMessages();
    } catch (error) {
      console.error('Error assigning message:', error);
      alert('Failed to assign message');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedMessage || !newNote.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_message_notes')
        .insert({
          message_id: selectedMessage.id,
          note: newNote,
          created_by: user.id
        });

      if (error) throw error;

      alert('Note added successfully!');
      setNewNote('');
      setShowNoteModal(false);
      fetchMessageNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'read':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'sent':
        return <Circle className="w-4 h-4 text-gray-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        msg.text_body?.toLowerCase().includes(query) ||
        msg.contact_phone.includes(query)
      );
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Messages</h1>
          </div>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Number
          </button>
        </div>

        {/* Phone Number Selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Business Number:</label>
          <select
            value={selectedPhoneNumber || ''}
            onChange={(e) => setSelectedPhoneNumber(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            {phoneNumbers.map((phone) => (
              <option key={phone.id} value={phone.id}>
                {phone.display_name} - {phone.phone_number} ({phone.quality_rating})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages or phone numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="all">All Messages</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Reply</option>
            <option value="replied">Replied</option>
          </select>

          <select
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="all">All Assignments</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <div className="space-y-3">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`bg-white rounded-lg border ${
                  selectedMessage?.id === message.id ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200'
                } hover:border-green-300 transition-all cursor-pointer`}
                onClick={() => setSelectedMessage(message)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                          message.direction === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {message.direction === 'inbound' ? '← Inbound' : '→ Outbound'}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(message.priority)}`}>
                          {message.priority}
                        </div>
                        {getStatusIcon(message.status)}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{message.contact_phone}</span>
                        {message.assigned_user && (
                          <>
                            <span className="text-gray-400">•</span>
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{message.assigned_user.full_name}</span>
                          </>
                        )}
                      </div>

                      <p className="text-gray-700 line-clamp-2 mb-2">{message.text_body || `[${message.message_type}]`}</p>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(message.timestamp).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMessage(message);
                          setShowAssignModal(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Assign"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMessage(message);
                          setShowNoteModal(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Add Note"
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {selectedMessage?.id === message.id && messageNotes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Notes:</h4>
                      <div className="space-y-2">
                        {messageNotes.map((note) => (
                          <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-700">{note.note}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>{note.staff?.full_name}</span>
                              <span>•</span>
                              <span>{new Date(note.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Register Number Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Register WhatsApp Business Number</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Important Notes:</h3>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>You can only register each phone number once</li>
                  <li>The access token must have WhatsApp Business Management permissions</li>
                  <li>The phone number ID is from Meta Business Manager, not the actual phone number</li>
                  <li>If registration fails, check the browser console for detailed error messages</li>
                  <li>If the number was already registered, you may need to unregister it first in Meta Business Manager</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID *</label>
                  <input
                    type="text"
                    value={registrationForm.phone_number_id}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, phone_number_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="From Meta Business Manager"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">6-Digit PIN *</label>
                  <input
                    type="text"
                    value={registrationForm.pin}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, pin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter 6-digit PIN"
                    maxLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Token *</label>
                  <textarea
                    value={registrationForm.access_token}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, access_token: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows={3}
                    placeholder="Permanent access token from Meta"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    value={registrationForm.display_name}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, display_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., Customer Support"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={registrationForm.phone_number}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, phone_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="+852 1234 5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Business Account ID</label>
                  <input
                    type="text"
                    value={registrationForm.meta_business_account_id}
                    onChange={(e) => setRegistrationForm({ ...registrationForm, meta_business_account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleRegisterNumber}
                  disabled={loading || !registrationForm.phone_number_id || !registrationForm.pin || !registrationForm.access_token}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Registering...' : 'Register Number'}
                </button>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Message Modal */}
      {showAssignModal && selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Assign Message</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign to</label>
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Select staff member</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Note (optional)</label>
                  <textarea
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows={3}
                    placeholder="Add a note about this assignment..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAssignMessage}
                  disabled={loading || !selectedAssignee}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Assigning...' : 'Assign'}
                </button>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedAssignee('');
                    setTransferNote('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Add Note</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={4}
                  placeholder="Add your note here..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleAddNote}
                  disabled={loading || !newNote.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Adding...' : 'Add Note'}
                </button>
                <button
                  onClick={() => {
                    setShowNoteModal(false);
                    setNewNote('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}