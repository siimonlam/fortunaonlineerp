import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseClient } from '@/lib/supabaseClient';
import { Database } from 'lucide-react';

export default function ClientDatabaseExample() {
  const [mainDbData, setMainDbData] = useState<any[]>([]);
  const [clientDbData, setClientDbData] = useState<any[]>([]);
  const [isClientDbConfigured, setIsClientDbConfigured] = useState(false);

  useEffect(() => {
    setIsClientDbConfigured(supabaseClient !== null);
    loadData();
  }, []);

  async function loadData() {
    // Load from main database
    const { data: mainData, error: mainError } = await supabase
      .from('clients')
      .select('id, company_name, email')
      .limit(5);

    if (mainData) setMainDbData(mainData);
    if (mainError) console.error('Main DB error:', mainError);

    // Load from client database (if configured)
    if (supabaseClient) {
      const { data: clientData, error: clientError } = await supabaseClient
        .from('your_table_name')
        .select('*')
        .limit(5);

      if (clientData) setClientDbData(clientData);
      if (clientError) console.error('Client DB error:', clientError);
    }
  }

  async function syncDataToClientDb() {
    if (!supabaseClient) {
      alert('Client database not configured!');
      return;
    }

    try {
      // Example: Sync clients from main DB to client DB
      const { data: clients } = await supabase
        .from('clients')
        .select('*');

      if (clients) {
        const { error } = await supabaseClient
          .from('synced_clients')
          .upsert(clients);

        if (error) throw error;
        alert('Data synced successfully!');
        loadData();
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed. Check console for details.');
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Database className="w-6 h-6" />
          Multi-Database Connection Example
        </h1>
        <p className="text-slate-600">
          This component demonstrates how to use two Supabase databases simultaneously.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Database */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h2 className="text-lg font-semibold">Main Database</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Primary database - Always available
          </p>
          <div className="bg-slate-50 rounded p-4 mb-4">
            <p className="text-xs text-slate-500 mb-2">Sample Data:</p>
            {mainDbData.length > 0 ? (
              <pre className="text-xs overflow-auto">
                {JSON.stringify(mainDbData, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">No data found</p>
            )}
          </div>
          <code className="text-xs bg-slate-900 text-green-400 p-2 rounded block">
            import {'{ supabase }'} from '@/lib/supabase'
          </code>
        </div>

        {/* Client Database */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${isClientDbConfigured ? 'bg-green-500' : 'bg-slate-300'}`}></div>
            <h2 className="text-lg font-semibold">Client Database</h2>
          </div>
          {isClientDbConfigured ? (
            <>
              <p className="text-sm text-slate-600 mb-4">
                Secondary database - Connected
              </p>
              <div className="bg-slate-50 rounded p-4 mb-4">
                <p className="text-xs text-slate-500 mb-2">Sample Data:</p>
                {clientDbData.length > 0 ? (
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(clientDbData, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-slate-500">No data found or table not configured</p>
                )}
              </div>
              <code className="text-xs bg-slate-900 text-green-400 p-2 rounded block mb-4">
                import {'{ supabaseClient }'} from '@/lib/supabaseClient'
              </code>
              <button
                onClick={syncDataToClientDb}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Sync Data to Client DB
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-amber-600 mb-4">
                Not configured - Add credentials to .env
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded p-4">
                <p className="text-sm font-medium mb-2">Setup Instructions:</p>
                <ol className="text-xs text-slate-700 space-y-1 list-decimal list-inside">
                  <li>Add credentials to .env file:</li>
                </ol>
                <code className="text-xs bg-slate-900 text-green-400 p-2 rounded block mt-2">
                  VITE_SUPABASE_CLIENT_URL=...<br />
                  VITE_SUPABASE_CLIENT_ANON_KEY=...
                </code>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Usage Examples */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Usage Examples</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Query Main Database:</p>
            <pre className="bg-slate-900 text-green-400 p-3 rounded text-xs overflow-auto">
{`const { data } = await supabase
  .from('clients')
  .select('*');`}
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Query Client Database:</p>
            <pre className="bg-slate-900 text-green-400 p-3 rounded text-xs overflow-auto">
{`if (supabaseClient) {
  const { data } = await supabaseClient
    .from('your_table')
    .select('*');
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
