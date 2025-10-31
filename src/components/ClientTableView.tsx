import { Plus } from 'lucide-react';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  client_number: number;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  industry: string | null;
  created_by: string;
  sales_person_id: string | null;
  created_at: string;
  creator?: Staff;
  sales_person?: Staff;
  projects?: any[];
}

interface ProjectType {
  id: string;
  name: string;
}

interface ClientTableViewProps {
  clients: Client[];
  projectTypes: ProjectType[];
  onClientClick: (client: Client) => void;
  onCreateProject: (client: Client, targetProjectTypeId: string) => void;
}

export function ClientTableView({ clients, projectTypes, onClientClick, onCreateProject }: ClientTableViewProps) {
  const fundingProjectType = projectTypes.find(pt => pt.name === 'Funding Project');

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Client #
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Company Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Industry
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Contact Person
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Created By
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Sales Person
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onClientClick(client)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    #{String(client.client_number).padStart(4, '0')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-slate-900">{client.name}</div>
                  {client.notes && (
                    <div className="text-sm text-slate-500 truncate max-w-xs">{client.notes}</div>
                  )}
                  {client.projects && client.projects.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      {client.projects.length} project{client.projects.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {client.industry ? (
                    <span className="inline-block text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      {client.industry}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {client.contact_person || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {client.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {client.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {client.creator ? (client.creator.full_name || client.creator.email) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {client.sales_person ? (client.sales_person.full_name || client.sales_person.email) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {fundingProjectType && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateProject(client, fundingProjectType.id);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Create Project
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {clients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No clients yet. Click "Add New Client" to get started.</p>
        </div>
      )}
    </div>
  );
}
