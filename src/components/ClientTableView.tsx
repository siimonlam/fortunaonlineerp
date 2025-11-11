import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  abbreviation: string | null;
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

interface PartnerProject {
  id: string;
  project_reference: string | null;
  channel_partner_name: string;
  channel_partner_reference: string | null;
  project_amount: number;
  date: string | null;
  paid_status: boolean;
  commission_rate: number;
  commission_amount: number;
  commission_paid_status: boolean;
}

interface ClientTableViewProps {
  clients: Client[];
  channelPartners: Client[];
  projectTypes: ProjectType[];
  onClientClick: (client: Client) => void;
  onCreateProject: (client: Client, targetProjectTypeId: string) => void;
  onChannelPartnerClick: (partner: Client) => void;
  onAddClient: (type: 'company' | 'channel') => void;
  activeTab: 'company' | 'channel';
}

export function ClientTableView({ clients, channelPartners, projectTypes, onClientClick, onCreateProject, onChannelPartnerClick, onAddClient, activeTab }: ClientTableViewProps) {
  const [openMenuClientId, setOpenMenuClientId] = useState<string | null>(null);
  const [channelPartnerSubTab, setChannelPartnerSubTab] = useState<'partners' | 'projects'>('partners');
  const [partnerProjects, setPartnerProjects] = useState<PartnerProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const fundingProjectType = projectTypes.find(pt => pt.name === 'Funding Project');
  const marketingProjectType = projectTypes.find(pt => pt.name === 'Marketing Project');

  useEffect(() => {
    if (activeTab === 'channel' && channelPartnerSubTab === 'projects') {
      loadPartnerProjects();
    }
  }, [activeTab, channelPartnerSubTab]);

  async function loadPartnerProjects() {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('partner_projects')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setPartnerProjects(data || []);
    } catch (error) {
      console.error('Error loading partner projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {activeTab === 'channel' && (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-2 flex gap-2">
          <button
            onClick={() => setChannelPartnerSubTab('partners')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              channelPartnerSubTab === 'partners'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Channel Partners
          </button>
          <button
            onClick={() => setChannelPartnerSubTab('projects')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              channelPartnerSubTab === 'projects'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Partner Projects
          </button>
        </div>
      )}
      {activeTab === 'company' && (
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
                <td className="px-6 py-4 whitespace-nowrap text-sm relative">
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuClientId(openMenuClientId === client.id ? null : client.id);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Create Project
                    </button>
                    {openMenuClientId === client.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                        {fundingProjectType && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuClientId(null);
                              onCreateProject(client, fundingProjectType.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Funding Project
                          </button>
                        )}
                        {marketingProjectType && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuClientId(null);
                              onCreateProject(client, marketingProjectType.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Marketing Project
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No company clients yet. Click "Add Company Client" to get started.</p>
          </div>
        )}
        </div>
      )}

      {activeTab === 'channel' && channelPartnerSubTab === 'partners' && (
        <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Partner #
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {channelPartners.map((partner) => (
                <tr
                  key={partner.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onChannelPartnerClick(partner)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      #CP{String(partner.client_number).padStart(4, '0')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{partner.name}</div>
                    {partner.notes && (
                      <div className="text-sm text-slate-500 truncate max-w-xs">{partner.notes}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {partner.industry ? (
                      <span className="text-sm text-slate-600">{partner.industry}</span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {partner.contact_person ? (
                      <span className="text-sm text-slate-900">{partner.contact_person}</span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {partner.email ? (
                      <span className="text-sm text-slate-600">{partner.email}</span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {partner.phone ? (
                      <span className="text-sm text-slate-600">{partner.phone}</span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {partner.creator ? (
                      <span className="text-sm text-slate-600">{partner.creator.full_name || partner.creator.email}</span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {partner.sales_person ? (
                      <span className="text-sm text-slate-600">{partner.sales_person.full_name || partner.sales_person.email}</span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        {channelPartners.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No channel partners yet. Click "Add Channel Partner" to get started.</p>
          </div>
        )}
        </div>
      )}

      {activeTab === 'channel' && channelPartnerSubTab === 'projects' && (
        <div className="overflow-x-auto">
          {loadingProjects ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">Loading partner projects...</p>
            </div>
          ) : partnerProjects.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500 text-lg">No Partner Projects Yet</p>
              <p className="text-slate-400 text-sm mt-2">Partner projects will appear here once created</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Project Ref
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Partner Ref
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Project Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Paid Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Commission Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Commission Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Commission Paid
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {partnerProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {project.project_reference || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{project.channel_partner_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                        {project.channel_partner_reference || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        ${project.project_amount?.toLocaleString() || '0'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {project.date ? new Date(project.date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {project.paid_status ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {project.commission_rate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-amber-600">
                        ${project.commission_amount?.toLocaleString() || '0'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {project.commission_paid_status ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <XCircle className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
