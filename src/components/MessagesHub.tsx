import { useState } from 'react';
import { MessageSquare, MessageCircle } from 'lucide-react';
import { MetaMessengerPage } from './MetaMessengerPage';
import { MetaMessengerSettingsPage } from './MetaMessengerSettingsPage';

type Tab = 'whatsapp' | 'messenger';
type MessengerView = 'inbox' | 'settings';

export function MessagesHub() {
  const [activeTab, setActiveTab] = useState<Tab>('messenger');
  const [messengerView, setMessengerView] = useState<MessengerView>('inbox');

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 pt-3 flex-shrink-0">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors mr-1 ${
            activeTab === 'whatsapp'
              ? 'border-green-500 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          WhatsApp
        </button>
        <button
          onClick={() => { setActiveTab('messenger'); setMessengerView('inbox'); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'messenger'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Messenger
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'whatsapp' ? (
          <div className="flex items-center justify-center h-full bg-slate-50">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">WhatsApp</p>
              <p className="text-slate-400 text-xs mt-1">WhatsApp Business inbox</p>
            </div>
          </div>
        ) : messengerView === 'settings' ? (
          <MetaMessengerSettingsPage onBack={() => setMessengerView('inbox')} />
        ) : (
          <MetaMessengerPage onOpenSettings={() => setMessengerView('settings')} />
        )}
      </div>
    </div>
  );
}
