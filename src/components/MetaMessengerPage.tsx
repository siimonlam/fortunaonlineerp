import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MetaMessengerPage, MetaMessengerContact, MetaMessengerMessage } from '../types/messenger';
import {
  Send, Search, RefreshCw, MessageCircle, Settings, ChevronRight,
  User, Clock, CheckCheck, AlertCircle, X, Paperclip, Smile, Image,
  ExternalLink
} from 'lucide-react';

interface Props {
  onOpenSettings: () => void;
}

export function MetaMessengerPage({ onOpenSettings }: Props) {
  const [pages, setPages] = useState<MetaMessengerPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<MetaMessengerPage | null>(null);
  const [contacts, setContacts] = useState<MetaMessengerContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MetaMessengerContact | null>(null);
  const [messages, setMessages] = useState<MetaMessengerMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('meta_messenger_pages')
      .select('*')
      .eq('is_active', true)
      .order('page_name');
    if (err) {
      setError('Failed to load Facebook Pages.');
    } else {
      setPages(data || []);
      if (data && data.length > 0 && !selectedPage) {
        setSelectedPage(data[0]);
      }
    }
    setLoading(false);
  }, [selectedPage]);

  const loadContacts = useCallback(async (pageId: string) => {
    const { data } = await supabase
      .from('meta_messenger_contacts')
      .select('*')
      .eq('page_id', pageId)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    setContacts(data || []);
  }, []);

  const loadMessages = useCallback(async (pageId: string, psid: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('meta_messenger_messages')
      .select('*')
      .eq('page_id', pageId)
      .eq('psid', psid)
      .order('timestamp', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (selectedPage) {
      loadContacts(selectedPage.page_id);
    }
  }, [selectedPage, loadContacts]);

  useEffect(() => {
    if (selectedContact && selectedPage) {
      loadMessages(selectedPage.page_id, selectedContact.psid);
    }
  }, [selectedContact, selectedPage, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedPage) return;

    const contactSub = supabase
      .channel(`meta_contacts_${selectedPage.page_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meta_messenger_contacts',
        filter: `page_id=eq.${selectedPage.page_id}`,
      }, () => {
        loadContacts(selectedPage.page_id);
      })
      .subscribe();

    return () => { supabase.removeChannel(contactSub); };
  }, [selectedPage, loadContacts]);

  useEffect(() => {
    if (!selectedContact || !selectedPage) return;

    const msgSub = supabase
      .channel(`meta_messages_${selectedPage.page_id}_${selectedContact.psid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'meta_messenger_messages',
        filter: `page_id=eq.${selectedPage.page_id}`,
      }, (payload) => {
        const msg = payload.new as MetaMessengerMessage;
        if (msg.psid === selectedContact.psid) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(msgSub); };
  }, [selectedContact, selectedPage]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedContact || !selectedPage) return;
    setSending(true);
    setSendError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-meta-messenger`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_id: selectedPage.page_id,
          psid: selectedContact.psid,
          text: messageText.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send message');
      }

      setMessageText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.psid.includes(searchQuery)
  );

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMessageTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading Messenger...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium mb-1">Error loading pages</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button onClick={loadPages} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-slate-800 font-semibold text-lg mb-2">No Facebook Pages connected</h3>
          <p className="text-slate-500 text-sm mb-5">
            Connect your Facebook Pages to start receiving and replying to Messenger conversations.
          </p>
          <button
            onClick={onOpenSettings}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <Settings className="w-4 h-4" />
            Connect a Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        {/* Page selector */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 text-sm">Messenger Inbox</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => selectedPage && loadContacts(selectedPage.page_id)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenSettings}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {pages.length > 1 && (
            <select
              value={selectedPage?.id || ''}
              onChange={e => {
                const page = pages.find(p => p.id === e.target.value);
                if (page) { setSelectedPage(page); setSelectedContact(null); setMessages([]); }
              }}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            >
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.page_name}</option>
              ))}
            </select>
          )}

          {pages.length === 1 && selectedPage && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 rounded-lg mb-2">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{selectedPage.page_name[0]}</span>
              </div>
              <span className="text-xs font-medium text-blue-700 truncate">{selectedPage.page_name}</span>
            </div>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">
                {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 ${
                  selectedContact?.id === contact.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  {contact.profile_pic ? (
                    <img
                      src={contact.profile_pic}
                      alt={contact.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 truncate">{contact.name}</span>
                    {contact.last_message_at && (
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-1">
                        {formatTime(contact.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    PSID: {contact.psid.slice(0, 8)}...
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 bg-white flex-shrink-0">
              {selectedContact.profile_pic ? (
                <img
                  src={selectedContact.profile_pic}
                  alt={selectedContact.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 text-sm truncate">{selectedContact.name}</h3>
                <p className="text-xs text-slate-400">
                  Facebook Messenger · {selectedPage?.page_name}
                </p>
              </div>
              <a
                href={`https://www.facebook.com/messages/t/${selectedContact.psid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Open in Facebook"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50 space-y-1">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-24">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <MessageCircle className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">No messages yet</p>
                  <p className="text-xs text-slate-300 mt-1">Send the first message below</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isOutbound = msg.direction === 'outbound';
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const showDate = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex items-center justify-center my-3">
                            <div className="bg-slate-200 text-slate-500 text-xs px-3 py-1 rounded-full">
                              {new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </div>
                          </div>
                        )}
                        <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-1`}>
                          {!isOutbound && (
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mr-2 self-end mb-1">
                              {selectedContact.profile_pic ? (
                                <img src={selectedContact.profile_pic} className="w-7 h-7 rounded-full object-cover" alt="" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          )}
                          <div className={`max-w-xs lg:max-w-md xl:max-w-lg`}>
                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isOutbound
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-sm'
                            }`}>
                              {msg.text_body || (
                                <span className="italic opacity-60 text-xs">
                                  {msg.attachments ? '[Attachment]' : '[No content]'}
                                </span>
                              )}
                            </div>
                            <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                              <Clock className="w-2.5 h-2.5 text-slate-300" />
                              <span className="text-xs text-slate-400">{formatMessageTime(msg.timestamp)}</span>
                              {isOutbound && <CheckCheck className="w-3 h-3 text-blue-400" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Send error */}
            {sendError && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 flex-1">{sendError}</p>
                <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="px-4 py-3 border-t border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex gap-1">
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Attach file">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Send image">
                    <Image className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={messageText}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    className="w-full px-4 py-2.5 pr-10 text-sm border border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 placeholder-slate-400"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                  />
                  <button className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600" title="Emoji">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 ml-2">
                Replies via Facebook Messenger · {selectedPage?.page_name}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-slate-50">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-5">
              <MessageCircle className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-slate-700 font-semibold text-lg mb-2">Select a conversation</h3>
            <p className="text-slate-400 text-sm max-w-xs">
              Choose a contact from the left panel to view and reply to their Messenger messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
