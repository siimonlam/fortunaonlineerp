import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, LogOut, User, LayoutGrid, Table, Shield, Search, Bell, Filter, X, AlertCircle, ChevronDown, ChevronRight, DollarSign, FileText, TrendingUp, Users, Building2, CheckCircle2, XCircle, CheckSquare, Upload, Download, BarChart3, ExternalLink, Receipt, Calendar, Columns } from 'lucide-react';
import { ProjectCard } from './ProjectCard';
import { TaskModal } from './TaskModal';
import { EditClientModal } from './EditClientModal';
import { EditProjectModal } from './EditProjectModal';
import { ClientTableView } from './ClientTableView';
import { ProjectListView } from './ProjectListView';
import { AdminPage } from './AdminPage';
import { CreateProjectModal } from './CreateProjectModal';
import { ComSecPage } from './ComSecPage';
import { AddPartnerProjectModal } from './AddPartnerProjectModal';
import { FundingDashboard } from './FundingDashboard';
import { GenerateReceiptModal } from './GenerateReceiptModal';
import { MarkInvoicePaidModal } from './MarkInvoicePaidModal';
import { MeetingsPage } from './MeetingsPage';

interface Status {
  id: string;
  name: string;
  order_index: number;
  project_type_id: string;
  parent_status_id: string | null;
  is_substatus: boolean;
  substatus?: Status[];
}

interface ProjectType {
  id: string;
  name: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status_id: string;
  project_type_id: string;
  created_at: string;
  client_id?: string;
  client_number?: string;
  project_name?: string;
  company_name?: string;
  contact_name?: string;
  abbreviation?: string;
  project_reference_number?: string;
  application_number?: string;
  project_size?: string;
  project_start_date?: string;
  project_end_date?: string;
  tasks?: Task[];
  clients?: Client;
  labels?: Label[];
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
  sales_source: string | null;
  industry: string | null;
  abbreviation: string | null;
  created_by: string;
  sales_person_id: string | null;
  commission_rate?: number | null;
  created_at: string;
  partner_project_count?: number;
  creator?: Staff;
  sales_person?: Staff;
  projects?: Project[];
}

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  deadline: string | null;
  completed: boolean;
  staff?: {
    full_name: string;
  };
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

interface StatusManager {
  id: string;
  status_id: string;
  user_id: string;
  staff?: Staff;
}

interface FundingInvoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  project_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  payment_status: string;
  amount: number;
  project_reference: string | null;
  company_name: string | null;
  payment_type: string | null;
  google_drive_url: string | null;
  created_at: string;
}

export function ProjectBoard() {
  const { user, signOut } = useAuth();
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [selectedProjectType, setSelectedProjectType] = useState<string>('');
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [channelPartners, setChannelPartners] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [statusManagers, setStatusManagers] = useState<StatusManager[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set());
  const [selectedView, setSelectedView] = useState<'projects' | 'clients' | 'admin' | 'comsec'>('projects');
  const [clientViewMode, setClientViewMode] = useState<'card' | 'table'>('card');
  const [projectViewMode, setProjectViewMode] = useState<'grid' | 'list' | 'substatus'>('grid');
  const [activeClientTab, setActiveClientTab] = useState<'company' | 'channel'>('company');
  const [channelPartnerSubTab, setChannelPartnerSubTab] = useState<'partners' | 'projects'>('partners');
  const [comSecModule, setComSecModule] = useState<'clients' | 'invoices' | 'virtual_office' | 'knowledge_base' | 'reminders'>('clients');
  const [fundingProjectTab, setFundingProjectTab] = useState<'dashboard' | 'projects' | 'invoices' | 'meetings'>('projects');
  const [fundingInvoices, setFundingInvoices] = useState<FundingInvoice[]>([]);
  const [fundingReceipts, setFundingReceipts] = useState<any[]>([]);
  const [showGenerateReceipt, setShowGenerateReceipt] = useState(false);
  const [selectedInvoiceForReceipt, setSelectedInvoiceForReceipt] = useState<any>(null);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [selectedInvoiceForMarkPaid, setSelectedInvoiceForMarkPaid] = useState<any>(null);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [addClientType, setAddClientType] = useState<'company' | 'channel'>('company');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSortBy, setClientSortBy] = useState<'client_number_asc' | 'client_number_desc' | 'created_newest' | 'created_oldest'>('client_number_asc');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectSortBy, setProjectSortBy] = useState<'next_hkpc_due_date_due_soon' | 'submission_date' | 'submission_date_oldest' | 'project_start_date' | 'project_end_date' | 'created_newest' | 'created_oldest'>('next_hkpc_due_date_due_soon');
  const [createProjectClient, setCreateProjectClient] = useState<Client | null>(null);
  const [createProjectTypeId, setCreateProjectTypeId] = useState<string>('');
  const [createProjectStatusId, setCreateProjectStatusId] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterProjectSize, setFilterProjectSize] = useState<string[]>([]);
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [filterStartDateFrom, setFilterStartDateFrom] = useState('');
  const [filterStartDateTo, setFilterStartDateTo] = useState('');
  const [filterEndDateFrom, setFilterEndDateFrom] = useState('');
  const [filterEndDateTo, setFilterEndDateTo] = useState('');
  const [filterSubmissionDateFrom, setFilterSubmissionDateFrom] = useState('');
  const [filterSubmissionDateTo, setFilterSubmissionDateTo] = useState('');
  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [filterWithReminder, setFilterWithReminder] = useState(false);
  const [projectTypePermissions, setProjectTypePermissions] = useState<string[]>([]);
  const [partnerProjects, setPartnerProjects] = useState<any[]>([]);
  const [loadingPartnerProjects, setLoadingPartnerProjects] = useState(false);
  const [showAddPartnerProjectModal, setShowAddPartnerProjectModal] = useState(false);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showBulkProjectMenu, setShowBulkProjectMenu] = useState(false);

  useEffect(() => {
    if (!user) {
      console.log('⏳ Waiting for user authentication before subscribing to realtime');
      return;
    }

    console.log('🔄 Setting up realtime subscription for user:', user.email);
    loadData();
    loadAllLabels();

    // Set up a single real-time channel with multiple table listeners
    // Using broadcast channel to work around RLS limitations with SECURITY DEFINER functions
    const channel = supabase
      .channel('db-changes', {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: user.id },
        },
      })
      .on('broadcast', { event: 'project-update' }, (payload) => {
        console.log('✅ ========== PROJECT UPDATE BROADCAST ==========');
        console.log('Broadcast payload:', payload);
        console.log('Current User:', user?.email);
        console.log('========================================');
        loadData();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          console.log('✅ ========== PROJECT CHANGE DETECTED ==========');
          console.log('Event Type:', payload.eventType);
          console.log('Project ID:', payload.new?.id);
          console.log('Old Data:', payload.old);
          console.log('New Data:', payload.new);
          console.log('Current User:', user?.email);
          console.log('========================================');
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        (payload) => {
          console.log('✅ Clients changed:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('✅ Tasks changed:', payload.eventType);
          // Task changes don't affect the board view since tasks are loaded in the modal
          // Skip reloading to prevent losing the current project type selection
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'status_managers' },
        (payload) => {
          console.log('✅ Status managers changed:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_staff' },
        (payload) => {
          console.log('✅ Project staff changed:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'statuses' },
        (payload) => {
          console.log('✅ Statuses changed:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_types' },
        (payload) => {
          console.log('✅ Project types changed:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        (payload) => {
          console.log('✅ Staff changed:', payload.eventType);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_labels' },
        (payload) => {
          console.log('✅ Project labels changed:', payload.eventType);
          loadData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Real-time subscription timed out');
        } else {
          console.log('Real-time status:', status);
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('🔌 Disconnecting real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (activeClientTab === 'channel' && channelPartnerSubTab === 'projects') {
      loadPartnerProjects();
    }
  }, [activeClientTab, channelPartnerSubTab]);

  async function loadAllLabels() {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .order('order_index');

    if (error) {
      console.error('Error loading labels:', error);
    } else if (data) {
      setAllLabels(data);
    }
  }

  async function loadMyTasks() {
    if (!user) return;

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        projects (
          id,
          title,
          clients (
            name,
            client_number
          )
        ),
        meetings (
          id,
          title,
          meeting_date
        )
      `)
      .eq('assigned_to', user.id)
      .eq('completed', false)
      .order('deadline', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error loading my tasks:', error);
    } else if (data) {
      setMyTasks(data);
    }
  }

  async function loadPartnerProjects() {
    setLoadingPartnerProjects(true);
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
      setLoadingPartnerProjects(false);
    }
  }

  async function loadData() {
    console.log('[loadData] Called. Current selectedProjectType:', selectedProjectType);
    console.log('Current user ID:', user?.id);

    const [projectTypesRes, statusesRes, projectsRes, clientsRes, channelPartnersRes, staffRes, statusManagersRes, projectTypePermsRes, partnerProjectsRes, fundingInvoicesRes, comSecClientsRes] = await Promise.all([
      supabase.from('project_types').select('*').order('name'),
      supabase.from('statuses').select('*').order('order_index'),
      supabase
        .from('projects')
        .select(`
          *,
          tasks (
            *,
            staff:assigned_to (id, full_name, email)
          ),
          clients (
            id,
            name,
            client_number
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id,name,contact_person,email,phone,address,notes,sales_source,industry,abbreviation,created_by,created_at,updated_at,sales_person_id,client_number,parent_client_id,parent_company_name')
        .order('created_at', { ascending: false }),
      supabase
        .from('channel_partners')
        .select('id,name,company_name_chinese,contact_person,email,phone,address,notes,sales_source,industry,abbreviation,created_by,created_at,updated_at,sales_person_id,client_number,commission_rate,reference_number')
        .order('created_at', { ascending: false }),
      supabase.from('staff').select('*'),
      supabase.from('status_managers').select('*, staff:user_id(id, full_name, email)'),
      supabase.from('project_type_permissions').select('project_type_id').eq('user_id', user?.id || ''),
      supabase.from('partner_projects').select('id, channel_partner_id, channel_partner_name'),
      supabase.from('funding_invoice').select('*').order('created_at', { ascending: false }),
      supabase.from('comsec_clients').select('id, company_code, company_name, client_id, parent_client_id').order('created_at', { ascending: false }),
    ]);

    const userRoleRes = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user?.id)
      .maybeSingle();

    setIsAdmin(userRoleRes.data?.role === 'admin');

    if (projectTypePermsRes.data) {
      setProjectTypePermissions(projectTypePermsRes.data.map(p => p.project_type_id));
    } else {
      setProjectTypePermissions([]);
    }

    console.log('Load data results:', {
      projectTypes: projectTypesRes.data?.length,
      statuses: statusesRes.data?.length,
      projects: projectsRes.data?.length,
      clients: clientsRes.data?.length,
      staff: staffRes.data?.length,
      projectTypePermissions: projectTypePermsRes.data?.map(p => p.project_type_id) || [],
      projectTypePermsError: projectTypePermsRes.error,
      isAdmin: userRoleRes.data?.role === 'admin',
      errors: {
        projectTypes: projectTypesRes.error,
        statuses: statusesRes.error,
        projects: projectsRes.error,
        clients: clientsRes.error,
        staff: staffRes.error,
      },
      clientsData: clientsRes.data,
      clientsError: JSON.stringify(clientsRes.error),
      staffData: staffRes.data,
    });

    if (clientsRes.error) {
      console.error('Clients query error details:', {
        message: clientsRes.error.message,
        details: clientsRes.error.details,
        hint: clientsRes.error.hint,
        code: clientsRes.error.code,
      });
    }

    if (projectTypesRes.data) {
      setProjectTypes(projectTypesRes.data);
      // Only set default project type if none is selected AND this is the initial load
      // Preserve the current selection when reloading data
      if (!selectedProjectType && projectTypesRes.data.length > 0) {
        const filteredProjectTypes = projectTypesRes.data.filter(pt => pt.name !== 'Com Sec');
        const fundingProject = filteredProjectTypes.find(pt => pt.name === 'Funding Project');
        const defaultType = fundingProject || filteredProjectTypes[0];
        console.log('[loadData] No project type selected, setting to:', defaultType.name);
        setSelectedProjectType(defaultType.id);
      } else {
        console.log('[loadData] Preserving current project type selection:', selectedProjectType);
      }
    }
    if (statusesRes.data) {
      const organizedStatuses = statusesRes.data.map(status => {
        if (!status.is_substatus) {
          const substatus = statusesRes.data.filter(s => s.parent_status_id === status.id);
          return { ...status, substatus };
        }
        return status;
      });

      setStatuses(organizedStatuses);
      if (!selectedStatus && statusesRes.data.length > 0) {
        const filteredTypes = projectTypesRes.data?.filter(pt => pt.name !== 'Com Sec') || [];
        const fundingProject = filteredTypes.find(pt => pt.name === 'Funding Project');
        const defaultType = fundingProject || filteredTypes[0];
        const firstStatusForType = statusesRes.data.find(
          s => s.project_type_id === defaultType?.id && !s.is_substatus
        );
        if (firstStatusForType) {
          const firstSubstatus = statusesRes.data.find(s => s.parent_status_id === firstStatusForType.id);
          setSelectedStatus(firstSubstatus?.id || firstStatusForType.id);
        }
      }
    }
    if (projectsRes.data) {
      const projectsWithLabelsAndInvoices = await Promise.all(
        projectsRes.data.map(async (project) => {
          const { data: labelData } = await supabase
            .from('project_labels')
            .select(`
              labels:label_id (
                id,
                name,
                color
              )
            `)
            .eq('project_id', project.id);

          const labels = labelData?.map(pl => pl.labels).filter(Boolean) || [];

          const invoice = fundingInvoicesRes.data?.find(inv => inv.project_id === project.id);
          const invoice_number = invoice?.invoice_number || null;

          return { ...project, labels, invoice_number };
        })
      );
      setProjects(projectsWithLabelsAndInvoices);
    }
    if (staffRes.data) setStaff(staffRes.data);
    if (statusManagersRes.data) setStatusManagers(statusManagersRes.data);

    if (clientsRes.data) {
      console.log('Processing clients:', clientsRes.data);
      const comSecProjectTypeId = projectTypesRes.data?.find(pt => pt.name === 'Com Sec')?.id;

      if (staffRes.data) {
        const enrichedClients = clientsRes.data.map(client => {
          // Determine which ID to use for filtering
          // If client_number equals parent_client_id, use parent_client_id
          // Otherwise, use client_number
          const isParentClient = client.client_number === client.parent_client_id;
          const filterClientId = isParentClient ? client.parent_client_id : client.client_number;

          // Filter projects and comsec clients based on the determined ID
          let clientProjects, comSecClientsForClient;

          if (isParentClient) {
            // Parent client: look for projects/comsec with matching parent_client_id
            clientProjects = projectsRes.data?.filter(p => p.parent_client_id === filterClientId) || [];
            comSecClientsForClient = comSecClientsRes.data?.filter(cc => cc.parent_client_id === filterClientId) || [];
          } else {
            // Sub-client: look for projects/comsec with matching client_id UUID
            clientProjects = projectsRes.data?.filter(p => p.client_id === client.id) || [];
            comSecClientsForClient = comSecClientsRes.data?.filter(cc => cc.client_id === filterClientId) || [];
          }

          const comSecProjectsFromClients = comSecClientsForClient.map(cc => ({
            id: cc.id,
            title: cc.company_name,
            project_reference: cc.company_code,
            project_type_id: comSecProjectTypeId,
            client_id: client.id,
          }));

          return {
            ...client,
            creator: staffRes.data.find(s => s.id === client.created_by),
            sales_person: client.sales_person_id ? staffRes.data.find(s => s.id === client.sales_person_id) : undefined,
            projects: [...clientProjects, ...comSecProjectsFromClients],
          };
        });
        console.log('Setting enriched clients:', enrichedClients);
        setClients(enrichedClients);
      } else {
        const enrichedClients = clientsRes.data.map(client => {
          const isParentClient = client.client_number === client.parent_client_id;

          let clientProjects, comSecClientsForClient;

          if (isParentClient) {
            // Parent client: look for projects/comsec with matching parent_client_id
            clientProjects = projectsRes.data?.filter(p => p.parent_client_id === client.client_number) || [];
            comSecClientsForClient = comSecClientsRes.data?.filter(cc => cc.parent_client_id === client.client_number) || [];
          } else {
            // Sub-client: look for projects/comsec with matching client_id UUID
            clientProjects = projectsRes.data?.filter(p => p.client_id === client.id) || [];
            comSecClientsForClient = comSecClientsRes.data?.filter(cc => cc.client_id === client.client_number) || [];
          }

          const comSecProjectsFromClients = comSecClientsForClient.map(cc => ({
            id: cc.id,
            title: cc.company_name,
            project_reference: cc.company_code,
            project_type_id: comSecProjectTypeId,
            client_id: client.id,
          }));

          return {
            ...client,
            projects: [...clientProjects, ...comSecProjectsFromClients],
          };
        });
        console.log('Setting enriched clients (no staff):', enrichedClients);
        setClients(enrichedClients);
      }
    } else {
      console.log('No clients data received');
    }

    if (channelPartnersRes.data) {
      console.log('Processing channel partners:', channelPartnersRes.data);

      const partnerProjectCounts = new Map<string, number>();
      if (partnerProjectsRes.data) {
        partnerProjectsRes.data.forEach(pp => {
          if (pp.channel_partner_id) {
            const count = partnerProjectCounts.get(pp.channel_partner_id) || 0;
            partnerProjectCounts.set(pp.channel_partner_id, count + 1);
          }
        });
      }

      if (staffRes.data) {
        const enrichedPartners = channelPartnersRes.data.map(partner => ({
          ...partner,
          creator: staffRes.data.find(s => s.id === partner.created_by),
          sales_person: partner.sales_person_id ? staffRes.data.find(s => s.id === partner.sales_person_id) : undefined,
          partner_project_count: partnerProjectCounts.get(partner.id) || 0,
        }));
        console.log('Setting enriched channel partners:', enrichedPartners);
        setChannelPartners(enrichedPartners);
      } else {
        const enrichedPartners = channelPartnersRes.data.map(partner => ({
          ...partner,
          partner_project_count: partnerProjectCounts.get(partner.id) || 0,
        }));
        setChannelPartners(enrichedPartners);
      }
    } else {
      console.log('No channel partners data received');
    }

    if (fundingInvoicesRes.data) {
      console.log('Loading funding invoices:', fundingInvoicesRes.data.length);
      setFundingInvoices(fundingInvoicesRes.data);
    } else {
      console.log('No funding invoices data received');
    }

    const { data: receiptsData } = await supabase
      .from('funding_receipt')
      .select('*')
      .order('created_at', { ascending: false });

    if (receiptsData) {
      setFundingReceipts(receiptsData);
    }
  }

  async function handleStatusChange(projectId: string, newStatusId: string) {
    const { error } = await supabase
      .from('projects')
      .update({ status_id: newStatusId, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (!error) {
      loadData();
    }
  }

  function handleDragStart(project: Project) {
    setDraggedProject(project);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(statusId: string) {
    if (draggedProject && draggedProject.status_id !== statusId) {
      handleStatusChange(draggedProject.id, statusId);
    }
    setDraggedProject(null);
  }

  const currentProjectType = projectTypes.find(pt => pt.id === selectedProjectType);
  const isClientSection = selectedView === 'clients';
  const isAdminSection = selectedView === 'admin';
  const isComSecSection = selectedView === 'comsec';

  const filteredStatuses = statuses.filter(
    (s) => s.project_type_id === selectedProjectType
  );

  const isFundingProjectType = currentProjectType?.name === 'Funding Project';

  const filteredProjects = projects
    .filter((p) => {
      if (p.project_type_id !== selectedProjectType) return false;

      if (isFundingProjectType && projectSearchQuery.trim()) {
        const query = projectSearchQuery.toLowerCase();
        const matchesSearch =
          p.title?.toLowerCase().includes(query) ||
          p.project_name?.toLowerCase().includes(query) ||
          p.company_name?.toLowerCase().includes(query) ||
          p.contact_name?.toLowerCase().includes(query) ||
          p.abbreviation?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.clients?.name?.toLowerCase().includes(query) ||
          p.project_reference?.toLowerCase().includes(query) ||
          p.application_number?.toLowerCase().includes(query) ||
          statuses.find(s => s.id === p.status_id)?.name?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      if (isFundingProjectType) {
        if (filterStatus.length > 0 && !filterStatus.includes(p.status_id || '')) {
          return false;
        }

        if (filterProjectSize.length > 0 && !filterProjectSize.includes(p.project_size || '')) {
          return false;
        }

        if (filterLabels.length > 0) {
          const hasMatchingLabel = p.labels?.some(label => filterLabels.includes(label.id));
          if (!hasMatchingLabel) return false;
        }

        if (filterStartDateFrom && p.project_start_date) {
          if (new Date(p.project_start_date) < new Date(filterStartDateFrom)) {
            return false;
          }
        }

        if (filterStartDateTo && p.project_start_date) {
          if (new Date(p.project_start_date) > new Date(filterStartDateTo)) {
            return false;
          }
        }

        if (filterEndDateFrom && p.project_end_date) {
          if (new Date(p.project_end_date) < new Date(filterEndDateFrom)) {
            return false;
          }
        }

        if (filterEndDateTo && p.project_end_date) {
          if (new Date(p.project_end_date) > new Date(filterEndDateTo)) {
            return false;
          }
        }

        if (filterSubmissionDateFrom && p.submission_date) {
          if (new Date(p.submission_date) < new Date(filterSubmissionDateFrom)) {
            return false;
          }
        }

        if (filterSubmissionDateTo && p.submission_date) {
          if (new Date(p.submission_date) > new Date(filterSubmissionDateTo)) {
            return false;
          }
        }

        if (filterWithReminder) {
          const hasUpcomingUserTasks = p.tasks?.some(task => {
            if (!task.deadline || task.completed) return false;
            if (!task.assigned_to || task.assigned_to !== user?.id) return false;
            const daysUntilDue = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return daysUntilDue >= 0 && daysUntilDue <= 7;
          });
          if (!hasUpcomingUserTasks) return false;
        }

        if (projectSearchQuery.trim()) {
          return true;
        }
      }

      const selectedStatusObj = statuses.find(s => s.id === selectedStatus);

      if (selectedStatusObj?.is_substatus) {
        return p.status_id === selectedStatus;
      } else {
        const substatusIds = selectedStatusObj?.substatus?.map(s => s.id) || [];
        if (substatusIds.length > 0) {
          return p.status_id === selectedStatus || substatusIds.includes(p.status_id);
        }
        return p.status_id === selectedStatus;
      }
    })
    .sort((a, b) => {
      if (!isFundingProjectType) return 0;

      switch (projectSortBy) {
        case 'next_hkpc_due_date_due_soon': {
          const aDate = a.next_hkpc_due_date ? new Date(a.next_hkpc_due_date).getTime() : Infinity;
          const bDate = b.next_hkpc_due_date ? new Date(b.next_hkpc_due_date).getTime() : Infinity;
          return aDate - bDate;
        }
        case 'submission_date': {
          const aDate = a.submission_date ? new Date(a.submission_date).getTime() : Infinity;
          const bDate = b.submission_date ? new Date(b.submission_date).getTime() : Infinity;
          return aDate - bDate;
        }
        case 'submission_date_oldest': {
          const aDate = a.submission_date ? new Date(a.submission_date).getTime() : Infinity;
          const bDate = b.submission_date ? new Date(b.submission_date).getTime() : Infinity;
          return bDate - aDate;
        }
        case 'project_start_date': {
          const aDate = a.project_start_date ? new Date(a.project_start_date).getTime() : Infinity;
          const bDate = b.project_start_date ? new Date(b.project_start_date).getTime() : Infinity;
          return aDate - bDate;
        }
        case 'project_end_date': {
          const aDate = a.project_end_date ? new Date(a.project_end_date).getTime() : Infinity;
          const bDate = b.project_end_date ? new Date(b.project_end_date).getTime() : Infinity;
          return aDate - bDate;
        }
        case 'created_newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'created_oldest':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default:
          return 0;
      }
    });

  function getStatusUpcomingCount(statusId: string) {
    if (!isFundingProjectType) return 0;

    const statusObj = statuses.find(s => s.id === statusId);
    let relevantProjects: Project[] = [];

    if (statusObj?.is_substatus) {
      relevantProjects = projects.filter(p => p.status_id === statusId && p.project_type_id === selectedProjectType);
    } else {
      const substatusIds = statusObj?.substatus?.map(s => s.id) || [];
      if (substatusIds.length > 0) {
        relevantProjects = projects.filter(p => substatusIds.includes(p.status_id || '') && p.project_type_id === selectedProjectType);
      } else {
        relevantProjects = projects.filter(p => p.status_id === statusId && p.project_type_id === selectedProjectType);
      }
    }

    return relevantProjects.reduce((count, project) => {
      const upcomingTasks = project.tasks?.filter(task => {
        if (!task.deadline || task.completed) return false;
        if (!task.assigned_to || task.assigned_to !== user?.id) return false;
        const daysUntilDue = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue >= 0 && daysUntilDue <= 7;
      }) || [];
      return count + (upcomingTasks.length > 0 ? 1 : 0);
    }, 0);
  }

  function getStatusPastDueCount(statusId: string) {
    if (!isFundingProjectType) return 0;

    const statusObj = statuses.find(s => s.id === statusId);
    let relevantProjects: Project[] = [];

    if (statusObj?.is_substatus) {
      relevantProjects = projects.filter(p => p.status_id === statusId && p.project_type_id === selectedProjectType);
    } else {
      const substatusIds = statusObj?.substatus?.map(s => s.id) || [];
      if (substatusIds.length > 0) {
        relevantProjects = projects.filter(p => substatusIds.includes(p.status_id || '') && p.project_type_id === selectedProjectType);
      } else {
        relevantProjects = projects.filter(p => p.status_id === statusId && p.project_type_id === selectedProjectType);
      }
    }

    return relevantProjects.reduce((count, project) => {
      const pastDueTasks = project.tasks?.filter(task => {
        if (!task.deadline || task.completed) return false;
        if (!task.assigned_to || task.assigned_to !== user?.id) return false;
        const daysUntilDue = Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue < 0;
      }) || [];
      return count + (pastDueTasks.length > 0 ? 1 : 0);
    }, 0);
  }

  function toggleStatusExpanded(statusId: string) {
    setExpandedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(statusId)) {
        newSet.delete(statusId);
      } else {
        newSet.add(statusId);
      }
      return newSet;
    });
  }

  const filteredClients = clients
    .filter(client => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        client.name.toLowerCase().includes(query) ||
        client.client_number.toString().includes(query) ||
        client.contact_person?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query) ||
        client.sales_source?.toLowerCase().includes(query) ||
        client.notes?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (clientSortBy) {
        case 'client_number_asc':
          return a.client_number.localeCompare(b.client_number);
        case 'client_number_desc':
          return b.client_number.localeCompare(a.client_number);
        case 'created_newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

  const currentStatus = statuses.find(s => s.id === selectedStatus);
  const parentStatus = currentStatus?.parent_status_id
    ? statuses.find(s => s.id === currentStatus.parent_status_id)
    : null;

  function handleProjectTypeChange(typeId: string) {
    setSelectedProjectType(typeId);
    setSelectedView('projects');
    const firstStatus = statuses.find(s => s.project_type_id === typeId);
    if (firstStatus) setSelectedStatus(firstStatus.id);
  }

  function handleViewChange(view: 'projects' | 'clients') {
    setSelectedView(view);
  }

  function handleCreateProjectFromClient(client: Client, targetProjectTypeId: string, targetStatusId?: string) {
    setCreateProjectClient(client);
    setCreateProjectTypeId(targetProjectTypeId);
    setCreateProjectStatusId(targetStatusId || '');
  }

  async function handleOldCreateProjectFromClient(client: Client, targetProjectTypeId: string) {
    if (!user) return;

    const hiPoStatus = statuses.find(
      s => s.name === 'Hi-Po' && s.project_type_id === targetProjectTypeId
    );

    if (!hiPoStatus) {
      alert('Hi-Po status not found for the selected project type');
      return;
    }

    try {
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: client.name || 'Untitled Project',
          description: client.notes,
          status_id: hiPoStatus.id,
          project_type_id: targetProjectTypeId,
          created_by: user.id,
          client_id: client.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      if (newProject) {
        const { error: staffError } = await supabase
          .from('project_staff')
          .insert({
            project_id: newProject.id,
            staff_id: user.id,
          });

        if (staffError) {
          console.error('Error adding staff:', staffError);
        }
      }

      alert(`Project created successfully in ${hiPoStatus.name} status!`);
      loadData();
    } catch (error: any) {
      console.error('Error creating project from client:', error);
      alert(`Failed to create project: ${error.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => setSelectedView('projects')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              title="Go to Home"
            >
              <img src="/512x512.jpg" alt="Logo" className="w-10 h-10 rounded-lg" />
              <h1 className="text-xl font-bold text-slate-900">Project Manager</h1>
            </button>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                {user?.email}
              </div>
              <button
                onClick={signOut}
                className="text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex gap-2">
            {projectTypes
              .filter((type) => type.name !== 'Com Sec')
              .filter((type) => isAdmin || projectTypePermissions.includes(type.id))
              .map((type) => {
                const getIcon = () => {
                  if (type.name === 'Funding Project') return <DollarSign className="w-4 h-4" />;
                  if (type.name === 'Marketing') return <TrendingUp className="w-4 h-4" />;
                  return <LayoutGrid className="w-4 h-4" />;
                };

                return (
                  <button
                    key={type.id}
                    onClick={() => handleProjectTypeChange(type.id)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                      selectedProjectType === type.id && selectedView === 'projects'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {getIcon()}
                    {type.name}
                  </button>
                );
              })}
            <button
              onClick={() => handleViewChange('clients')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedView === 'clients'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Clients
            </button>
            {(isAdmin || projectTypePermissions.includes(projectTypes.find(pt => pt.name === 'Com Sec')?.id || '')) && (
              <button
                onClick={() => handleViewChange('comsec')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  selectedView === 'comsec'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Com Sec
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => handleViewChange('admin')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  selectedView === 'admin'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isComSecSection ? (
          <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">Modules</h2>
              <nav className="space-y-2">
                <button
                  onClick={() => setComSecModule('clients')}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                    comSecModule === 'clients'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                  }`}
                >
                  Clients
                </button>
                <button
                  onClick={() => setComSecModule('invoices')}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                    comSecModule === 'invoices'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                  }`}
                >
                  Invoices
                </button>
                <button
                  onClick={() => setComSecModule('virtual_office')}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                    comSecModule === 'virtual_office'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                  }`}
                >
                  Virtual Office
                </button>
                <button
                  onClick={() => setComSecModule('knowledge_base')}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                    comSecModule === 'knowledge_base'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                  }`}
                >
                  Knowledge Base
                </button>
                <button
                  onClick={() => setComSecModule('reminders')}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                    comSecModule === 'reminders'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                  }`}
                >
                  Due Date Reminders
                </button>
              </nav>
            </div>
          </aside>
        ) : !isClientSection && !isAdminSection && (
          <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">Status</h2>
              <nav className="space-y-2">
                {filteredStatuses.filter(s => !s.is_substatus).map((status) => (
                  <div key={status.id}>
                    {status.substatus && status.substatus.length > 0 ? (
                      <div className="space-y-1">
                        <div
                          className={`flex items-center text-sm font-bold mt-2 rounded-lg border transition-all duration-150 ${
                            selectedStatus === status.id
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                              : 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatusExpanded(status.id);
                            }}
                            className="px-2 py-2 hover:bg-black/5 rounded-l-lg transition-colors"
                          >
                            {expandedStatuses.has(status.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStatus(status.id);
                              setFundingProjectTab('projects');
                              if (!expandedStatuses.has(status.id)) {
                                toggleStatusExpanded(status.id);
                              }
                            }}
                            className="flex-1 text-left px-2 py-2 flex items-center justify-between"
                          >
                            <span>{status.name}</span>
                            <span className="flex items-center gap-1.5 pr-2">
                              {getStatusPastDueCount(status.id) > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 px-2 py-0.5 rounded-md shadow-sm">
                                  <AlertCircle className="w-3 h-3" />
                                  {getStatusPastDueCount(status.id)}
                                </span>
                              )}
                              {getStatusUpcomingCount(status.id) > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-800 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-300">
                                  <Bell className="w-3 h-3" />
                                  {getStatusUpcomingCount(status.id)}
                                </span>
                              )}
                            </span>
                          </button>
                        </div>
                        {expandedStatuses.has(status.id) && status.substatus.map((sub) => {
                          const upcomingCount = getStatusUpcomingCount(sub.id);
                          const pastDueCount = getStatusPastDueCount(sub.id);
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setSelectedStatus(sub.id);
                                setFundingProjectTab('projects');
                              }}
                              className={`w-full text-left pl-6 pr-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                                selectedStatus === sub.id
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <span className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                                  {sub.name}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  {pastDueCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 px-2 py-0.5 rounded-md shadow-sm">
                                      <AlertCircle className="w-3 h-3" />
                                      {pastDueCount}
                                    </span>
                                  )}
                                  {upcomingCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-800 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-300">
                                      <Bell className="w-3 h-3" />
                                      {upcomingCount}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedStatus(status.id);
                          setFundingProjectTab('projects');
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-150 ${
                          selectedStatus === status.id
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>{status.name}</span>
                          <span className="flex items-center gap-1.5">
                            {getStatusPastDueCount(status.id) > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 px-2 py-0.5 rounded-md shadow-sm">
                                <AlertCircle className="w-3 h-3" />
                                {getStatusPastDueCount(status.id)}
                              </span>
                            )}
                            {getStatusUpcomingCount(status.id) > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-800 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-300">
                                <Bell className="w-3 h-3" />
                                {getStatusUpcomingCount(status.id)}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </nav>
              <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
                <button
                  onClick={() => setFundingProjectTab('dashboard')}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-150 ${
                    fundingProjectTab === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Dashboard
                  </span>
                </button>
                <button
                  onClick={() => setFundingProjectTab('meetings')}
                  className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-150 ${
                    fundingProjectTab === 'meetings'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-slate-100 bg-white border border-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Meetings
                  </span>
                </button>
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex-1">
                {!isAdminSection && !isComSecSection && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {isClientSection ? 'Clients' : (
                        currentStatus?.is_substatus && parentStatus ? (
                          <span>
                            {parentStatus.name} <span className="text-slate-400">/</span> {currentStatus?.name}
                          </span>
                        ) : (
                          currentStatus?.name || 'Projects'
                        )
                      )}
                    </h2>
                    {!isClientSection && selectedStatus && statusManagers.filter(m => m.status_id === selectedStatus).length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">Status Manager{statusManagers.filter(m => m.status_id === selectedStatus).length > 1 ? 's' : ''}:</span>
                        <div className="flex flex-wrap gap-2">
                          {statusManagers.filter(m => m.status_id === selectedStatus).map((manager) => (
                            <div
                              key={manager.id}
                              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-200"
                              title={manager.staff?.email}
                            >
                              <User className="w-4 h-4" />
                              {manager.staff?.full_name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isFundingProjectType && !isClientSection && fundingProjectTab !== 'dashboard' && fundingProjectTab !== 'meetings' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => setFundingProjectTab('projects')}
                          className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                            fundingProjectTab === 'projects'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          Projects
                        </button>
                        <button
                          onClick={() => setFundingProjectTab('invoices')}
                          className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                            fundingProjectTab === 'invoices'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          Invoices
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isClientSection && !isAdminSection && !isComSecSection && isFundingProjectType && fundingProjectTab === 'projects' && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                  </div>
                  <select
                    value={projectSortBy}
                    onChange={(e) => setProjectSortBy(e.target.value as any)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="next_hkpc_due_date_due_soon">Next HKPC Due Date (Due Soon)</option>
                    <option value="submission_date">Submission Date (Oldest First)</option>
                    <option value="submission_date_oldest">Submission Date (Latest First)</option>
                    <option value="project_start_date">Start Date</option>
                    <option value="project_end_date">End Date (End Soon)</option>
                    <option value="created_newest">Created (Newest)</option>
                    <option value="created_oldest">Created (Oldest)</option>
                  </select>
                  <div className="relative">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors inline-flex items-center gap-2 ${
                        filterStatus.length > 0 || filterProjectSize.length > 0 || filterLabels.length > 0 || filterStartDateFrom || filterStartDateTo || filterEndDateFrom || filterEndDateTo || filterSubmissionDateFrom || filterSubmissionDateTo
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                      {(filterStatus.length > 0 || filterProjectSize.length > 0 || filterLabels.length > 0 || filterStartDateFrom || filterStartDateTo || filterEndDateFrom || filterEndDateTo || filterSubmissionDateFrom || filterSubmissionDateTo) && (
                        <span className="bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                          {filterStatus.length + filterProjectSize.length + filterLabels.length + (filterStartDateFrom ? 1 : 0) + (filterStartDateTo ? 1 : 0) + (filterEndDateFrom ? 1 : 0) + (filterEndDateTo ? 1 : 0) + (filterSubmissionDateFrom ? 1 : 0) + (filterSubmissionDateTo ? 1 : 0)}
                        </span>
                      )}
                    </button>
                    {showFilters && (
                      <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-96 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-slate-900">Filters</h3>
                          <button
                            onClick={() => setShowFilters(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                            <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded p-2">
                              {filteredStatuses.map((status) => (
                                <label key={status.id} className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={filterStatus.includes(status.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFilterStatus([...filterStatus, status.id]);
                                      } else {
                                        setFilterStatus(filterStatus.filter(s => s !== status.id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-700">{status.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Project Size</label>
                            <div className="space-y-1">
                              {['Small', 'Medium', 'Large'].map((size) => (
                                <label key={size} className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={filterProjectSize.includes(size)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFilterProjectSize([...filterProjectSize, size]);
                                      } else {
                                        setFilterProjectSize(filterProjectSize.filter(s => s !== size));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-700">{size}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {allLabels.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Labels</label>
                              <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded p-2">
                                {allLabels.map((label) => (
                                  <label key={label.id} className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={filterLabels.includes(label.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setFilterLabels([...filterLabels, label.id]);
                                        } else {
                                          setFilterLabels(filterLabels.filter(l => l !== label.id));
                                        }
                                      }}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div
                                      className="w-3 h-3 rounded"
                                      style={{ backgroundColor: label.color }}
                                    />
                                    <span className="text-sm text-slate-700">{label.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Other Filters</label>
                            <div className="space-y-1">
                              <label className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={filterWithReminder}
                                  onChange={(e) => setFilterWithReminder(e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 flex items-center gap-1">
                                  <Bell className="w-4 h-4" />
                                  Projects with my reminders
                                </span>
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                            <div className="space-y-2">
                              <input
                                type="date"
                                value={filterStartDateFrom}
                                onChange={(e) => setFilterStartDateFrom(e.target.value)}
                                placeholder="From"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                              <input
                                type="date"
                                value={filterStartDateTo}
                                onChange={(e) => setFilterStartDateTo(e.target.value)}
                                placeholder="To"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                            <div className="space-y-2">
                              <input
                                type="date"
                                value={filterEndDateFrom}
                                onChange={(e) => setFilterEndDateFrom(e.target.value)}
                                placeholder="From"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                              <input
                                type="date"
                                value={filterEndDateTo}
                                onChange={(e) => setFilterEndDateTo(e.target.value)}
                                placeholder="To"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Submission Date</label>
                            <div className="space-y-2">
                              <input
                                type="date"
                                value={filterSubmissionDateFrom}
                                onChange={(e) => setFilterSubmissionDateFrom(e.target.value)}
                                placeholder="From"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                              <input
                                type="date"
                                value={filterSubmissionDateTo}
                                onChange={(e) => setFilterSubmissionDateTo(e.target.value)}
                                placeholder="To"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                          <button
                            onClick={() => {
                              setFilterStatus([]);
                              setFilterProjectSize([]);
                              setFilterStartDateFrom('');
                              setFilterStartDateTo('');
                              setFilterEndDateFrom('');
                              setFilterEndDateTo('');
                              setFilterSubmissionDateFrom('');
                              setFilterSubmissionDateTo('');
                              setFilterWithReminder(false);
                              setFilterLabels([]);
                            }}
                            className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Clear All
                          </button>
                          <button
                            onClick={() => setShowFilters(false)}
                            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 border border-slate-300 rounded-lg p-1 bg-white">
                    <button
                      onClick={() => setProjectViewMode('grid')}
                      className={`p-2 rounded transition-colors ${
                        projectViewMode === 'grid'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Grid view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setProjectViewMode('list')}
                      className={`p-2 rounded transition-colors ${
                        projectViewMode === 'list'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title="List view"
                    >
                      <Table className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setProjectViewMode('substatus')}
                      className={`p-2 rounded transition-colors ${
                        projectViewMode === 'substatus'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Substatus view"
                    >
                      <Columns className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              {isClientSection && (
                <div className="flex items-center justify-between w-full gap-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActiveClientTab('company');
                        setAddClientType('company');
                      }}
                      className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeClientTab === 'company'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Company Clients
                    </button>
                    <button
                      onClick={() => {
                        setActiveClientTab('channel');
                        setAddClientType('channel');
                      }}
                      className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeClientTab === 'channel'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Channel Partners
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder={activeClientTab === 'company' ? 'Search clients...' : 'Search partners...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                      />
                    </div>
                  <select
                    value={clientSortBy}
                    onChange={(e) => setClientSortBy(e.target.value as any)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="client_number_asc">Client # (Low to High)</option>
                    <option value="client_number_desc">Client # (High to Low)</option>
                    <option value="created_newest">Created (Newest First)</option>
                    <option value="created_oldest">Created (Oldest First)</option>
                  </select>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg p-1">
                    <button
                      onClick={() => setClientViewMode('card')}
                      className={`px-3 py-2 rounded-md transition-colors ${
                        clientViewMode === 'card'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Card View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setClientViewMode('table')}
                      className={`px-3 py-2 rounded-md transition-colors ${
                        clientViewMode === 'table'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Table View"
                    >
                      <Table className="w-4 h-4" />
                    </button>
                  </div>
                    {activeClientTab === 'company' && (
                      <>
                        {selectedClientIds.size > 0 && (
                          <>
                            <div className="relative">
                              <button
                                onClick={() => setShowBulkProjectMenu(!showBulkProjectMenu)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-md"
                              >
                                <Plus className="w-5 h-5" />
                                Add Project to {selectedClientIds.size} Client{selectedClientIds.size > 1 ? 's' : ''}
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              {showBulkProjectMenu && (() => {
                                const fundingProjectType = projectTypes.find(pt => pt.name === 'Funding Project');
                                const coldCallStatus = statuses.find(s => s.name === 'Cold Call' && s.project_type_id === fundingProjectType?.id);

                                return (
                                  <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-lg shadow-xl py-2 z-50 min-w-[280px]">
                                    {projectTypes.map((projectType) => (
                                      <button
                                        key={projectType.id}
                                        onClick={async () => {
                                          setShowBulkProjectMenu(false);
                                          const selectedClients = clients.filter(c => selectedClientIds.has(c.id));

                                          if (confirm(`Create ${projectType.name} for ${selectedClients.length} client${selectedClients.length > 1 ? 's' : ''}?`)) {
                                            try {
                                              // Get current user ID
                                              const { data: { user: currentUser } } = await supabase.auth.getUser();
                                              if (!currentUser) {
                                                alert('You must be logged in to create projects');
                                                return;
                                              }

                                              const { data: statusData } = await supabase
                                                .from('statuses')
                                                .select('id')
                                                .eq('project_type_id', projectType.id)
                                                .eq('is_substatus', false)
                                                .order('order_index', { ascending: true })
                                                .limit(1)
                                                .maybeSingle();

                                              if (!statusData) {
                                                alert('No default status found for this project type');
                                                return;
                                              }

                                              const projectsToCreate = selectedClients.map(client => ({
                                                title: client.name,
                                                description: client.notes || '',
                                                status_id: statusData.id,
                                                project_type_id: projectType.id,
                                                client_id: client.id,
                                                created_by: currentUser.id,
                                                created_at: new Date().toISOString()
                                              }));

                                              const { error } = await supabase
                                                .from('projects')
                                                .insert(projectsToCreate);

                                              if (error) {
                                                alert('Error creating projects: ' + error.message);
                                              } else {
                                                alert(`Successfully created ${projectsToCreate.length} ${projectType.name}${projectsToCreate.length > 1 ? 's' : ''}`);
                                                setSelectedClientIds(new Set());
                                                loadData();
                                              }
                                            } catch (err: any) {
                                              alert('Error: ' + err.message);
                                            }
                                          }
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                      >
                                        <FileText className="w-4 h-4 text-slate-500" />
                                        {projectType.name}
                                      </button>
                                    ))}
                                    {fundingProjectType && coldCallStatus && (
                                      <button
                                        key="funding-cold-call"
                                        onClick={async () => {
                                          setShowBulkProjectMenu(false);
                                          const selectedClients = clients.filter(c => selectedClientIds.has(c.id));

                                          if (confirm(`Create Funding Project - Cold Call for ${selectedClients.length} client${selectedClients.length > 1 ? 's' : ''}?`)) {
                                            try {
                                              // Get current user ID
                                              const { data: { user: currentUser } } = await supabase.auth.getUser();
                                              if (!currentUser) {
                                                alert('You must be logged in to create projects');
                                                return;
                                              }

                                              const projectsToCreate = selectedClients.map(client => ({
                                                title: client.name,
                                                description: client.notes || '',
                                                status_id: coldCallStatus.id,
                                                project_type_id: fundingProjectType.id,
                                                client_id: client.id,
                                                created_by: currentUser.id,
                                                created_at: new Date().toISOString()
                                              }));

                                              const { error } = await supabase
                                                .from('projects')
                                                .insert(projectsToCreate);

                                              if (error) {
                                                alert('Error creating projects: ' + error.message);
                                              } else {
                                                alert(`Successfully created ${projectsToCreate.length} Funding Project - Cold Call${projectsToCreate.length > 1 ? 's' : ''}`);
                                                setSelectedClientIds(new Set());
                                                loadData();
                                              }
                                            } catch (err: any) {
                                              alert('Error: ' + err.message);
                                            }
                                          }
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                      >
                                        <FileText className="w-4 h-4 text-slate-500" />
                                        Funding Project - Cold Call
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <button
                              onClick={() => {
                                const selectedClients = clients.filter(c => selectedClientIds.has(c.id));
                                const headers = ['client_number', 'name', 'contact_person', 'email', 'phone', 'address', 'industry', 'abbreviation'];
                                const csvRows = [headers.join(',')];

                                selectedClients.forEach(client => {
                                  const row = [
                                    client.client_number || '',
                                    `"${(client.name || '').replace(/"/g, '""')}"`,
                                    `"${(client.contact_person || '').replace(/"/g, '""')}"`,
                                    client.email || '',
                                    client.phone || '',
                                    `"${(client.address || '').replace(/"/g, '""')}"`,
                                    client.industry || '',
                                    client.abbreviation || ''
                                  ];
                                  csvRows.push(row.join(','));
                                });

                                const csvContent = csvRows.join('\n');
                                const blob = new Blob([csvContent], { type: 'text/csv' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
                                a.click();
                                window.URL.revokeObjectURL(url);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-md"
                            >
                              <Download className="w-5 h-5" />
                              Export {selectedClientIds.size} Selected
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setShowImportModal(true)}
                          className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-md"
                        >
                          <Upload className="w-5 h-5" />
                          Import/Update CSV
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setIsAddClientModalOpen(true)}
                      className={`${
                        activeClientTab === 'company'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      } text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-md`}
                    >
                      <Plus className="w-5 h-5" />
                      {activeClientTab === 'company' ? 'Add Company Client' : 'Add Channel Partner'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isComSecSection ? (
              <ComSecPage
                activeModule={comSecModule}
                onClientClick={(clientId) => {
                  const client = clients.find(c => c.id === clientId);
                  if (client) {
                    setSelectedClient(client);
                    setSelectedView('clients');
                  }
                }}
              />
            ) : isAdminSection ? (
              <AdminPage />
            ) : isClientSection ? (
              clientViewMode === 'card' ? (
                <>
                  {activeClientTab === 'channel' && (
                    <div className="bg-white rounded-t-lg border border-slate-200 border-b-0">
                      <div className="flex gap-2 px-6 py-2">
                        <button
                          onClick={() => setChannelPartnerSubTab('partners')}
                          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                            channelPartnerSubTab === 'partners'
                              ? 'border-emerald-600 text-emerald-600'
                              : 'border-transparent text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Channel Partners
                        </button>
                        <button
                          onClick={() => setChannelPartnerSubTab('projects')}
                          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                            channelPartnerSubTab === 'projects'
                              ? 'border-emerald-600 text-emerald-600'
                              : 'border-transparent text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Partner Projects
                        </button>
                      </div>
                    </div>
                  )}
                  {activeClientTab === 'channel' && channelPartnerSubTab === 'projects' ? (
                    <div className="bg-white rounded-lg border border-slate-200">
                      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-slate-900">Partner Projects</h3>
                        <button
                          onClick={() => setShowAddPartnerProjectModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add Partner Project
                        </button>
                      </div>
                      <div className="p-6">
                        {loadingPartnerProjects ? (
                          <div className="text-center py-12">
                            <p className="text-slate-500">Loading partner projects...</p>
                          </div>
                        ) : partnerProjects.length === 0 ? (
                          <div className="text-center py-12">
                            <p className="text-slate-500 text-lg">No Partner Projects Yet</p>
                            <p className="text-slate-400 text-sm mt-2">Click "Add Partner Project" to get started</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4">
                            {partnerProjects.map((project) => (
                              <div
                                key={project.id}
                                onClick={() => setSelectedPartnerProject(project)}
                                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                              >
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Project Ref</div>
                                    <div className="font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                                      {project.project_reference || '-'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Partner</div>
                                    <div className="font-medium text-slate-900">{project.channel_partner_name}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Partner Ref</div>
                                    <div className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">
                                      {project.channel_partner_reference || '-'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Project Amount</div>
                                    <div className="font-medium text-slate-900">
                                      ${project.project_amount?.toLocaleString() || '0'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Date</div>
                                    <div className="text-sm text-slate-600">
                                      {project.date ? new Date(project.date).toLocaleDateString() : '-'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Paid Status</div>
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
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Commission Rate</div>
                                    <div className="text-sm font-medium text-slate-900">{project.commission_rate}%</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">Commission</div>
                                    <div className="font-medium text-slate-900">
                                      ${project.commission_amount?.toLocaleString() || '0'}
                                    </div>
                                    {project.commission_paid_status ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                                        <XCircle className="w-3 h-3" />
                                        Unpaid
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeClientTab === 'channel' && channelPartnerSubTab === 'partners' ? (
                    <div className="bg-white rounded-lg border border-slate-200 rounded-t-none border-t-0 p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {channelPartners.filter(partner =>
                          !searchQuery ||
                          partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          partner.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          partner.email?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map((client) => (
                          <ClientCard
                            key={client.id}
                            client={client}
                            projectTypes={projectTypes}
                            statuses={statuses}
                            onClick={() => setSelectedClient(client)}
                            onCreateProject={(targetProjectTypeId, targetStatusId) => {
                              handleCreateProjectFromClient(client, targetProjectTypeId, targetStatusId);
                            }}
                            onProjectClick={(project) => setSelectedProject(project)}
                            projectTypePermissions={projectTypePermissions}
                            isAdmin={isAdmin}
                            isChannelPartner={true}
                          />
                        ))}
                        {channelPartners.filter(partner =>
                          !searchQuery ||
                          partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          partner.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          partner.email?.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length === 0 && (
                          <div className="col-span-full text-center py-12">
                            <p className="text-slate-500">
                              {searchQuery
                                ? 'No partners found matching your search.'
                                : 'No channel partners yet. Click the add button to get started.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredClients.map((client) => (
                        <ClientCard
                          key={client.id}
                          client={client}
                          projectTypes={projectTypes}
                          statuses={statuses}
                          onClick={() => setSelectedClient(client)}
                          onCreateProject={(targetProjectTypeId, targetStatusId) => {
                            handleCreateProjectFromClient(client, targetProjectTypeId, targetStatusId);
                          }}
                          onProjectClick={(project) => setSelectedProject(project)}
                          projectTypePermissions={projectTypePermissions}
                          isAdmin={isAdmin}
                        />
                      ))}
                      {filteredClients.length === 0 && (
                        <div className="col-span-full text-center py-12">
                          <p className="text-slate-500">
                            {searchQuery
                              ? 'No clients found matching your search.'
                              : 'No company clients yet. Click the add button to get started.'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <ClientTableView
                  clients={filteredClients}
                  channelPartners={channelPartners}
                  projectTypes={projectTypes}
                  onClientClick={(client) => setSelectedClient(client)}
                  onCreateProject={(client, targetProjectTypeId) => {
                    handleCreateProjectFromClient(client, targetProjectTypeId);
                  }}
                  onChannelPartnerClick={(partner) => setSelectedClient(partner)}
                  onAddClient={(type) => {
                    setAddClientType(type);
                    setIsAddClientModalOpen(true);
                  }}
                  activeTab={activeClientTab}
                  selectedClientIds={selectedClientIds}
                  onToggleClientSelection={(clientId) => {
                    const newSelected = new Set(selectedClientIds);
                    if (newSelected.has(clientId)) {
                      newSelected.delete(clientId);
                    } else {
                      newSelected.add(clientId);
                    }
                    setSelectedClientIds(newSelected);
                  }}
                  onSelectAll={(selectAll) => {
                    if (selectAll) {
                      setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
                    } else {
                      setSelectedClientIds(new Set());
                    }
                  }}
                />
              )
            ) : !isClientSection && isFundingProjectType && fundingProjectTab === 'dashboard' ? (
              <FundingDashboard />
            ) : !isClientSection && isFundingProjectType && fundingProjectTab === 'meetings' ? (
              <MeetingsPage projects={filteredProjects.map(p => ({ id: p.id, title: p.title }))} />
            ) : !isClientSection && isFundingProjectType && fundingProjectTab === 'invoices' ? (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Invoice Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Invoice #</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Project</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Client</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Issue Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Payment Date</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Payment Method</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Payment Type</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Invoice Link</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Receipt Link</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fundingInvoices.map((invoice) => {
                          const invoiceProject = projects.find(p => p.id === invoice.project_id);
                          const invoiceClient = clients.find(c => c.id === invoice.client_id);
                          return (
                            <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => {
                              if (invoiceProject) setSelectedProject(invoiceProject);
                            }}>
                              <td className="py-3 px-4 text-sm font-medium text-slate-900">{invoice.invoice_number}</td>
                              <td className="py-3 px-4 text-sm text-slate-900">{invoice.project_reference || invoiceProject?.title || '-'}</td>
                              <td className="py-3 px-4 text-sm text-slate-600">{invoice.company_name || invoiceClient?.name || '-'}</td>
                              <td className="py-3 px-4 text-sm text-right text-slate-900">
                                ${invoice.amount ? Number(invoice.amount).toFixed(2) : '0.00'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">
                                {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : '-'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">
                                {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString() : '-'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">{invoice.payment_method || '-'}</td>
                              <td className="py-3 px-4 text-sm text-slate-600">{invoice.payment_type || '-'}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  invoice.payment_status === 'Paid'
                                    ? 'bg-green-100 text-green-700'
                                    : invoice.payment_status === 'Overdue'
                                    ? 'bg-red-100 text-red-700'
                                    : invoice.payment_status === 'Void'
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {invoice.payment_status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                {invoice.google_drive_url ? (
                                  <a
                                    href={invoice.google_drive_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 text-xs"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                {(() => {
                                  const receipt = fundingReceipts.find(r => r.invoice_id === invoice.id);
                                  return receipt?.google_drive_url ? (
                                    <a
                                      href={receipt.google_drive_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-600 hover:text-green-800 flex items-center justify-center gap-1 text-xs"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      View
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 text-xs">-</span>
                                  );
                                })()}
                              </td>
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-2">
                                  {invoice.payment_status !== 'Paid' && (
                                    <button
                                      onClick={() => {
                                        setSelectedInvoiceForMarkPaid(invoice);
                                        setShowMarkPaid(true);
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setSelectedInvoiceForReceipt(invoice);
                                      setShowGenerateReceipt(true);
                                    }}
                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1 text-xs"
                                  >
                                    <Receipt className="w-3 h-3" />
                                    Receipt
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {fundingInvoices.length === 0 && (
                          <tr>
                            <td colSpan={12} className="py-12 text-center text-slate-500">
                              No invoices found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : isFundingProjectType && fundingProjectTab === 'projects' && projectViewMode === 'list' ? (
              <ProjectListView
                projects={filteredProjects}
                projectTypes={projectTypes}
                statuses={statuses}
                selectedStatus={selectedStatus}
                onProjectClick={(project) => setSelectedProject(project)}
                onClientClick={(client) => setSelectedClient(client)}
              />
            ) : isFundingProjectType && fundingProjectTab === 'projects' && projectViewMode === 'substatus' ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {(() => {
                  const getSubstatusColor = (substatusName: string) => {
                    const normalizedName = substatusName.toLowerCase().trim();
                    const colorMap: { [key: string]: string } = {
                      'hi-po': 'bg-red-900 text-white',
                      'mid-po': 'bg-red-600 text-white',
                      'lo-po': 'bg-red-300 text-slate-900',
                      'cold call': 'bg-teal-500 text-white',
                      'q&a': 'bg-blue-900 text-white',
                      'q&a -emf': 'bg-blue-600 text-white',
                      '已上委員會': 'bg-blue-300 text-slate-900',
                      'presbmission': 'bg-yellow-400 text-slate-900',
                      'approved': 'bg-orange-300 text-slate-900',
                      'final report': 'bg-purple-300 text-slate-900',
                      'conditional approval': 'bg-green-300 text-slate-900',
                      'final report (q&a)': 'bg-pink-400 text-white',
                      'extension/change request': 'bg-green-700 text-white',
                      'final report-final stage': 'bg-red-600 text-white',
                      'withdraw': 'bg-slate-400 text-white',
                      'rejected': 'bg-slate-900 text-white',
                      'end': 'bg-slate-900 text-white'
                    };
                    return colorMap[normalizedName] || 'bg-slate-200 text-slate-800';
                  };

                  const selectedStatusObj = statuses?.find(s => s.id === selectedStatus);
                  let substatusesToDisplay: Status[] = [];

                  if (selectedStatusObj?.is_substatus) {
                    substatusesToDisplay = [selectedStatusObj];
                  } else if (selectedStatusObj && selectedStatusObj.substatus && selectedStatusObj.substatus.length > 0) {
                    substatusesToDisplay = selectedStatusObj.substatus.sort((a, b) => a.order_index - b.order_index);
                  } else if (selectedStatusObj) {
                    substatusesToDisplay = [selectedStatusObj];
                  } else {
                    substatusesToDisplay = statuses
                      ?.filter(s => s.is_substatus && s.project_type_id === selectedProjectType)
                      .sort((a, b) => a.order_index - b.order_index) || [];
                  }

                  const parentStatusMap = new Map();
                  statuses
                    ?.filter(s => !s.is_substatus && s.project_type_id === selectedProjectType)
                    .forEach(parent => {
                      parentStatusMap.set(parent.id, parent.name);
                    });

                  return substatusesToDisplay.map(substatus => {
                    const substatusProjects = filteredProjects.filter(p => p.status_id === substatus.id);
                    const parentStatusName = substatus.parent_status_id ? parentStatusMap.get(substatus.parent_status_id) : '';

                    return (
                      <div key={substatus.id} className="flex-shrink-0 w-80">
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                          <div className={`px-4 py-3 ${getSubstatusColor(substatus.name)}`}>
                            <div className="font-semibold text-sm">{substatus.name}</div>
                            {parentStatusName && (
                              <div className="text-xs opacity-80 mt-0.5">{parentStatusName}</div>
                            )}
                            <div className="text-xs font-medium mt-1">{substatusProjects.length} projects</div>
                          </div>
                          <div className="p-3 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                            {substatusProjects.map(project => (
                              <div
                                key={project.id}
                                onClick={() => setSelectedProject(project)}
                                className="bg-slate-50 rounded-lg p-3 cursor-pointer hover:bg-slate-100 transition-colors border border-slate-200"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-medium text-sm text-slate-900 line-clamp-2">{project.title}</h4>
                                </div>
                                {project.client_number && (
                                  <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-2">
                                    {project.client_number}
                                  </div>
                                )}
                                {project.project_reference_number && (
                                  <div className="text-xs text-slate-600 mb-1">
                                    Ref: {project.project_reference_number}
                                  </div>
                                )}
                                {project.company_name && (
                                  <div className="text-xs text-slate-600">
                                    {project.company_name}
                                  </div>
                                )}
                              </div>
                            ))}
                            {substatusProjects.length === 0 && (
                              <div className="text-center py-8 text-slate-400 text-sm">
                                No projects
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : isFundingProjectType && fundingProjectTab === 'projects' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isClientSection={false}
                    projectTypes={projectTypes}
                    statuses={statuses}
                    allProjects={projects}
                    statusManagers={statusManagers}
                    showSubstatus={currentStatus && !currentStatus.is_substatus}
                    currentUserId={user?.id}
                    onDragStart={() => handleDragStart(project)}
                    onClick={() => setSelectedProject(project)}
                    onCreateProject={(targetProjectTypeId) => {
                      handleCreateProjectFromClient(project, targetProjectTypeId);
                    }}
                    onClientClick={(client) => setSelectedClient(client)}
                  />
                ))}
                {filteredProjects.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-slate-500">
                      No projects in this status yet.
                    </p>
                  </div>
                )}
              </div>
            ) : !isClientSection && !isFundingProjectType ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isClientSection={false}
                    projectTypes={projectTypes}
                    statuses={statuses}
                    allProjects={projects}
                    statusManagers={statusManagers}
                    showSubstatus={currentStatus && !currentStatus.is_substatus}
                    currentUserId={user?.id}
                    onDragStart={() => handleDragStart(project)}
                    onClick={() => setSelectedProject(project)}
                    onCreateProject={(targetProjectTypeId) => {
                      handleCreateProjectFromClient(project, targetProjectTypeId);
                    }}
                    onClientClick={(client) => setSelectedClient(client)}
                  />
                ))}
                {filteredProjects.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-slate-500">
                      No projects in this status yet.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {isAddClientModalOpen && (
        <AddClientModal
          clientType={addClientType}
          onClose={() => setIsAddClientModalOpen(false)}
          onSuccess={() => {
            setIsAddClientModalOpen(false);
            loadData();
          }}
        />
      )}

      {selectedClient && (
        <EditClientModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSuccess={() => {
            setSelectedClient(null);
            loadData();
          }}
        />
      )}

      {selectedProject && (() => {
        const projectType = projectTypes.find(pt => pt.id === selectedProject.project_type_id);
        const isFundingProject = projectType?.name === 'Funding Project';

        console.log('Selected Project:', {
          id: selectedProject.id,
          title: selectedProject.title,
          project_type_id: selectedProject.project_type_id,
          projectTypeName: projectType?.name,
          isFundingProject,
          allFields: selectedProject
        });

        return isFundingProject ? (
          <EditProjectModal
            project={selectedProject}
            statuses={statuses}
            onClose={() => setSelectedProject(null)}
            onSuccess={() => {
              setSelectedProject(null);
              loadData();
            }}
            onRefresh={() => {
              loadData();
            }}
          />
        ) : (
          <TaskModal
            project={selectedProject}
            staff={staff}
            onClose={() => setSelectedProject(null)}
            onSuccess={() => {
              setSelectedProject(null);
              loadData();
            }}
          />
        );
      })()}

      {createProjectClient && createProjectTypeId && (() => {
        const projectType = projectTypes.find(pt => pt.id === createProjectTypeId);
        return (
          <CreateProjectModal
            client={createProjectClient}
            projectTypeId={createProjectTypeId}
            projectTypeName={projectType?.name || 'Project'}
            initialStatusId={createProjectStatusId}
            onClose={() => {
              setCreateProjectClient(null);
              setCreateProjectTypeId('');
              setCreateProjectStatusId('');
            }}
            onSuccess={() => {
              setCreateProjectClient(null);
              setCreateProjectTypeId('');
              setCreateProjectStatusId('');
              loadData();
            }}
          />
        );
      })()}

      {showAddPartnerProjectModal && (
        <AddPartnerProjectModal
          onClose={() => setShowAddPartnerProjectModal(false)}
          onSuccess={() => {
            setShowAddPartnerProjectModal(false);
            loadPartnerProjects();
          }}
        />
      )}

      {showGenerateReceipt && selectedInvoiceForReceipt && (
        <GenerateReceiptModal
          invoice={selectedInvoiceForReceipt}
          onClose={() => {
            setShowGenerateReceipt(false);
            setSelectedInvoiceForReceipt(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {showMarkPaid && selectedInvoiceForMarkPaid && (
        <MarkInvoicePaidModal
          invoice={selectedInvoiceForMarkPaid}
          onClose={() => {
            setShowMarkPaid(false);
            setSelectedInvoiceForMarkPaid(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      <button
        onClick={() => {
          setShowMyTasks(true);
          loadMyTasks();
        }}
        className="fixed bottom-6 left-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-50"
      >
        <CheckSquare className="w-5 h-5" />
        My Tasks
      </button>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Import Clients from CSV</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportProgress('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">CSV Format Instructions</h3>
                <p className="text-sm text-blue-800 mb-2">Your CSV file should have the following columns:</p>
                <code className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded block">
                  client_number, name, contact_person, email, phone, address, industry, abbreviation
                </code>
                <div className="text-xs text-blue-700 mt-2 space-y-1">
                  <p><strong>For New Clients:</strong></p>
                  <p>• Leave <code className="bg-blue-100 px-1 rounded">client_number</code> empty - will be auto-assigned</p>
                  <p>• Only 'name' field is required</p>
                  <p className="mt-2"><strong>For Updating Existing Clients:</strong></p>
                  <p>• Include <code className="bg-blue-100 px-1 rounded">client_number</code> of the client to update</p>
                  <p>• System will match by client_number and update those records</p>
                  <p>• Empty fields will not overwrite existing data</p>
                </div>
              </div>

              <button
                onClick={() => {
                  const csvContent = 'client_number,name,contact_person,email,phone,address,industry,abbreviation\n,"New Company Ltd","Jane Smith","jane@example.com","+1234567890","123 Main St","Technology","NEW"\nCL001,"Existing Company Ltd","John Doe","john@example.com","+0987654321","456 Oak Ave","Finance","EXS"';
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'client_import_template.csv';
                  a.click();
                  window.URL.revokeObjectURL(url);
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download CSV Template
              </button>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-12 h-12 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {importFile ? importFile.name : 'Click to select CSV file'}
                  </span>
                  <span className="text-xs text-slate-500">or drag and drop</span>
                </label>
              </div>

              {importProgress && (
                <div className="bg-slate-100 border border-slate-300 rounded-lg p-4">
                  <p className="text-sm text-slate-700">{importProgress}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportProgress('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!importFile) {
                      alert('Please select a CSV file');
                      return;
                    }

                    try {
                      setImportProgress('Reading CSV file...');
                      const text = await importFile.text();
                      const lines = text.split('\n').filter(line => line.trim());

                      if (lines.length < 2) {
                        alert('CSV file is empty or has no data rows');
                        return;
                      }

                      const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
                      const newClients = [];
                      const updateClients = [];

                      for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.trim().replace(/^"(.*)"$/, '$1')) || [];
                        const client: any = {};

                        headers.forEach((header, index) => {
                          if (values[index]) {
                            client[header] = values[index];
                          }
                        });

                        if (client.name) {
                          if (client.client_number && client.client_number.trim()) {
                            updateClients.push(client);
                          } else {
                            client.created_by = user?.id;
                            newClients.push(client);
                          }
                        }
                      }

                      if (newClients.length === 0 && updateClients.length === 0) {
                        alert('No valid clients found in CSV');
                        return;
                      }

                      let insertedCount = 0;
                      let updatedCount = 0;

                      if (newClients.length > 0) {
                        setImportProgress(`Importing ${newClients.length} new clients...`);
                        const { data, error } = await supabase
                          .from('clients')
                          .insert(newClients)
                          .select();

                        if (error) throw error;
                        insertedCount = data.length;
                      }

                      if (updateClients.length > 0) {
                        setImportProgress(`Updating ${updateClients.length} existing clients...`);
                        for (const client of updateClients) {
                          const clientNumber = client.client_number;
                          delete client.client_number;

                          const updateData: any = {};
                          Object.keys(client).forEach(key => {
                            if (client[key]) {
                              updateData[key] = client[key];
                            }
                          });

                          const { error } = await supabase
                            .from('clients')
                            .update(updateData)
                            .eq('client_number', clientNumber);

                          if (!error) updatedCount++;
                        }
                      }

                      const successMsg = [];
                      if (insertedCount > 0) successMsg.push(`${insertedCount} new clients imported`);
                      if (updatedCount > 0) successMsg.push(`${updatedCount} clients updated`);

                      setImportProgress(`Success! ${successMsg.join(', ')}!`);
                      setTimeout(() => {
                        setShowImportModal(false);
                        setImportFile(null);
                        setImportProgress('');
                        window.location.reload();
                      }, 2000);
                    } catch (error: any) {
                      console.error('Import error:', error);
                      setImportProgress(`Error: ${error.message}`);
                    }
                  }}
                  disabled={!importFile}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Import Clients
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMyTasks && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900">My Tasks</h2>
              <button
                onClick={() => setShowMyTasks(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {myTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckSquare className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg">No tasks assigned to you</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myTasks.map((task: any) => {
                    const isPastDue = task.deadline && new Date(task.deadline) < new Date();
                    const companyName = task.projects?.clients?.name || (task.meetings ? 'Meeting Task' : 'No Company');
                    const clientNumber = task.projects?.clients?.client_number;
                    const isMeetingTask = !!task.meetings;

                    return (
                      <div
                        key={task.id}
                        className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                          isPastDue
                            ? 'border-red-200 bg-red-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-500">
                                {clientNumber ? `#${clientNumber}` : ''} {companyName}
                              </span>
                              {isMeetingTask && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Meeting
                                </span>
                              )}
                              {isPastDue && (
                                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-medium">
                                  PAST DUE
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              {task.projects?.title ? (
                                <span className="text-slate-500">
                                  Project: {task.projects.title}
                                </span>
                              ) : task.meetings?.title ? (
                                <span className="text-slate-500">
                                  Meeting: {task.meetings.title}
                                </span>
                              ) : null}
                              {task.deadline && (
                                <span className={`font-medium ${isPastDue ? 'text-red-600' : 'text-slate-700'}`}>
                                  Due: {new Date(task.deadline).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientCardProps {
  client: Client;
  projectTypes: ProjectType[];
  statuses: Status[];
  onClick: () => void;
  onCreateProject: (targetProjectTypeId: string, targetStatusId?: string) => void;
  onProjectClick?: (project: Project) => void;
  isChannelPartner?: boolean;
}

function ClientCard({ client, projectTypes, statuses, onClick, onCreateProject, onProjectClick, projectTypePermissions, isAdmin, isChannelPartner = false }: ClientCardProps & { projectTypePermissions: string[]; isAdmin: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const fundingProjectType = projectTypes.find(pt => pt.name === 'Funding Project');
  const comSecProjectType = projectTypes.find(pt => pt.name === 'Com Sec');
  const marketingProjectType = projectTypes.find(pt => pt.name === 'Marketing');

  const coldCallStatus = statuses.find(s => s.name === 'Cold Call' && s.project_type_id === fundingProjectType?.id);

  const fundingProjects = client.projects?.filter(p => p.project_type_id === fundingProjectType?.id) || [];
  const comSecProjects = client.projects?.filter(p => p.project_type_id === comSecProjectType?.id) || [];

  const hasAnyButton = !isChannelPartner && projectTypes.length > 0;

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-1 rounded ${
              isChannelPartner
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-blue-600 bg-blue-50'
            }`}>
              {isChannelPartner && (client as any).reference_number
                ? (client as any).reference_number
                : `#${client.client_number}`}
            </span>
            {client.abbreviation && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                {client.abbreviation}
              </span>
            )}
            <h3 className="font-semibold text-slate-900 text-lg">{client.name}</h3>
          </div>
          {client.creator && (
            <p className="text-xs text-slate-500">
              Created by: {client.creator.full_name || client.creator.email}
            </p>
          )}
          {client.sales_person && (
            <p className="text-xs text-slate-500">
              Sales: {client.sales_person.full_name || client.sales_person.email}
            </p>
          )}
        </div>
        {hasAnyButton && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Create Project
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[220px]">
                {fundingProjectType && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onCreateProject(fundingProjectType.id);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Funding Project
                </button>
              )}
              {fundingProjectType && coldCallStatus && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onCreateProject(fundingProjectType.id, coldCallStatus.id);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Funding Project - Cold Call
                </button>
              )}
              {comSecProjectType && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onCreateProject(comSecProjectType.id);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Com Sec
                </button>
              )}
              {marketingProjectType && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onCreateProject(marketingProjectType.id);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Marketing
                </button>
              )}
            </div>
          )}
          </div>
        )}
      </div>
      {client.industry && (
        <div className="mb-2">
          <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
            {client.industry}
          </span>
        </div>
      )}
      {client.contact_person && (
        <p className="text-sm text-slate-600 mb-1">Contact: {client.contact_person}</p>
      )}
      {client.email && (
        <p className="text-sm text-slate-600 mb-1">Email: {client.email}</p>
      )}
      {client.phone && (
        <p className="text-sm text-slate-600 mb-1">Phone: {client.phone}</p>
      )}
      {client.address && (
        <p className="text-sm text-slate-600 mb-2">Address: {client.address}</p>
      )}
      {client.notes && (
        <p className="text-sm text-slate-500 mt-3 line-clamp-3">{client.notes}</p>
      )}
      {(fundingProjects.length > 0 || comSecProjects.length > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          {fundingProjects.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-600 mb-1">Funding Projects ({fundingProjects.length}):</p>
              <div className="space-y-1">
                {fundingProjects.slice(0, 3).map((project) => (
                  <button
                    key={project.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectClick?.(project);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate block text-left w-full"
                  >
                    • {project.project_reference || project.title}
                  </button>
                ))}
                {fundingProjects.length > 3 && (
                  <p className="text-xs text-slate-500">+ {fundingProjects.length - 3} more</p>
                )}
              </div>
            </div>
          )}
          {comSecProjects.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">ComSec Projects ({comSecProjects.length}):</p>
              <div className="space-y-1">
                {comSecProjects.slice(0, 3).map((project) => (
                  <button
                    key={project.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectClick?.(project);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate block text-left w-full"
                  >
                    • {project.title}
                  </button>
                ))}
                {comSecProjects.length > 3 && (
                  <p className="text-xs text-slate-500">+ {comSecProjects.length - 3} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {client.partner_project_count !== undefined && client.partner_project_count > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-700">Partner Projects</p>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              {client.partner_project_count}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface AddClientModalProps {
  onClose: () => void;
  onSuccess: () => void;
  clientType?: 'company' | 'channel';
}

function AddClientModal({ onClose, onSuccess, clientType = 'company' }: AddClientModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [nextClientNumber, setNextClientNumber] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    companyNameChinese: '',
    abbreviation: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    salesSource: '',
    salesSourceDetail: '',
    industry: '',
    otherIndustry: '',
    isEcommerce: false,
    salesPersonId: '',
    channelPartnerId: '',
    parentClientId: '',
    parentCompanyName: '',
  });

  useEffect(() => {
    loadStaff();
    loadChannelPartners();
    loadAllClients();
    loadNextClientNumber();
  }, []);

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*');
    if (data) setStaff(data);
  }

  async function loadChannelPartners() {
    const { data } = await supabase
      .from('channel_partners')
      .select('id, name, reference_number')
      .order('reference_number');
    if (data) setChannelPartners(data);
  }

  async function loadAllClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, client_number')
      .order('client_number');
    if (data) setAllClients(data as Client[]);
  }

  async function loadNextClientNumber() {
    const tableName = clientType === 'channel' ? 'channel_partners' : 'clients';
    const { data } = await supabase
      .from(tableName)
      .select('client_number')
      .order('client_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setNextClientNumber(data.client_number + 1);
    } else {
      setNextClientNumber(1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const tableName = clientType === 'channel' ? 'channel_partners' : 'clients';

      // Base fields common to both tables
      const baseData = {
        name: formData.name.trim(),
        company_name_chinese: formData.companyNameChinese.trim() || null,
        abbreviation: formData.abbreviation.trim() || null,
        contact_person: formData.contactPerson.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
        sales_source: formData.salesSource.trim() || null,
        sales_source_detail: formData.salesSourceDetail.trim() || null,
        industry: formData.industry.trim() || null,
        created_by: user.id,
        sales_person_id: formData.salesPersonId || null,
      };

      // Add fields specific to clients table
      const insertData = clientType === 'channel'
        ? baseData
        : {
            ...baseData,
            other_industry: formData.industry === 'Other' ? formData.otherIndustry.trim() || null : null,
            is_ecommerce: formData.isEcommerce,
            channel_partner_id: formData.channelPartnerId || null,
            parent_client_id: formData.parentClientId.trim() || null,
            parent_company_name: formData.parentCompanyName.trim() || null,
          };

      const { data, error} = await supabase
        .from(tableName)
        .insert(insertData)
        .select('id, name, client_number')
        .single();

      if (error) throw error;

      if (data) {
        const paddedNumber = data.client_number;
        alert(`Client created successfully!\n\nClient #${paddedNumber}\nName: ${data.name}`);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error creating client:', error);
      alert(`Failed to create client: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {clientType === 'channel' ? 'Add New Channel Partner' : 'Add New Client'}
              </h2>
              {nextClientNumber !== null && (
                <span className={`text-sm font-semibold px-3 py-1 rounded ${
                  clientType === 'channel' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'
                }`}>
                  {clientType === 'channel' ? '#CP' : '#'}{String(nextClientNumber).padStart(4, '0')}
                </span>
              )}
            </div>
            {nextClientNumber !== null && (
              <p className="text-sm text-slate-500 mt-1">
                New client will be assigned number {String(nextClientNumber).padStart(4, '0')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Abbreviation</label>
              <input
                type="text"
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter abbreviation"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name in Chinese</label>
            <input
              type="text"
              value={formData.companyNameChinese}
              onChange={(e) => setFormData({ ...formData, companyNameChinese: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入中文公司名称"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact person name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sales Person</label>
              <select
                value={formData.salesPersonId}
                onChange={(e) => setFormData({ ...formData, salesPersonId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select sales person</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Company Name</label>
              <select
                value={formData.parentCompanyName}
                onChange={(e) => {
                  const selectedClient = allClients.find(c => c.name === e.target.value);
                  if (selectedClient) {
                    setFormData({
                      ...formData,
                      parentCompanyName: selectedClient.name,
                      parentClientId: selectedClient.client_number || ''
                    });
                  } else {
                    setFormData({ ...formData, parentCompanyName: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select parent company</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.client_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Client ID</label>
              <input
                type="text"
                value={formData.parentClientId}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                placeholder="Auto-filled from parent company"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sales Source</label>
              <select
                value={formData.salesSource}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, salesSource: value, salesSourceDetail: '' });

                  const selectedPartner = channelPartners.find(cp => cp.reference_number === value);
                  if (selectedPartner) {
                    setFormData(prev => ({ ...prev, salesSource: value, channelPartnerId: selectedPartner.id, salesSourceDetail: '' }));
                  } else {
                    setFormData(prev => ({ ...prev, salesSource: value, channelPartnerId: '', salesSourceDetail: '' }));
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Sales Source --</option>
                <option value="Direct">Direct</option>
                <option value="Referral">Referral</option>
                <option value="Website">Website</option>
                <option value="Seminar">Seminar</option>
                <option value="Exhibition">Exhibition</option>
                <option value="Marketing">Marketing</option>
                <option value="Social Media">Social Media</option>
                <option value="Others">Others</option>
                <optgroup label="Channel Partners">
                  {channelPartners.map(partner => (
                    <option key={partner.id} value={partner.reference_number}>
                      {partner.reference_number} - {partner.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value, otherIndustry: e.target.value !== 'Other' ? '' : formData.otherIndustry })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an industry</option>
                <option value="Accounting">Accounting</option>
                <option value="Advertising & Marketing">Advertising & Marketing</option>
                <option value="Agriculture">Agriculture</option>
                <option value="Automotive">Automotive</option>
                <option value="Aviation / Aerospace">Aviation / Aerospace</option>
                <option value="Banking & Financial Services">Banking & Financial Services</option>
                <option value="Biotechnology">Biotechnology</option>
                <option value="Construction">Construction</option>
                <option value="Consulting">Consulting</option>
                <option value="Consumer Goods / FMCG">Consumer Goods / FMCG</option>
                <option value="Education">Education</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Energy / Oil & Gas">Energy / Oil & Gas</option>
                <option value="Engineering">Engineering</option>
                <option value="Entertainment & Media">Entertainment & Media</option>
                <option value="Fashion & Apparel">Fashion & Apparel</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Government / Public Sector">Government / Public Sector</option>
                <option value="Healthcare / Medical">Healthcare / Medical</option>
                <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                <option value="Human Resources / Recruiting">Human Resources / Recruiting</option>
                <option value="Information Technology (IT)">Information Technology (IT)</option>
                <option value="Insurance">Insurance</option>
                <option value="Internet / Online Services">Internet / Online Services</option>
                <option value="Legal Services">Legal Services</option>
                <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Non-Profit / NGO">Non-Profit / NGO</option>
                <option value="Pharmaceuticals">Pharmaceuticals</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Retail">Retail</option>
                <option value="Software / SaaS">Software / SaaS</option>
                <option value="Telecommunications">Telecommunications</option>
                <option value="Transportation">Transportation</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {formData.industry === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specify Other Industry</label>
              <input
                type="text"
                value={formData.otherIndustry}
                onChange={(e) => setFormData({ ...formData, otherIndustry: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter industry name"
              />
            </div>
          )}

          {(formData.salesSource === 'Seminar' || formData.salesSource === 'Exhibition') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {formData.salesSource === 'Seminar' ? 'Which Seminar?' : 'Which Exhibition?'}
              </label>
              <input
                type="text"
                value={formData.salesSourceDetail}
                onChange={(e) => setFormData({ ...formData, salesSourceDetail: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={formData.salesSource === 'Seminar' ? 'Enter seminar name' : 'Enter exhibition name'}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-commerce</label>
            <select
              value={formData.isEcommerce ? 'yes' : 'no'}
              onChange={(e) => setFormData({ ...formData, isEcommerce: e.target.value === 'yes' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              placeholder="Enter additional notes"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
