import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, XCircle, LayoutGrid, List, Mail, Phone, MapPin, User, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AddPartnerProjectModal } from './AddPartnerProjectModal';
import { EditPartnerProjectModal } from './EditPartnerProjectModal';

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  client_number: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  industry: string | null;
  abbreviation: string | null;
  created_by: string;
  sales_person_id: string | null;
  commission_rate?: number | null;
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
  selectedClientIds?: Set<string>;
  onToggleClientSelection?: (clientId: string) => void;
  onSelectAll?: (selectAll: boolean) => void;
}

export function ClientTableView({ clients, channelPartners, projectTypes, onClientClick, onCreateProject, onChannelPartnerClick, onAddClient, activeTab, selectedClientIds, onToggleClientSelection, onSelectAll }: ClientTableViewProps) {
  const [channelPartnerSubTab, setChannelPartnerSubTab] = useState<'partners' | 'projects'>('partners');
  const [partnerProjects, setPartnerProjects] = useState<PartnerProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showAddPartnerProjectModal, setShowAddPartnerProjectModal] = useState(false);
  const [selectedPartnerProject, setSelectedPartnerProject] = useState<PartnerProject | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

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
        <>
          <div className="flex justify-end items-center gap-2 px-6 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'card'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {activeTab === 'company' && onSelectAll && (
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedClientIds && clients.length > 0 && clients.every(c => selectedClientIds.has(c.id))}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                </th>
              )}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {activeTab === 'company' && onToggleClientSelection && (
                  <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedClientIds?.has(client.id) || false}
                      onChange={() => onToggleClientSelection(client.id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap" onClick={() => onClientClick(client)}>
                  <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    #{client.client_number}
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
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map(client => (
                <div
                  key={client.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
                  onClick={() => onClientClick(client)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {onToggleClientSelection && (
                          <input
                            type="checkbox"
                            checked={selectedClientIds?.has(client.id) || false}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleClientSelection(client.id);
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          />
                        )}
                        <span className="text-xs font-medium text-slate-500">#{client.client_number}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {client.name}
                      </h3>
                      {client.abbreviation && (
                        <span className="inline-block mt-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {client.abbreviation}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    {client.industry && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <span className="inline-block text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {client.industry}
                        </span>
                      </div>
                    )}
                    {client.contact_person && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{client.contact_person}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs line-clamp-2">{client.address}</span>
                      </div>
                    )}
                  </div>

                  {client.notes && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 italic">
                      {client.notes}
                    </p>
                  )}

                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-500">
                      Created by {client.creator?.full_name || 'Unknown'}
                    </div>
                    {client.sales_person && (
                      <div className="text-xs text-slate-500">
                        Sales: {client.sales_person.full_name}
                      </div>
                    )}
                  </div>

                  {projectTypes && projectTypes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {projectTypes.map(type => (
                          <button
                            key={type.id}
                            onClick={() => onCreateProject(client, type.id)}
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          >
                            + {type.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {clients.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-500">No company clients yet. Click "Add Company Client" to get started.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'channel' && channelPartnerSubTab === 'partners' && (
        <>
          <div className="flex justify-end items-center gap-2 px-6 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'card'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
          {viewMode === 'table' ? (
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Commission Rate
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
                      #CP{partner.client_number}
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    {partner.commission_rate ? (
                      <span className="text-sm font-medium text-emerald-600">{partner.commission_rate}%</span>
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
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channelPartners.map(partner => (
                <div
                  key={partner.id}
                  className="bg-white border border-emerald-200 rounded-xl p-5 hover:shadow-lg hover:border-emerald-400 transition-all cursor-pointer group"
                  onClick={() => onChannelPartnerClick(partner)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                        #CP{partner.client_number}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors mt-2">
                        {partner.name}
                      </h3>
                      {partner.abbreviation && (
                        <span className="inline-block mt-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                          {partner.abbreviation}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    {partner.industry && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <span className="inline-block text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {partner.industry}
                        </span>
                      </div>
                    )}
                    {partner.contact_person && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{partner.contact_person}</span>
                      </div>
                    )}
                    {partner.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{partner.email}</span>
                      </div>
                    )}
                    {partner.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{partner.phone}</span>
                      </div>
                    )}
                    {partner.address && (
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs line-clamp-2">{partner.address}</span>
                      </div>
                    )}
                  </div>

                  {partner.notes && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 italic">
                      {partner.notes}
                    </p>
                  )}

                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-500">
                      Created by {partner.creator?.full_name || 'Unknown'}
                    </div>
                    {partner.sales_person && (
                      <div className="text-xs text-slate-500">
                        Sales: {partner.sales_person.full_name}
                      </div>
                    )}
                    {partner.commission_rate && (
                      <div className="text-xs font-medium text-emerald-600 mt-1">
                        Commission: {partner.commission_rate}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {channelPartners.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-slate-500">No channel partners yet. Click "Add Channel Partner" to get started.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'channel' && channelPartnerSubTab === 'projects' && (
        <div>
          <div className="px-6 py-4 border-b border-slate-200 flex justify-end">
            <button
              onClick={() => setShowAddPartnerProjectModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Partner Project
            </button>
          </div>

          <div className="overflow-x-auto">
            {loadingProjects ? (
              <div className="p-12 text-center">
                <p className="text-slate-500">Loading partner projects...</p>
              </div>
            ) : partnerProjects.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 text-lg">No Partner Projects Yet</p>
                <p className="text-slate-400 text-sm mt-2">Click "Create Partner Project" to get started</p>
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
                  <tr
                    key={project.id}
                    onClick={() => setSelectedPartnerProject(project)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
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
        </div>
      )}

      {showAddPartnerProjectModal && (
        <AddPartnerProjectModal
          onClose={() => setShowAddPartnerProjectModal(false)}
          onSuccess={() => {
            setShowAddPartnerProjectModal(false);
            loadPartnerProjects();
          }}
        />
      )}

      {selectedPartnerProject && (
        <EditPartnerProjectModal
          project={selectedPartnerProject}
          onClose={() => setSelectedPartnerProject(null)}
          onSuccess={() => {
            setSelectedPartnerProject(null);
            loadPartnerProjects();
          }}
        />
      )}
    </div>
  );
}
