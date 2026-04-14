import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageSquare, Plus, Send, Search, Users, User,
  Check, CheckCheck, Trash2, X, ChevronLeft
} from 'lucide-react';

interface StaffUser {
  id: string;
  full_name: string;
  email: string;
}

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants?: Participant[];
  last_message?: Message | null;
  unread_count?: number;
}

interface Participant {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  staff?: StaffUser;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: string;
  is_deleted: boolean;
  created_at: string;
  sender?: StaffUser;
}

export function InternalMessenger() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [newConvName, setNewConvName] = useState('');
  const [newConvIsGroup, setNewConvIsGroup] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchStaff();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConv) return;
    fetchMessages(selectedConv.id);
    markAsRead(selectedConv.id);

    const channel = supabase
      .channel(`messenger:${selectedConv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messenger_messages', filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          markAsRead(selectedConv.id);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConv?.id]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
    }
  }, [messages.length]);

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, email')
      .order('full_name');
    if (data) setStaffList(data);
  };

  const fetchConversations = async () => {
    const { data: participantRows } = await supabase
      .from('messenger_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!participantRows || participantRows.length === 0) {
      setConversations([]);
      return;
    }

    const convIds = participantRows.map((r) => r.conversation_id);

    const { data: convs } = await supabase
      .from('messenger_conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!convs) return;

    const enriched: Conversation[] = await Promise.all(
      convs.map(async (conv) => {
        const { data: parts } = await supabase
          .from('messenger_participants')
          .select('*, staff:user_id(id, full_name, email)')
          .eq('conversation_id', conv.id);

        const { data: lastMsgs } = await supabase
          .from('messenger_messages')
          .select('*, sender:sender_id(id, full_name, email)')
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1);

        const myPart = parts?.find((p) => p.user_id === user.id);
        const { count } = await supabase
          .from('messenger_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .gt('created_at', myPart?.last_read_at ?? '1970-01-01');

        return {
          ...conv,
          participants: parts ?? [],
          last_message: lastMsgs?.[0] ?? null,
          unread_count: count ?? 0,
        };
      })
    );

    setConversations(enriched);
  };

  const fetchMessages = async (convId: string) => {
    const { data } = await supabase
      .from('messenger_messages')
      .select('*, sender:sender_id(id, full_name, email)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const markAsRead = async (convId: string) => {
    await supabase
      .from('messenger_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', user.id);
  };

  const handleSelectConv = (conv: Conversation) => {
    setSelectedConv(conv);
    setMobileShowChat(true);
    setDraft('');
  };

  const handleSend = async () => {
    if (!draft.trim() || !selectedConv || sending) return;
    const body = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await supabase.from('messenger_messages').insert({
        conversation_id: selectedConv.id,
        sender_id: user.id,
        body,
        message_type: 'text',
      });
      fetchConversations();
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (msg: Message) => {
    await supabase
      .from('messenger_messages')
      .update({ is_deleted: true })
      .eq('id', msg.id);
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_deleted: true } : m)));
  };

  const handleCreateConversation = async () => {
    if (selectedParticipants.length === 0) return;
    setCreating(true);
    try {
      const allParticipants = Array.from(new Set([user.id, ...selectedParticipants]));

      let name = newConvName.trim();
      if (!name && !newConvIsGroup) {
        const other = staffList.find((s) => s.id === selectedParticipants[0]);
        name = other?.full_name ?? 'Direct Message';
      }

      const { data: conv, error } = await supabase
        .from('messenger_conversations')
        .insert({ name: name || null, is_group: newConvIsGroup, created_by: user.id })
        .select()
        .single();

      if (error || !conv) throw error;

      await supabase.from('messenger_participants').insert(
        allParticipants.map((uid) => ({ conversation_id: conv.id, user_id: uid }))
      );

      setShowNewConvModal(false);
      setNewConvName('');
      setNewConvIsGroup(false);
      setSelectedParticipants([]);
      await fetchConversations();

      setSelectedConv({ ...conv, participants: [], unread_count: 0 });
      setMobileShowChat(true);
    } finally {
      setCreating(false);
    }
  };

  const getConvLabel = (conv: Conversation) => {
    if (conv.name) return conv.name;
    const others = conv.participants?.filter((p) => p.user_id !== user.id) ?? [];
    return others.map((p) => (p.staff as unknown as StaffUser)?.full_name ?? '').filter(Boolean).join(', ') || 'Conversation';
  };

  const getConvInitials = (conv: Conversation) => {
    const label = getConvLabel(conv);
    return label.slice(0, 2).toUpperCase();
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredConvs = conversations.filter((c) =>
    getConvLabel(c).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const dateStr = new Date(msg.created_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const last = acc[acc.length - 1];
    if (last && last.date === dateStr) {
      last.msgs.push(msg);
    } else {
      acc.push({ date: dateStr, msgs: [msg] });
    }
    return acc;
  }, []);

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className={`
        flex flex-col bg-white border-r border-slate-200
        w-full md:w-80 flex-shrink-0
        ${mobileShowChat ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Sidebar Header */}
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">Messenger</h2>
            <button
              onClick={() => setShowNewConvModal(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">Start a new message with a colleague</p>
              <button
                onClick={() => setShowNewConvModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                New Conversation
              </button>
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const isSelected = selectedConv?.id === conv.id;
              const label = getConvLabel(conv);
              const lastMsg = conv.last_message;
              const initials = getConvInitials(conv);
              const hasUnread = (conv.unread_count ?? 0) > 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConv(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-100 last:border-b-0 ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {conv.is_group ? <Users className="w-5 h-5" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {label}
                      </span>
                      {lastMsg && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {lastMsg
                          ? lastMsg.is_deleted
                            ? 'Message deleted'
                            : lastMsg.body
                          : 'No messages yet'}
                      </p>
                      {hasUnread && (
                        <span className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`
        flex-1 flex flex-col min-w-0
        ${mobileShowChat ? 'flex' : 'hidden md:flex'}
      `}>
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Select a conversation</h3>
            <p className="text-sm text-slate-400 mt-1">Choose a conversation from the left or start a new one</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => { setMobileShowChat(false); setSelectedConv(null); }}
                className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {selectedConv.is_group ? <Users className="w-5 h-5" /> : getConvInitials(selectedConv)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{getConvLabel(selectedConv)}</p>
                {selectedConv.is_group && (
                  <p className="text-xs text-slate-400">
                    {selectedConv.participants?.length ?? 0} members
                  </p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {groupedMessages.map(({ date, msgs }) => (
                <div key={date}>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{date}</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="space-y-2">
                    {msgs.map((msg) => {
                      const isMine = msg.sender_id === user.id;
                      const sender = msg.sender as unknown as StaffUser;

                      if (msg.is_deleted) {
                        return (
                          <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-xs text-slate-400 italic px-3 py-1.5 bg-slate-100 rounded-2xl">
                              Message deleted
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={`flex items-end gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {!isMine && (
                            <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0 mb-1">
                              {sender?.full_name?.slice(0, 2).toUpperCase() ?? <User className="w-4 h-4" />}
                            </div>
                          )}
                          <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                            {!isMine && selectedConv.is_group && (
                              <span className="text-xs text-slate-500 font-medium ml-1">{sender?.full_name}</span>
                            )}
                            <div className="flex items-end gap-2">
                              {isMine && (
                                <button
                                  onClick={() => handleDeleteMessage(msg)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                                isMine
                                  ? 'bg-blue-600 text-white rounded-br-md'
                                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm'
                              }`}>
                                {msg.body}
                              </div>
                            </div>
                            <div className={`flex items-center gap-1 text-xs text-slate-400 ${isMine ? 'justify-end' : 'justify-start'} ml-1`}>
                              <span>{formatTime(msg.created_at)}</span>
                              {isMine && <CheckCheck className="w-3.5 h-3.5 text-blue-400" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-slate-200 px-4 py-3">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none max-h-32 overflow-y-auto"
                  style={{ minHeight: '42px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">New Conversation</h2>
              <button
                onClick={() => { setShowNewConvModal(false); setSelectedParticipants([]); setNewConvName(''); setNewConvIsGroup(false); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNewConvIsGroup(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    !newConvIsGroup ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Direct Message
                </button>
                <button
                  onClick={() => setNewConvIsGroup(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    newConvIsGroup ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Group Chat
                </button>
              </div>

              {newConvIsGroup && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                  <input
                    type="text"
                    value={newConvName}
                    onChange={(e) => setNewConvName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="e.g. Marketing Team"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {newConvIsGroup ? 'Select Members' : 'Select Colleague'}
                </label>
                <div className="space-y-1 max-h-52 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  {staffList.filter((s) => s.id !== user.id).map((s) => {
                    const selected = selectedParticipants.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (!newConvIsGroup) {
                            setSelectedParticipants([s.id]);
                          } else {
                            setSelectedParticipants((prev) =>
                              prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            );
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                          selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          selected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {selected ? <Check className="w-4 h-4" /> : s.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{s.full_name}</p>
                          <p className="text-xs text-slate-400">{s.email}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => { setShowNewConvModal(false); setSelectedParticipants([]); setNewConvName(''); setNewConvIsGroup(false); }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={selectedParticipants.length === 0 || creating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {creating ? 'Creating...' : 'Start Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
