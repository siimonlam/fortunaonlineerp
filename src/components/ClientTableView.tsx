import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle2, XCircle, LayoutGrid, List, Mail, Phone, MapPin, User, Briefcase, Search, Filter } from 'lucide-react';
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
  project_type?: string;
  project_status?: string;
  company_name?: string;
}

interface ClientTableViewProps {
  clients: Client[];
  channelPartners: Client[];
  projectTypes: ProjectType[];
  onClientClick: (client: Client) => void;
  onCreateProject: (client: Client, targetProjectTypeId: string) => void;
  onChannelPartnerClick: (partner: Client) => void;
  onAddClient: (type: 'company' | 'channel') => void;
  activeTab: 'company' | 'channel' | 'inquiries';
  selectedClientIds?: Set<string>;
  onToggleClientSelection?: (clientId: string) => void;
  onSelectAll?: (selectAll: boolean) => void;
}

interface Inquiry {
  id: string;
  company_name: string;
  name: string;
  phone: string;
  email: string;
  industry: string | null;
  interest: string;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export function ClientTableView({ clients, channelPartners, projectTypes, onClientClick, onCreateProject, onChannelPartnerClick, onAddClient, activeTab, selectedClientIds, onToggleClientSelection, onSelectAll }: ClientTableViewProps) {
  const [channelPartnerSubTab, setChannelPartnerSubTab] = useState<'partners' | 'projects' | 'inquiries'>('partners');
  const [partnerProjects, setPartnerProjects] = useState<PartnerProject[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [showAddPartnerProjectModal, setShowAddPartnerProjectModal] = useState(false);
  const [selectedPartnerProject, setSelectedPartnerProject] = useState<PartnerProject | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPartner, setFilterPartner] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (activeTab === 'channel' && channelPartnerSubTab === 'projects') {
      loadPartnerProjects();
    }
    if (activeTab === 'inquiries') {
      loadInquiries();
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

  async function loadInquiries() {
    setLoadingInquiries(true);
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInquiries(data || []);
    } catch (error) {
      console.error('Error loading inquiries:', error);
    } finally {
      setLoadingInquiries(false);
    }
  }

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...partnerProjects];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.project_reference?.toLowerCase().includes(query) ||
        project.channel_partner_name?.toLowerCase().includes(query) ||
        project.company_name?.toLowerCase().includes(query) ||
        project.channel_partner_reference?.toLowerCase().includes(query)
      );
    }

    // Apply partner filter
    if (filterPartner !== 'all') {
      filtered = filtered.filter(project => project.channel_partner_reference === filterPartner);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(project => project.project_status === filterStatus);
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(project => project.project_type === filterType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortBy === 'amount') {
        comparison = a.project_amount - b.project_amount;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [partnerProjects, searchQuery, filterPartner, filterStatus, filterType, sortBy, sortOrder]);

  const uniquePartners = useMemo(() => {
    const partners = new Set(partnerProjects.map(p => p.channel_partner_reference).filter(Boolean));
    return Array.from(partners).sort();
  }, [partnerProjects]);

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
                  {client.projects && client.projects.length > 0 && (() => {
                    const comSecProjectTypeId = projectTypes?.find(pt => pt.name === 'Com Sec')?.id;
                    const marketingProjectTypeId = projectTypes?.find(pt => pt.name === 'Marketing')?.id;

                    const fundingCount = client.projects.filter((p: any) =>
                      p.table_source !== 'marketing_projects' &&
                      p.project_type_id !== comSecProjectTypeId &&
                      p.project_type_id !== marketingProjectTypeId
                    ).length;
                    const marketingCount = client.projects.filter((p: any) =>
                      p.table_source === 'marketing_projects' || p.project_type_id === marketingProjectTypeId
                    ).length;
                    const comsecCount = client.projects.filter((p: any) =>
                      p.project_type_id === comSecProjectTypeId
                    ).length;

                    return (
                      <div className="text-xs text-slate-500 mt-1 flex gap-2">
                        {fundingCount > 0 && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{fundingCount} Funding</span>}
                        {marketingCount > 0 && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{marketingCount} Marketing</span>}
                        {comsecCount > 0 && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{comsecCount} ComSec</span>}
                      </div>
                    );
                  })()}
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

                  {client.projects && client.projects.length > 0 && (() => {
                    const comSecProjectTypeId = projectTypes?.find(pt => pt.name === 'Com Sec')?.id;
                    const marketingProjectTypeId = projectTypes?.find(pt => pt.name === 'Marketing')?.id;

                    const fundingCount = client.projects.filter((p: any) =>
                      p.table_source !== 'marketing_projects' &&
                      p.project_type_id !== comSecProjectTypeId &&
                      p.project_type_id !== marketingProjectTypeId
                    ).length;
                    const marketingCount = client.projects.filter((p: any) =>
                      p.table_source === 'marketing_projects' || p.project_type_id === marketingProjectTypeId
                    ).length;
                    const comsecCount = client.projects.filter((p: any) =>
                      p.project_type_id === comSecProjectTypeId
                    ).length;

                    return (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {fundingCount > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">{fundingCount} Funding</span>}
                        {marketingCount > 0 && <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded font-medium">{marketingCount} Marketing</span>}
                        {comsecCount > 0 && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded font-medium">{comsecCount} ComSec</span>}
                      </div>
                    );
                  })()}

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
                      {(partner as any).reference_number || `#CP${partner.client_number}`}
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
                        {(partner as any).reference_number || `#CP${partner.client_number}`}
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
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Partner Projects</h3>
              <button
                onClick={() => setShowAddPartnerProjectModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Partner Project
              </button>
            </div>

            <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-lg">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterPartner}
                  onChange={(e) => setFilterPartner(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="all">All Partners</option>
                  {uniquePartners.map((partner) => (
                    <option key={partner} value={partner}>
                      {partner}
                    </option>
                  ))}
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="audit">Audit</option>
                  <option value="marketing">Marketing</option>
                  <option value="production">Production</option>
                  <option value="website">Website</option>
                  <option value="others">Others</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split('-');
                    setSortBy(newSortBy as 'date' | 'amount');
                    setSortOrder(newSortOrder as 'asc' | 'desc');
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
              </div>
            </div>

            <div className="text-sm text-slate-600 mt-2">
              Showing {filteredAndSortedProjects.length} of {partnerProjects.length} projects
            </div>
          </div>

          {partnerProjects.length > 0 && (
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Summary by Project Type</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {['audit', 'marketing', 'production', 'website', 'others'].map((type) => {
                  const typeProjects = partnerProjects.filter(p => p.project_type === type);
                  const totalAmount = typeProjects.reduce((sum, p) => sum + (p.project_amount || 0), 0);
                  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

                  return (
                    <div key={type} className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{typeLabel}</div>
                      <div className="text-2xl font-bold text-slate-900">{typeProjects.length}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        ${totalAmount.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
            ) : filteredAndSortedProjects.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 text-lg">No projects match your filters</p>
                <p className="text-slate-400 text-sm mt-2">Try adjusting your search or filter criteria</p>
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
                {filteredAndSortedProjects.map((project) => (
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

      {activeTab === 'inquiries' && (
        <div className="overflow-x-auto">
          {loadingInquiries ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">Loading inquiries...</p>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500 text-lg">No Inquiries Yet</p>
              <p className="text-slate-400 text-sm mt-2">Inquiries from your website will appear here</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Contact Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inquiries.map((inquiry) => (
                  <tr
                    key={inquiry.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        inquiry.status === 'new' ? 'bg-blue-100 text-blue-800' :
                        inquiry.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                        inquiry.status === 'converted' ? 'bg-green-100 text-green-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{inquiry.company_name}</div>
                      {inquiry.notes && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{inquiry.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {inquiry.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      <a href={`mailto:${inquiry.email}`} className="text-blue-600 hover:text-blue-800">
                        {inquiry.email}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {inquiry.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {inquiry.industry ? (
                        <span className="inline-block text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {inquiry.industry}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 max-w-xs truncate">
                        {inquiry.interest}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(inquiry.created_at).toLocaleDateString()} {new Date(inquiry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
