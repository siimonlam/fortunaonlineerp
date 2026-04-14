import { useState } from 'react';
import { MessageSquare, MessageCircle } from 'lucide-react';
import { WhatsAppMessagesPage } from './WhatsAppMessagesPage';
import { InternalMessenger } from './InternalMessenger';

type Tab = 'whatsapp' | 'messenger';

export function MessagesHub() {
  const [activeTab, setActiveTab] = useState<Tab>('whatsapp');

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 pt-3 flex-shrink-0">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
            activeTab === 'whatsapp'
              ? 'border-green-600 text-green-700 bg-green-50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          WhatsApp
        </button>
        <button
          onClick={() => setActiveTab('messenger')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
            activeTab === 'messenger'
              ? 'border-blue-600 text-blue-700 bg-blue-50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Messenger
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'whatsapp' ? (
          <WhatsAppMessagesPage />
        ) : (
          <InternalMessenger />
        )}
      </div>
    </div>
  );
}
